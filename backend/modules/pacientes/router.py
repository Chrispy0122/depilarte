from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from typing import List, Optional
from pydantic import BaseModel
import re
import uuid
from backend.database import get_db
from . import models, schemas

router = APIRouter(
    prefix="/api/pacientes",
    tags=["Pacientes"]
)

class DummyUsuario:
    def __init__(self, negocio_id: int):
        self.negocio_id = negocio_id

def get_current_usuario(authorization: str = Header(None)):
    if authorization:
        match = re.search(r"tenant-(\d+)", authorization)
        if match:
            return DummyUsuario(negocio_id=int(match.group(1)))
    # Fallback default tenant for safety if token is missing
    return DummyUsuario(negocio_id=1)

@router.post("/", response_model=schemas.Cliente)
def crear_cliente(
    cliente: schemas.ClienteCreate, 
    db: Session = Depends(get_db),
    usuario_actual: DummyUsuario = Depends(get_current_usuario)
):
    # Generar automáticamente si vienen vacíos (Registro Express)
    if not cliente.cedula or not str(cliente.cedula).strip():
        cliente.cedula = f"EXP-CED-{uuid.uuid4().hex[:8].upper()}"
        
    if not cliente.numero_historia or not str(cliente.numero_historia).strip():
        cliente.numero_historia = f"EXP-HIST-{uuid.uuid4().hex[:8].upper()}"

    # Validar Historial Único
    if db.query(models.Cliente).filter(models.Cliente.numero_historia == cliente.numero_historia).first():
        raise HTTPException(status_code=400, detail=f"El número de historia {cliente.numero_historia} ya está en uso. Por favor verifique.")

    # Validar Cédula Única
    if db.query(models.Cliente).filter(models.Cliente.cedula == cliente.cedula).first():
        raise HTTPException(status_code=400, detail="La Cédula ya está registrada")
    
    nuevo_cliente = models.Cliente(
        nombre_completo=cliente.nombre_completo,
        cedula=cliente.cedula,
        numero_historia=cliente.numero_historia,
        telefono=cliente.telefono,
        email=cliente.email,
        saldo_wallet=cliente.saldo_wallet
    )
    
    # Asignar dinámicamente el ID del negocio
    nuevo_cliente.negocio_id = usuario_actual.negocio_id
    
    try:
        db.add(nuevo_cliente)
        db.commit()
        db.refresh(nuevo_cliente)
    except IntegrityError as e:
        db.rollback()
        # Verificar qué campo falló de manera más explícita
        error_str = str(e.orig).lower()
        if "cedula" in error_str:
             raise HTTPException(status_code=400, detail="La cédula especificada ya está registrada.")
        elif "numero_historia" in error_str:
             raise HTTPException(status_code=400, detail="El número de historia especificado ya está en uso.")
        raise HTTPException(status_code=400, detail="Error de integridad al guardar el paciente: Posible duplicado.")
        
    return nuevo_cliente

@router.get("/", response_model=List[schemas.Cliente])
def listar_clientes(
    skip: int = 0,
    limit: int = 1000,
    q: Optional[str] = None,
    db: Session = Depends(get_db),
    usuario_actual: DummyUsuario = Depends(get_current_usuario)
):
    query = db.query(models.Cliente).options(joinedload(models.Cliente.paquetes)).filter(
        models.Cliente.negocio_id == usuario_actual.negocio_id,
        models.Cliente.eliminado == False  # Excluir pacientes con soft-delete
    )

    if q:
        if q.isdigit():
            query = query.filter(
                or_(
                    models.Cliente.id == int(q),
                    models.Cliente.nombre_completo.ilike(f"%{q}%")
                )
            )
        else:
            query = query.filter(models.Cliente.nombre_completo.ilike(f"%{q}%"))

    clientes = query.offset(skip).limit(limit).all()

    # Calculate and assign deuda_total dynamically before returning
    for cliente in clientes:
        # 1. Base debt (if exists on model in the future, fallback to 0.0)
        base_deuda = getattr(cliente, 'deuda', 0.0) or 0.0

        # 2. Extract fractional package debt
        deuda_paquetes = 0.0
        if hasattr(cliente, 'paquetes') and cliente.paquetes:
            for p in cliente.paquetes:
                # Calculate active package debt (cost - paid)
                if getattr(p, 'activo', True) and p.monto_pagado < p.costo_total:
                    deuda_paquetes += (p.costo_total - p.monto_pagado)

        # Virtual column mapping to Pydantic schema
        cliente.deuda_total = base_deuda + deuda_paquetes

    return clientes

@router.post("/{cliente_id}/historial-clinico", response_model=schemas.HistorialClinico)
def crear_historial(cliente_id: int, historial: schemas.HistorialClinicoCreate, db: Session = Depends(get_db)):
    cliente = db.query(models.Cliente).filter(models.Cliente.id == cliente_id).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    
    nuevo_historial = models.HistorialClinico(**historial.dict(), cliente_id=cliente_id)
    db.add(nuevo_historial)
    db.commit()
    db.refresh(nuevo_historial)
    return nuevo_historial

# ── PATCH: Actualizar Número de Historia ──────────────────────────────────────
class HistoriaUpdatePayload(BaseModel):
    numero_historia: str

@router.patch("/{cliente_id}/historia")
def actualizar_historia(
    cliente_id: int,
    payload: "HistoriaUpdatePayload",
    db: Session = Depends(get_db),
    usuario_actual: DummyUsuario = Depends(get_current_usuario)
):
    nuevo_num = payload.numero_historia.strip()
    if not nuevo_num:
        raise HTTPException(status_code=400, detail="El número de historia no puede estar vacío.")

    # Verificar duplicado dentro del mismo negocio (Multi-Tenant)
    duplicado = db.query(models.Cliente).filter(
        models.Cliente.numero_historia == nuevo_num,
        models.Cliente.negocio_id == usuario_actual.negocio_id,
        models.Cliente.id != cliente_id   # Excluir al mismo paciente
    ).first()

    if duplicado:
        raise HTTPException(
            status_code=400,
            detail="Este número de historia ya está en uso en su negocio."
        )

    # Actualizar
    cliente = db.query(models.Cliente).filter(
        models.Cliente.id == cliente_id,
        models.Cliente.negocio_id == usuario_actual.negocio_id
    ).first()

    if not cliente:
        raise HTTPException(status_code=404, detail="Paciente no encontrado.")

    cliente.numero_historia = nuevo_num
    db.commit()
    db.refresh(cliente)
    return {"ok": True, "numero_historia": cliente.numero_historia}

@router.get("/{cliente_id}/historial-clinico", response_model=List[schemas.HistorialClinico])
def obtener_historial_cliente(cliente_id: int, db: Session = Depends(get_db)):
    # Verify client exists
    cliente = db.query(models.Cliente).filter(models.Cliente.id == cliente_id).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
        
    historial = db.query(models.HistorialClinico).filter(models.HistorialClinico.cliente_id == cliente_id).order_by(models.HistorialClinico.fecha.desc()).all()
    return historial

@router.get("/{cliente_id}", response_model=schemas.Cliente)
def obtener_cliente(cliente_id: int, db: Session = Depends(get_db)):
    cliente = db.query(models.Cliente).filter(models.Cliente.id == cliente_id).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    
    # Populate historial_citas manually using the same logic as historial_cliente
    from backend.modules.agenda.models import Cita, EstadoCita
    
    # We need to extract the detailed services from Cobro to get the accurate 'tipo_venta'.
    from backend.modules.cobranza.models import Pago, Cobro, DetalleCobro
    
    citas = db.query(Cita).filter(
        Cita.cliente_id == cliente_id,
        Cita.estado.in_([EstadoCita.CONFIRMADA, EstadoCita.ASISTIO, "completada", "pagada"])
    ).order_by(Cita.fecha_hora_inicio.desc()).all()
    
    historial_data = []
    procesados_cobro_ids = set()
    
    for cita in citas:
        metodos = []
        total_pagado = 0.0
        
        # Determine actual paid money from Pago table
        for pago in cita.pagos:
            total_pagado += pago.monto
            metodos.append(f"{pago.metodo}: ${pago.monto}")
        
        # Fallback if no payments
        if total_pagado == 0 and cita.servicios:
            for servicio in cita.servicios:
                total_pagado += (servicio.precio_sesion or 0.0)
                
        # Find related DetalleCobros for this date (Approximation since Cita doesn't directly link to DetalleCobro)
        # We query Cobro by cliente_id and matching Date
        start_date = cita.fecha_hora_inicio.replace(hour=0, minute=0, second=0)
        end_date = cita.fecha_hora_inicio.replace(hour=23, minute=59, second=59)
        
        cobros_del_dia = db.query(Cobro).filter(
            Cobro.cliente_id == cliente_id,
            Cobro.fecha >= start_date,
            Cobro.fecha <= end_date
        ).all()
        
        servicios_detalle = []
        
        if cobros_del_dia:
             for cobro in cobros_del_dia:
                 if cobro.id in procesados_cobro_ids:
                     continue # Skip already processed cobros to avoid duplicates
                 procesados_cobro_ids.add(cobro.id)
                 
                 for detalle in cobro.detalles:
                     servicios_detalle.append({
                         "nombre": detalle.servicio_nombre or "Servicio Estético",
                         "tipo_venta": detalle.tipo_venta or "sesion"
                     })
        else:
             # Fallback to the services listed in the Agenda Cita (Assume individual session)
             for servicio in cita.servicios:
                 servicios_detalle.append({
                     "nombre": servicio.nombre,
                     "tipo_venta": "sesion" # Default fallback
                 })
                 
        if not servicios_detalle:
             servicios_detalle.append({
                 "nombre": "Consulta General",
                 "tipo_venta": "sesion"
             })
            
        historial_data.append({
            "fecha": cita.fecha_hora_inicio.date(),
            "servicios_detalle": servicios_detalle,
            "monto_total": total_pagado,
            "pagos": metodos if metodos else ["Sin registro de pago"],
            "asistio": cita.estado == EstadoCita.ASISTIO or cita.estado == "completada"
        })
        
    nombre_final = cliente.nombre_completo
    nombre_atomico = ""
    apellido_atomico = ""
    
    if not nombre_final or str(nombre_final).strip() == "":
        if cliente.historia_clinica and "personal" in cliente.historia_clinica:
             p_data = cliente.historia_clinica["personal"]
             n = p_data.get("nombre", "")
             a = p_data.get("apellido", "")
             if n or a:
                 nombre_final = f"{n} {a}".strip()
                 nombre_atomico = n
                 apellido_atomico = a
    else:
        # If nombre_completo DOES exist, try to split it to populate nombre/apellido for frontend
        try:
            parts = nombre_final.strip().split(" ", 1)
            nombre_atomico = parts[0]
            if len(parts) > 1:
                apellido_atomico = parts[1]
        except:
            pass
    
    cliente_dict = {
        "id": cliente.id,
        "nombre_completo": nombre_final if nombre_final else "Paciente Sin Nombre",
        "nombre": nombre_atomico, # Extra field for frontend
        "apellido": apellido_atomico, # Extra field for frontend
        "cedula": cliente.cedula,
        "numero_historia": cliente.numero_historia,
        "telefono": cliente.telefono,
        "email": cliente.email,
        "saldo_wallet": cliente.saldo_wallet,
        "fecha_proxima_estimada": cliente.fecha_proxima_estimada,
        "historia_clinica": cliente.historia_clinica,
        "historial_citas": historial_data
    }
    
    return cliente_dict

@router.put("/{cliente_id}", response_model=schemas.Cliente)
def actualizar_cliente(
    cliente_id: int,
    data: schemas.ClienteUpdate,
    db: Session = Depends(get_db)
):
    """Actualiza los datos básicos del paciente (sin tocar historias clínicas relacionadas)."""
    cliente = db.query(models.Cliente).filter(models.Cliente.id == cliente_id).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")

    # Validar cédula única si se está cambiando
    if data.cedula and data.cedula != cliente.cedula:
        if db.query(models.Cliente).filter(
            models.Cliente.cedula == data.cedula,
            models.Cliente.id != cliente_id
        ).first():
            raise HTTPException(status_code=409, detail="La cédula ya está registrada por otro paciente.")

    # Aplicar solo los campos que vienen en el payload
    update_data = data.dict(exclude_unset=True)
    for field, val in update_data.items():
        setattr(cliente, field, val)

    db.commit()
    db.refresh(cliente)

    # Rebuild the response dict (same logic as GET /{cliente_id})
    nombre_final = cliente.nombre_completo or "Paciente Sin Nombre"
    try:
        parts = nombre_final.strip().split(" ", 1)
        nombre_atomico = parts[0]
        apellido_atomico = parts[1] if len(parts) > 1 else ""
    except Exception:
        nombre_atomico = ""
        apellido_atomico = ""

    return {
        "id": cliente.id,
        "nombre_completo": nombre_final,
        "nombre": nombre_atomico,
        "apellido": apellido_atomico,
        "cedula": cliente.cedula,
        "numero_historia": cliente.numero_historia,
        "telefono": cliente.telefono,
        "email": cliente.email,
        "saldo_wallet": cliente.saldo_wallet,
        "fecha_proxima_estimada": cliente.fecha_proxima_estimada,
        "historia_clinica": cliente.historia_clinica,
        "historial_citas": [],
    }

# ─── SOFT DELETE ──────────────────────────────────────────────────────────────
@router.delete("/{cliente_id}", status_code=200)
def eliminar_cliente(
    cliente_id: int,
    db: Session = Depends(get_db),
    usuario_actual: DummyUsuario = Depends(get_current_usuario)
):
    """Soft Delete: marca el paciente como eliminado (eliminado=True).
    Los datos se conservan en la DB por integridad referencial (citas, cobros, historia).
    El paciente desaparece de todas las listas y consultas del sistema.
    """
    cliente = db.query(models.Cliente).filter(
        models.Cliente.id == cliente_id,
        models.Cliente.negocio_id == usuario_actual.negocio_id,  # Seguridad multi-tenant
        models.Cliente.eliminado == False
    ).first()

    if not cliente:
        raise HTTPException(
            status_code=404,
            detail="Paciente no encontrado o ya fue eliminado."
        )

    cliente.eliminado = True
    db.commit()
    return {"ok": True, "mensaje": f"Paciente '{cliente.nombre_completo}' eliminado correctamente."}


@router.get("/{cliente_id}/historial", response_model=List[schemas.HistorialItem])
def historial_cliente(cliente_id: int, db: Session = Depends(get_db)):
    from backend.modules.agenda.models import Cita, EstadoCita
    from backend.modules.cobranza.models import Pago, Cobro, DetalleCobro
    
    # Filter Citas
    citas = db.query(Cita).filter(
        Cita.cliente_id == cliente_id,
        Cita.estado.in_([EstadoCita.CONFIRMADA, EstadoCita.ASISTIO, "completada", "pagada"])
    ).order_by(Cita.fecha_hora_inicio.desc()).all()
    
    historial = []
    for cita in citas:
        # Calculate payments
        metodos = []
        total_pagado = 0.0
        for pago in cita.pagos:
            total_pagado += pago.monto
            metodos.append(f"{pago.metodo}: ${pago.monto}")
            
        # If no payments, calculate from servicios
        if total_pagado == 0 and cita.servicios:
            for servicio in cita.servicios:
                total_pagado += (servicio.precio_sesion or 0.0)
                
        # Get sale type details matching by date
        start_date = cita.fecha_hora_inicio.replace(hour=0, minute=0, second=0)
        end_date = cita.fecha_hora_inicio.replace(hour=23, minute=59, second=59)
        
        cobros_del_dia = db.query(Cobro).filter(
            Cobro.cliente_id == cliente_id,
            Cobro.fecha >= start_date,
            Cobro.fecha <= end_date
        ).all()
        
        servicios_detalle = []
        if cobros_del_dia:
             for cobro in cobros_del_dia:
                 for detalle in cobro.detalles:
                     servicios_detalle.append({
                         "nombre": detalle.servicio_nombre or "Servicio Estético",
                         "tipo_venta": detalle.tipo_venta or "sesion"
                     })
        else:
             for servicio in cita.servicios:
                 servicios_detalle.append({
                     "nombre": servicio.nombre,
                     "tipo_venta": "sesion"
                 })
                 
        if not servicios_detalle:
             servicios_detalle.append({
                 "nombre": "Consulta General",
                 "tipo_venta": "sesion"
             })
            
        historial.append({
            "fecha": cita.fecha_hora_inicio.date(),
            "servicios_detalle": servicios_detalle,
            "monto_total": total_pagado,
            "pagos": metodos if metodos else ["Sin registro de pago"],
            "asistio": cita.estado == EstadoCita.ASISTIO or cita.estado == "completada"
        })
        
    return historial


# ═══════════════════════════════════════════════════════════════════════════
# HISTORIA DEPILACIÓN
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/{paciente_id}/historia-depilacion", response_model=schemas.HistoriaDepilacion)
def get_historia_depilacion(paciente_id: int, db: Session = Depends(get_db)):
    """Retorna la historia de depilación del paciente. 404 si no existe."""
    if not db.query(models.Cliente).filter(models.Cliente.id == paciente_id).first():
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    h = db.query(models.HistoriaDepilacion).filter(
        models.HistoriaDepilacion.paciente_id == paciente_id
    ).first()
    if not h:
        raise HTTPException(status_code=404, detail="Sin historia de depilación")
    return h


@router.post("/{paciente_id}/historia-depilacion", response_model=schemas.HistoriaDepilacion)
def crear_historia_depilacion(
    paciente_id: int,
    data: schemas.HistoriaDepilacionCreate,
    db: Session = Depends(get_db)
):
    """Crea la historia de depilación (una por paciente)."""
    if not db.query(models.Cliente).filter(models.Cliente.id == paciente_id).first():
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    if db.query(models.HistoriaDepilacion).filter(
        models.HistoriaDepilacion.paciente_id == paciente_id
    ).first():
        raise HTTPException(status_code=409, detail="Ya existe. Use PUT para editar.")
    nueva = models.HistoriaDepilacion(**data.dict(), paciente_id=paciente_id)
    db.add(nueva)
    db.commit()
    db.refresh(nueva)
    return nueva


@router.put("/{paciente_id}/historia-depilacion", response_model=schemas.HistoriaDepilacion)
def editar_historia_depilacion(
    paciente_id: int,
    data: schemas.HistoriaDepilacionCreate,
    db: Session = Depends(get_db)
):
    """Actualiza la historia de depilación existente."""
    h = db.query(models.HistoriaDepilacion).filter(
        models.HistoriaDepilacion.paciente_id == paciente_id
    ).first()
    if not h:
        raise HTTPException(status_code=404, detail="Sin historia. Use POST primero.")
    for field, val in data.dict(exclude_unset=True).items():
        setattr(h, field, val)
    db.commit()
    db.refresh(h)
    return h


# ═══════════════════════════════════════════════════════════════════════════
# HISTORIA LIMPIEZA
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/{paciente_id}/historia-limpieza", response_model=schemas.HistoriaLimpieza)
def get_historia_limpieza(paciente_id: int, db: Session = Depends(get_db)):
    """Retorna la historia de limpieza facial del paciente. 404 si no existe."""
    if not db.query(models.Cliente).filter(models.Cliente.id == paciente_id).first():
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    h = db.query(models.HistoriaLimpieza).filter(
        models.HistoriaLimpieza.paciente_id == paciente_id
    ).first()
    if not h:
        raise HTTPException(status_code=404, detail="Sin historia de limpieza")
    return h


@router.post("/{paciente_id}/historia-limpieza", response_model=schemas.HistoriaLimpieza)
def crear_historia_limpieza(
    paciente_id: int,
    data: schemas.HistoriaLimpiezaCreate,
    db: Session = Depends(get_db)
):
    """Crea la historia de limpieza facial (una por paciente)."""
    if not db.query(models.Cliente).filter(models.Cliente.id == paciente_id).first():
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    if db.query(models.HistoriaLimpieza).filter(
        models.HistoriaLimpieza.paciente_id == paciente_id
    ).first():
        raise HTTPException(status_code=409, detail="Ya existe. Use PUT para editar.")
    nueva = models.HistoriaLimpieza(**data.dict(), paciente_id=paciente_id)
    db.add(nueva)
    db.commit()
    db.refresh(nueva)
    return nueva


@router.put("/{paciente_id}/historia-limpieza", response_model=schemas.HistoriaLimpieza)
def editar_historia_limpieza(
    paciente_id: int,
    data: schemas.HistoriaLimpiezaCreate,
    db: Session = Depends(get_db)
):
    """Actualiza la historia de limpieza facial existente."""
    h = db.query(models.HistoriaLimpieza).filter(
        models.HistoriaLimpieza.paciente_id == paciente_id
    ).first()
    if not h:
        raise HTTPException(status_code=404, detail="Sin historia. Use POST primero.")
    for field, val in data.dict(exclude_unset=True).items():
        setattr(h, field, val)
    db.commit()
    db.refresh(h)
    return h
