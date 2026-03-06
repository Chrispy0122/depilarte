from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List, Optional
from backend.database import get_db
from . import models, schemas

router = APIRouter(
    prefix="/api/pacientes",
    tags=["Pacientes"]
)

@router.post("/", response_model=schemas.Cliente)
def crear_cliente(cliente: schemas.ClienteCreate, db: Session = Depends(get_db)):
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
    db.add(nuevo_cliente)
    db.commit()
    db.refresh(nuevo_cliente)
    return nuevo_cliente

@router.get("/", response_model=List[schemas.Cliente])
def listar_clientes(skip: int = 0, limit: int = 1000, q: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(models.Cliente)
    
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
    
    # Pre-fetch all cobros for this client to match services by date/client if direct relation isn't clear
    # In Depilarte, Pagos link to Citas, and Cobros link to Cliente.  
    # To get exact sale type, let's grab the Cobro Detalles of the same day.
    
    historial_data = []
    
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
                total_pagado += servicio.precio_sesion
                
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
        
    # We need to attach this to the Pydantic model response
    # Since SQLAlchemy models don't have this field, we might need to convert to dict or use an adapter
    # But Pydantic's from_attributes=True usually looks for attributes on the object.
    # We can just set the attribute on the instance if it's not a frozen model, or return a dict.
    # However, 'cliente' is an ORM object. Best way is to construct the Pydantic model explicitly or
    # Monkey-patch the instance for this request (risky but works for simple cases)
    # Better: Return a dict that matches Schema
    
    # Monkey-patch or construct dict to ensure name availability
    # Check if nombre_completo is missing/empty and try to recover from historia_clinica
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

@router.get("/{cliente_id}/historial", response_model=List[schemas.HistorialItem])
def historial_cliente(cliente_id: int, db: Session = Depends(get_db)):
    # Import Cita model here to avoid circular imports if any, or assume it's available via models
    from backend.modules.agenda.models import Cita, EstadoCita
    from backend.modules.cobranza.models import Pago, Cobro, DetalleCobro
    
    # Filter Citas
    citas = db.query(Cita).filter(
        Cita.cliente_id == cliente_id,
        Cita.estado.in_([EstadoCita.CONFIRMADA, EstadoCita.ASISTIO, "completada", "pagada"]) # Add loose strings just in case
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
                total_pagado += servicio.precio_sesion
                
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
