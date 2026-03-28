from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session, joinedload
from backend.database import get_db
from . import models, services
from backend.modules.agenda import models as agenda_models
from backend.modules.pacientes import models as pacientes_models
from pydantic import BaseModel
from datetime import datetime, date, time, timedelta
from sqlalchemy import func, or_
from typing import Optional, List
import re
import traceback

# ─── Auth / Tenant ──────────────────────────
class DummyUsuario:
    def __init__(self, negocio_id: int):
        self.negocio_id = negocio_id

def get_current_usuario(authorization: str = Header(None)):
    """Extrae negocio_id del token JWT/fake-token almacenado en localStorage."""
    if authorization:
        match = re.search(r"tenant-(\d+)", authorization)
        if match:
            return DummyUsuario(negocio_id=int(match.group(1)))
    return DummyUsuario(negocio_id=1)

from backend.modules.inventario import services as inventario_services
from backend.modules.inventario import models as inventario_models

router = APIRouter(
    prefix="/api/cobranza",
    tags=["Cobranza"]
)

class PagoCreate(BaseModel):
    cita_id: int
    cliente_id: Optional[int] = None
    monto_pagado: float
    metodo: str
    referencia: Optional[str] = None
    usar_wallet: bool = False
    abono_wallet: float = 0.0
    proxima_cita: Optional[date] = None

@router.get("/tasa-bcv")
async def get_tasa_bcv():
    tasa = await services.obtener_tasa_bcv()
    return {"tasa": tasa}

@router.get("/pendientes")
def get_citas_por_cobrar(db: Session = Depends(get_db)):
    utc_now = datetime.utcnow()
    venezuela_now = utc_now - timedelta(hours=4)
    hoy_venezuela = venezuela_now.date()
    
    estados_activos = ['confirmada', 'asistio', 'pagada']
    
    citas = db.query(agenda_models.Cita).join(agenda_models.Cita.cliente).filter(
        func.date(agenda_models.Cita.fecha_hora_inicio) == hoy_venezuela,
        func.lower(agenda_models.Cita.estado).in_(estados_activos),
    ).all()
    
    resultados = []
    seen_clientes = set()
    
    for cita in citas:
        if cita.cliente_id in seen_clientes:
            continue
        seen_clientes.add(cita.cliente_id)

        tiene_wallet = False
        if cita.cliente and cita.cliente.saldo_wallet > 0:
            tiene_wallet = True

        proxima_cita_texto = "No definida"
        if cita.cliente and cita.cliente.frecuencia_visitas:
            fecha_sug = hoy_venezuela + timedelta(days=cita.cliente.frecuencia_visitas)
            meses = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"]
            mes_str = meses[fecha_sug.month - 1]
            proxima_cita_texto = f"En {cita.cliente.frecuencia_visitas} días ({fecha_sug.day} {mes_str})"
            
        monto_total = 0.0
        servicios_nombres = []
        if cita.servicios and len(cita.servicios) > 0:
            for servicio in cita.servicios:
                monto_total += (servicio.precio_sesion or 0.0)
                servicios_nombres.append(servicio.nombre)
            servicio_str = ", ".join(servicios_nombres)
        else:
            servicio_str = "Sin servicio"
            
        resultados.append({
            "cita_id": cita.id,
            "cliente_id": cita.cliente_id,
            "paciente_nombre": cita.cliente.nombre_completo if cita.cliente else "Desconocido",
            "hora": cita.fecha_hora_inicio.strftime("%H:%M"),
            "servicio": servicio_str,
            "monto_esperado": monto_total,
            "tiene_wallet": tiene_wallet,
            "proxima_cita_texto": proxima_cita_texto,
            "estado": cita.estado.value if hasattr(cita.estado, 'value') else str(cita.estado)
        })
        
    return resultados

@router.get("/pacientes-del-dia")
def get_pacientes_del_dia(db: Session = Depends(get_db)):
    pacientes = db.query(pacientes_models.Cliente).order_by(pacientes_models.Cliente.nombre_completo.asc()).limit(100).all()
    resultados = []
    for p in pacientes:
        resultados.append({
            "cita_id": 0,
            "cliente_id": p.id,
            "paciente_nombre": p.nombre_completo,
            "hora": "---", 
            "servicio": "General",
            "monto_esperado": 0.0
        })
    return resultados

@router.get("/")
def listar_pagos(db: Session = Depends(get_db)):
    pagos = db.query(models.Pago).\
        options(joinedload(models.Pago.cita).joinedload(agenda_models.Cita.cliente)).\
        order_by(models.Pago.id.desc()).limit(50).all()
        
    historial = []
    for pago in pagos:
        cliente_obj = {
            "nombre": pago.cita.cliente.nombre_completo,
            "apellido": "", 
            "id": pago.cita.cliente.id
        }
        historial.append({
            "id": pago.id,
            "fecha": pago.cita.fecha_hora_inicio.date(), 
            "cliente": cliente_obj,
            "monto": pago.monto,
            "metodo": pago.metodo,
            "referencia": pago.referencia
        })
    return historial

from .schemas import CobroCreate
from .models import Cobro, DetalleCobro, Pago

@router.post("/")
def crear_cobro(
    cobro_in: CobroCreate,
    db: Session = Depends(get_db),
    usuario_actual: DummyUsuario = Depends(get_current_usuario)
):
    if cobro_in.cita_id:
        from backend.modules.agenda.models import Cita
        cita_pagada = db.query(Cita).filter(Cita.id == cobro_in.cita_id).first()
        if cita_pagada and hasattr(cita_pagada, 'estado') and str(cita_pagada.estado).lower() in ['pagada', 'cobrado']:
            db.rollback()
            raise HTTPException(status_code=400, detail="Este cobro ya fue procesado previamente.")
    
    recent_limit = datetime.now() - timedelta(seconds=15)
    total_approx = sum([i.precio_aplicado for i in cobro_in.items])
    cobro_reciente = db.query(Cobro).filter(
        Cobro.cliente_id == cobro_in.cliente_id,
        Cobro.fecha >= recent_limit,
        Cobro.total >= total_approx - 1,
        Cobro.total <= total_approx + 1
    ).first()
    
    if cobro_reciente:
        db.rollback()
        raise HTTPException(status_code=400, detail="Se detectó un cobro idéntico en los últimos segundos. Por favor, verifique el historial.")

    try:
        grand_total = 0.0
        auto_wallet_topup = 0.0
        mensaje_extra = None

        for item in cobro_in.items:
            if str(item.tipo_venta).lower() == 'paquete' and item.tipo_cobro == 'completo':
                sesiones = item.sesiones_totales if item.sesiones_totales > 0 else 1
                precio_por_sesion = item.precio_aplicado / sesiones
                monto_abono = item.precio_aplicado - precio_por_sesion
                setattr(item, '_costo_original_completo', item.precio_aplicado)
                item.precio_aplicado = precio_por_sesion
                auto_wallet_topup += monto_abono
                if monto_abono > 0:
                    mensaje_extra = f"Pago procesado. Se cobró ${precio_por_sesion:.2f} por la sesión de hoy y se abonaron ${monto_abono:.2f} al Wallet."

            grand_total += item.precio_aplicado
            
        wallet_used = cobro_in.monto_wallet_usado or 0.0
        wallet_topup = (cobro_in.monto_abonado or 0.0) + auto_wallet_topup
        cash_for_service = max(0.0, grand_total - wallet_used)
        total_cash_in = cash_for_service + wallet_topup
            
        from backend.modules.staff.models import Empleado
        spec_emp = db.query(Empleado).filter(or_(Empleado.rol == 'especialista', Empleado.rol == 'ambos'), Empleado.activo == 1).first()
        rec_emp = db.query(Empleado).filter(or_(Empleado.rol == 'recepcionista', Empleado.rol == 'ambos'), Empleado.activo == 1).first()
        spec_id = spec_emp.id if spec_emp else None
        rec_id = rec_emp.id if rec_emp else None

        processed_metodo_pago = "WALLET" if cobro_in.metodo_pago and cobro_in.metodo_pago.lower() == "wallet" else cobro_in.metodo_pago
        
        nuevo_cobro = Cobro(
            cliente_id=cobro_in.cliente_id,
            negocio_id=usuario_actual.negocio_id,
            fecha=datetime.now(),
            metodo_pago=processed_metodo_pago,
            referencia=cobro_in.referencia,
            monto_total_venta=grand_total,
            monto_abonado=wallet_topup,
            deuda=0.0,
            total=grand_total + wallet_topup,
            tasa_bcv=cobro_in.tasa_bcv
        )
        db.add(nuevo_cobro)
        db.flush()
        
        from backend.modules.agenda.models import Cita, EstadoCita
        from backend.modules.cobranza.models import Pago
        
        start_of_day = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        end_of_day = start_of_day + timedelta(days=1)
        
        existing_cita = db.query(Cita).filter(
            Cita.cliente_id == cobro_in.cliente_id,
            Cita.fecha_hora_inicio >= start_of_day,
            Cita.fecha_hora_inicio < end_of_day
        ).first()
        
        if existing_cita:
            new_cita = existing_cita
            new_cita.estado = agenda_models.EstadoCita.PAGADA
        else:
            new_cita = Cita(
                cliente_id=cobro_in.cliente_id,
                fecha_hora_inicio=datetime.now(),
                fecha_hora_fin=datetime.now() + timedelta(minutes=30),
                estado=EstadoCita.CONFIRMADA
            )
            db.add(new_cita)
            db.flush()
        
        if cash_for_service > 0:
            pago_cash = Pago(
                cita_id=new_cita.id,
                negocio_id=usuario_actual.negocio_id,
                monto=cash_for_service,
                metodo=processed_metodo_pago,
                referencia=cobro_in.referencia
            )
            db.add(pago_cash)
            
        if wallet_used > 0:
            pago_wallet = Pago(
                cita_id=new_cita.id,
                negocio_id=usuario_actual.negocio_id,
                monto=wallet_used,
                metodo="WALLET",
                referencia="Uso de Saldo a Favor"
            )
            db.add(pago_wallet)
        
        if wallet_used > 0 or wallet_topup > 0:
            cliente = db.query(pacientes_models.Cliente).filter(pacientes_models.Cliente.id == cobro_in.cliente_id).first()
            if cliente:
                if wallet_used > 0:
                    cliente.saldo_wallet -= wallet_used
                if wallet_topup > 0:
                    cliente.saldo_wallet += wallet_topup
        
        from backend.modules.servicios.models import PaqueteSpa
        from backend.modules.pacientes.models import PaqueteCliente
        
        for item in cobro_in.items:
            servicio = db.query(PaqueteSpa).filter(PaqueteSpa.id == item.servicio_id).first()
            if servicio is None:
                nombre_servicio = "Abono / Servicio Personalizado"
                original_price = item.precio_aplicado
                comision_recepcionista = 0.0
                comision_especialista = 0.0
            else:
                nombre_servicio = servicio.nombre
                original_price = servicio.sesion if item.tipo_venta == 'sesion' else servicio.paquete_4_sesiones
                comision_recepcionista = servicio.comision_recepcionista
                comision_especialista = servicio.comision_especialista
            
            monto_com_recep = comision_recepcionista if rec_id else 0.0
            monto_com_esp = comision_especialista if spec_id else 0.0
            safe_servicio_id = item.servicio_id if item.servicio_id != 0 else None

            detalle = DetalleCobro(
                cobro_id=nuevo_cobro.id,
                servicio_id=safe_servicio_id,
                servicio_nombre=nombre_servicio,
                tipo_venta=item.tipo_venta,
                precio_unitario=original_price or 0.0,
                precio_aplicado=item.precio_aplicado,
                cantidad=1,
                recepcionista_id=rec_id,
                especialista_id=spec_id,
                monto_comision_recepcionista=monto_com_recep,
                monto_comision_especialista=monto_com_esp
            )
            db.add(detalle)
            
            if str(item.tipo_venta).lower() == 'paquete':
                precio_paquete_real = getattr(item, '_costo_original_completo', item.precio_aplicado)
                if item.tipo_cobro == 'completo':
                    costo_real = precio_paquete_real
                else: 
                    costo_real = original_price if original_price else (precio_paquete_real * item.sesiones_totales)
                
                nuevo_paquete_cliente = PaqueteCliente(
                    paciente_id=cobro_in.cliente_id,
                    nombre_paquete=nombre_servicio,
                    total_sesiones=item.sesiones_totales,
                    sesiones_usadas=1,
                    costo_total=costo_real,
                    monto_pagado=precio_paquete_real,
                    activo=True if 1 < item.sesiones_totales else False
                )
                db.add(nuevo_paquete_cliente)

            if str(item.tipo_venta).lower() == 'sesion' and wallet_used > 0:
                paquete_activo = db.query(PaqueteCliente).filter(
                    PaqueteCliente.paciente_id == cobro_in.cliente_id,
                    PaqueteCliente.nombre_paquete == nombre_servicio,
                    PaqueteCliente.activo == True,
                    PaqueteCliente.sesiones_usadas < PaqueteCliente.total_sesiones
                ).first()
                if paquete_activo is not None:
                    paquete_activo.sesiones_usadas += 1
                    paquete_activo.monto_pagado += item.precio_aplicado
                    if paquete_activo.sesiones_usadas >= paquete_activo.total_sesiones:
                        paquete_activo.activo = False

            if item.servicio_id:
                try:
                    receta = inventario_services.obtener_receta_por_servicio(db, item.servicio_id)
                    if receta:
                        inventario_services.consumir_receta(
                            db,
                            receta.id,
                            referencia=f"Cobro #{nuevo_cobro.id} - {nombre_servicio}",
                            negocio_id=usuario_actual.negocio_id
                        )
                except Exception as inv_err:
                    print(f"WARNING: Error al consumir inventario for {item.servicio_id}: {inv_err}")

        cliente = db.query(pacientes_models.Cliente).filter(pacientes_models.Cliente.id == cobro_in.cliente_id).first()
        if cliente:
            if cobro_in.fecha_proxima:
                try:
                    y, m, d = map(int, cobro_in.fecha_proxima.split('-'))
                    cliente.fecha_proxima_estimada = date(y, m, d)
                except: pass
            else:
                frec = cliente.frecuencia_visitas if cliente.frecuencia_visitas else 21
                cliente.fecha_proxima_estimada = date.today() + timedelta(days=frec)

        db.commit()
        db.refresh(nuevo_cobro)
        return {
            "status": "success",
            "mensaje": "Cobro procesado correctamente",
            "mensaje_extra": str(mensaje_extra) if mensaje_extra else None,
            "cobro_id": int(nuevo_cobro.id),
            "total": float(grand_total),
            "abonado": float(wallet_topup),
            "deuda": 0.0
        }
    except Exception as e:
        db.rollback()
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error procesando cobro: {str(e)}")

@router.get("/hoy")
def obtener_cobros_hoy(fecha: str = None, db: Session = Depends(get_db)):
    try:
        if fecha:
            hoy = datetime.strptime(fecha, "%Y-%m-%d").date()
        else:
            hoy = datetime.now().date()
        start_of_day = datetime.combine(hoy, time.min)
        end_of_day = datetime.combine(hoy, time.max)
        cobros = db.query(Cobro).filter(Cobro.fecha >= start_of_day, Cobro.fecha <= end_of_day).order_by(Cobro.fecha.desc()).all()
        total_dia = sum((c.total or 0.0) for c in cobros)
        total_comisiones = 0.0
        detalle_cobros = []
        for c in cobros:
            comision_cobro = 0.0
            msg_servicios = []
            for det in c.detalles:
                comision_cobro += (det.monto_comision_recepcionista or 0.0) + (det.monto_comision_especialista or 0.0)
                msg_servicios.append(det.servicio_nombre or "Servicio")
            total_comisiones += comision_cobro
            detalle_cobros.append({
                "id": c.id,
                "hora": c.fecha.strftime("%H:%M"),
                "cliente": c.cliente.nombre_completo if c.cliente else "Desconocido",
                "monto_total": max(0.0, (c.total or 0.0) - (c.monto_abonado or 0.0)),
                "monto_abonado": c.monto_abonado or 0.0,
                "deuda": 0.0, 
                "monto": c.total or 0.0,
                "metodo": c.metodo_pago,
                "servicios": ", ".join(msg_servicios),
                "referencia": c.referencia or "-",
                "comisiones_generadas": comision_cobro,
                "tasa_bcv": c.tasa_bcv or None
            })
        return {"fecha": hoy.isoformat(), "total_cobrado": total_dia, "total_comisiones": total_comisiones, "cobros": detalle_cobros}
    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")

@router.get("/nomina/historico")
def obtener_nomina_historico(start_date: str, end_date: str, db: Session = Depends(get_db)):
    try:
        f_inicio = datetime.strptime(start_date, "%Y-%m-%d")
        f_fin = datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59)
    except:
        raise HTTPException(status_code=400, detail="Formato fecha invalido")

    from backend.modules.staff.models import Empleado
    from backend.modules.servicios.models import PaqueteSpa
    
    def parse_zonas(zonas_str):
        if not zonas_str: return 0
        try:
            nums = [int(n) for n in re.findall(r'\d+', str(zonas_str))]
            return max(nums) if nums else 0
        except: return 0
            
    nomina = {} 
    def get_or_create_emp(emp_id):
        if emp_id not in nomina:
            emp = db.query(Empleado).filter(Empleado.id == emp_id).first()
            if emp:
                nomina[emp_id] = {
                    "empleado_id": emp.id,
                    "nombre": emp.nombre_completo,
                    "rol": emp.rol,
                    "total_pagar": 0.0,
                    "total_zonas": 0,
                    "total_limpiezas": 0,
                    "total_comisiones": 0.0,
                    "total_ventas_base": 0.0,
                    "detalles_cobros": []
                }
        return nomina.get(emp_id)

    # REPORTE NOMINA (Christopher Logic)
    detalles = db.query(DetalleCobro).join(Cobro).filter(Cobro.fecha >= f_inicio, Cobro.fecha <= f_fin).all()
    for d in detalles:
        c = d.cobro
        # Recep
        if d.recepcionista_id:
            e = get_or_create_emp(d.recepcionista_id)
            if e:
                com = d.monto_comision_recepcionista or 0.0
                e["total_comisiones"] += com
                e["total_pagar"] += com
        # Spec
        if d.especialista_id:
            e = get_or_create_emp(d.especialista_id)
            if e:
                com = d.monto_comision_especialista or 0.0
                e["total_comisiones"] += com
                e["total_pagar"] += com
                
                # Zonas and Limpiezas
                svc = db.query(PaqueteSpa).filter(PaqueteSpa.id == d.servicio_id).first()
                if svc:
                    if svc.es_limpieza:
                        e["total_limpiezas"] += 1
                    e["total_zonas"] += parse_zonas(svc.zonas)

    return list(nomina.values())
