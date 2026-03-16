from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime, timedelta
from backend.database import get_db
from backend.modules.agenda import models, schemas
from backend.modules.pacientes import models as pacientes_models

router = APIRouter(tags=["Agenda"])

# --- Módulo Agenda ---

@router.get("/appointments", response_model=List[schemas.Cita])
def get_appointments(
    day: Optional[int] = None,
    month: Optional[int] = None,
    year: Optional[int] = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.Cita).options(joinedload(models.Cita.cliente))
    
    if year:
        query = query.filter(func.extract('year', models.Cita.fecha_hora_inicio) == year)
    if month:
        query = query.filter(func.extract('month', models.Cita.fecha_hora_inicio) == month)
    if day:
        query = query.filter(func.extract('day', models.Cita.fecha_hora_inicio) == day)
        
    return query.all()

@router.post("/appointments", response_model=schemas.Cita)
def create_appointment(cita: schemas.CitaCreate, db: Session = Depends(get_db)):
    db_cita = models.Cita(**cita.dict())
    db.add(db_cita)
    db.commit()
    db.refresh(db_cita)
    return db_cita

@router.patch("/appointments/{id}/status", response_model=schemas.Cita)
def update_appointment_status(id: int, status_update: schemas.CitaUpdateStatus, db: Session = Depends(get_db)):
    db_cita = db.query(models.Cita).filter(models.Cita.id == id).first()
    if not db_cita:
        raise HTTPException(status_code=404, detail="Cita not found")
    
    db_cita.estado = status_update.estado
    db.commit()
    db.refresh(db_cita)
    return db_cita

@router.post("/appointments/{id}/rebook", response_model=schemas.Cita)
def agendar_seguimiento(
    id: int, 
    rebook_data: schemas.CitaCreate,
    db: Session = Depends(get_db)
):
    # 1. Buscar la cita original
    cita_actual = db.query(models.Cita).filter(models.Cita.id == id).first()
    if not cita_actual:
        raise HTTPException(status_code=404, detail="Cita original no encontrada.")
    
    # 2. Actualizar estado de la cita actual
    # Usando el string "asistio" o su valor enum si está definido
    cita_actual.estado = models.EstadoCita.ASISTIO.value if hasattr(models.EstadoCita, "ASISTIO") else "asistio"
    
    # 3. Validar cliente de la nueva cita (debería ser el mismo)
    if cita_actual.cliente_id != rebook_data.cliente_id:
        # Solo como validación cruzada. Usamos el proporcionado o el original
        pass

    # 4. Calcular el fin de la nueva cita (Reusing same logic as creation)
    servicios = db.query(models.Servicio).filter(models.Servicio.id.in_(rebook_data.servicios_ids)).all()
    if not servicios or len(servicios) != len(rebook_data.servicios_ids):
        raise HTTPException(status_code=404, detail="Uno o más servicios no encontrados")

    if rebook_data.duracion_total and rebook_data.duracion_total > 0:
        total_duracion = rebook_data.duracion_total
    else:
        total_duracion = sum([s.duracion_minutos for s in servicios])
        if total_duracion == 0: total_duracion = 20
        
    fecha_fin = rebook_data.fecha_hora_inicio + timedelta(minutes=total_duracion)

    # 5. Crear la nueva cita para la fecha futura
    nueva_cita = models.Cita(
        cliente_id=rebook_data.cliente_id,
        fecha_hora_inicio=rebook_data.fecha_hora_inicio,
        fecha_hora_fin=fecha_fin,
        estado=models.EstadoCita.PENDIENTE.value if hasattr(models.EstadoCita, "PENDIENTE") else "pendiente"
    )
    
    # 6. Asignar servicios
    nueva_cita.servicios = servicios

    db.add(nueva_cita)
    db.commit()
    db.refresh(nueva_cita)
    return nueva_cita

# --- Módulo Clientes ---

@router.get("/clientes", response_model=List[schemas.Cliente])
def get_clients(db: Session = Depends(get_db)):
    return db.query(models.Cliente).all()

@router.post("/", response_model=schemas.Cita)
def crear_cita(cita: schemas.CitaCreate, db: Session = Depends(get_db)):
    # 1. Validate Client
    cliente = db.query(pacientes_models.Cliente).filter(pacientes_models.Cliente.id == cita.cliente_id).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    
    # 2. Validate Services (List)
    servicios = db.query(models.Servicio).filter(models.Servicio.id.in_(cita.servicios_ids)).all()
    if not servicios or len(servicios) != len(cita.servicios_ids):
        raise HTTPException(status_code=404, detail="Uno o más servicios no encontrados")

    # 3. Calculate End Time
    if cita.duracion_total and cita.duracion_total > 0:
        total_duracion = cita.duracion_total
    else:
        total_duracion = sum([s.duracion_minutos for s in servicios])
        # Ensure at least 20 mins if 0
        if total_duracion == 0: total_duracion = 20

    fecha_fin = cita.fecha_hora_inicio + timedelta(minutes=total_duracion)

    # 4. Create Cita
    nueva_cita = models.Cita(
        cliente_id=cita.cliente_id,
        # No single servicio_id
        fecha_hora_inicio=cita.fecha_hora_inicio,
        fecha_hora_fin=fecha_fin,
        estado="pendiente"
    )
    
    # Associate Services
    nueva_cita.servicios = servicios

    db.add(nueva_cita)
    db.commit()
    db.refresh(nueva_cita)
    return nueva_cita

@router.get("/", response_model=List[schemas.Cita])
def listar_citas(db: Session = Depends(get_db)):
    # Eager load relations for performance and cleaner JSON
    citas = db.query(models.Cita).options(
        joinedload(models.Cita.cliente),
        joinedload(models.Cita.servicios) # Updated to plural
    ).all()
    return citas

# --- Módulo Servicios ---

@router.post("/servicios", response_model=schemas.Servicio)
def create_service(servicio: schemas.ServicioCreate, db: Session = Depends(get_db)):
    db_servicio = models.Servicio(**servicio.dict())
    db.add(db_servicio)
    db.commit()
    db.refresh(db_servicio)
    return db_servicio

@router.get("/servicios", response_model=List[schemas.Servicio])
def list_services(db: Session = Depends(get_db)):
    return db.query(models.Servicio).all()

@router.get("/debug/populate")
def populate_services_debug(db: Session = Depends(get_db)):
    servicios_data = [
        {"nombre": "Axilas", "duracion_minutos": 20, "precio_sesion": 15.0},
        {"nombre": "Piernas Completas", "duracion_minutos": 40, "precio_sesion": 40.0},
        {"nombre": "Media Pierna", "duracion_minutos": 20, "precio_sesion": 25.0},
        {"nombre": "Bozo", "duracion_minutos": 10, "precio_sesion": 10.0},
        {"nombre": "Bikini", "duracion_minutos": 20, "precio_sesion": 20.0},
        {"nombre": "Full Body", "duracion_minutos": 60, "precio_sesion": 100.0},
        {"nombre": "Rostro", "duracion_minutos": 20, "precio_sesion": 25.0},
        {"nombre": "Espalda", "duracion_minutos": 30, "precio_sesion": 35.0}
    ]
    added = []
    for s in servicios_data:
        exists = db.query(models.Servicio).filter(models.Servicio.nombre == s["nombre"]).first()
        if not exists:
            new_svc = models.Servicio(**s)
            db.add(new_svc)
            added.append(s["nombre"])
    db.commit()
    return {"status": "populated", "added": added}

# --- Endpoint: Último Tratamiento por Paciente ---

@router.get("/ultimo-tratamiento/{paciente_id}")
def get_ultimo_tratamiento(paciente_id: int, db: Session = Depends(get_db)):
    """
    Retorna los IDs de los servicios de la cita más reciente del paciente.
    Si no tiene citas previas, retorna lista vacía.
    """
    ultima_cita = (
        db.query(models.Cita)
        .options(joinedload(models.Cita.servicios))
        .filter(models.Cita.cliente_id == paciente_id)
        .order_by(models.Cita.fecha_hora_inicio.desc())
        .first()
    )
    if not ultima_cita or not ultima_cita.servicios:
        return []
    return [s.id for s in ultima_cita.servicios]

# --- Endpoint: Reagendar Cita ---

@router.put("/reagendar/{cita_id}")
def reagendar_cita(cita_id: int, data: schemas.CitaReagendar, db: Session = Depends(get_db)):
    """
    Mueve una cita a una nueva fecha/hora preservando duración, paciente y tratamientos.
    Resetea el estado a 'pendiente'.
    """
    cita = (
        db.query(models.Cita)
        .options(joinedload(models.Cita.servicios))
        .filter(models.Cita.id == cita_id)
        .first()
    )
    if not cita:
        raise HTTPException(status_code=404, detail="Cita no encontrada")

    duracion = cita.fecha_hora_fin - cita.fecha_hora_inicio
    cita.fecha_hora_inicio = data.fecha_hora_inicio
    cita.fecha_hora_fin = data.fecha_hora_inicio + duracion
    cita.estado = "pendiente"

    db.commit()
    db.refresh(cita)
    return {"ok": True, "id": cita.id}

# --- Módulo Presupuestos (Disabled for now) ---
# @router.post("/presupuestos", response_model=schemas.Presupuesto)
# def create_budget(presupuesto: schemas.PresupuestoCreate, db: Session = Depends(get_db)):
#     # Verify client exists
#     client = db.query(models.Cliente).filter(models.Cliente.id == presupuesto.cliente_id).first()
#     if not client:
#         raise HTTPException(status_code=404, detail="Client not found")
#         
#     db_presupuesto = models.Presupuesto(**presupuesto.dict())
#     db.add(db_presupuesto)
#     db.commit()
#     db.refresh(db_presupuesto)
#     return db_presupuesto
@router.get("/mis-citas-hoy", response_model=List[schemas.Cita])
def read_mis_citas_hoy(db: Session = Depends(get_db)):
    from datetime import datetime
    # Get current date (ignoring time)
    today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)
    
    # NEW RULE: Return ALL appointments for today, no matter who they are assigned to
    citas = db.query(models.Cita).options(
        joinedload(models.Cita.cliente),
        joinedload(models.Cita.servicios)
    ).filter(
        models.Cita.fecha_hora_inicio >= today_start,
        models.Cita.fecha_hora_inicio < today_end
    ).all()
    return citas
