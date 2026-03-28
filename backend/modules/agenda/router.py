from fastapi import APIRouter, Depends, HTTPException, Header, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from typing import List, Optional
from datetime import datetime, timedelta
import re
from backend.database import get_db
from backend.modules.agenda import models, schemas
from backend.modules.pacientes import models as pacientes_models

# ─── Auth / Tenant ─────────────────────────────────────────────────────────
class DummyUsuario:
    def __init__(self, negocio_id: int):
        self.negocio_id = negocio_id

def get_current_usuario(authorization: str = Header(None)):
    """Extrae negocio_id del token JWT/fake-token almacenado en localStorage."""
    if authorization:
        match = re.search(r"tenant-(\d+)", authorization)
        if match:
            return DummyUsuario(negocio_id=int(match.group(1)))
    # Fallback al tenant 1 si no hay token (misma política que pacientes)
    return DummyUsuario(negocio_id=1)

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

@router.patch("/appointments/{id}/status", response_model=schemas.Cita)
def update_appointment_status(id: int, status_update: schemas.CitaUpdateStatus, db: Session = Depends(get_db)):
    db_cita = db.query(models.Cita).filter(models.Cita.id == id).first()
    if not db_cita:
        raise HTTPException(status_code=404, detail="Cita not found")
    
    db_cita.estado = status_update.estado

    # RETENCIÓN AUTOMÁTICA: Si la cita se cancela y el paciente no tiene otra cita
    # futura válida, mover su fecha_proxima_estimada a HOY para que el Dashboard
    # lo detecte de inmediato en la lista "Por Agendar" sin esperar la ventana de 14 días.
    ESTADOS_CANCELADOS = {'CANCELLED', 'cancelada', 'cancelado', 'cancelled'}
    if status_update.estado in ESTADOS_CANCELADOS:
        from backend.modules.pacientes import models as paciente_models
        from datetime import date

        cliente = db.query(paciente_models.Cliente).filter(
            paciente_models.Cliente.id == db_cita.cliente_id
        ).first()

        if cliente:
            # Buscar si tiene alguna otra cita futura no cancelada
            tiene_cita_futura = db.query(models.Cita).filter(
                models.Cita.cliente_id == db_cita.cliente_id,
                models.Cita.id != db_cita.id,           # excluir la que se cancela
                models.Cita.fecha_hora_inicio > datetime.now(),
                ~models.Cita.estado.in_(list(ESTADOS_CANCELADOS))
            ).first()

            if not tiene_cita_futura:
                # Sin citas futuras → empujar a la PROXIMA SEMANA para seguimiento.
                from datetime import timedelta as td
                cliente.fecha_proxima_estimada = date.today() + td(days=7)
                db.add(cliente)

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
    cita_actual.estado = models.EstadoCita.ASISTIO.value if hasattr(models.EstadoCita, "ASISTIO") else "asistio"
    
    # 3. Validar cliente de la nueva cita (debería ser el mismo)
    # (Optional cross-validation)

    # 4. Calcular el fin de la nueva cita
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
def crear_cita(
    cita: schemas.CitaCreate,
    db: Session = Depends(get_db),
    usuario_actual: DummyUsuario = Depends(get_current_usuario)
):
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
        if total_duracion == 0:
            total_duracion = 20

    fecha_fin = cita.fecha_hora_inicio + timedelta(minutes=total_duracion)

    # 4. Create Cita
    nueva_cita = models.Cita(
        cliente_id=cita.cliente_id,
        fecha_hora_inicio=cita.fecha_hora_inicio,
        fecha_hora_fin=fecha_fin,
        estado="pendiente"
    )

    # 5. Inyectar negocio_id
    nueva_cita.negocio_id = usuario_actual.negocio_id

    # 6. Associate Services
    nueva_cita.servicios = servicios

    try:
        db.add(nueva_cita)
        db.commit()
        db.refresh(nueva_cita)
        return nueva_cita
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Error de integridad al guardar la cita: {str(e.orig)}")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error inesperado al guardar la cita: {str(e)}")

@router.get("/", response_model=List[schemas.Cita])
def listar_citas(db: Session = Depends(get_db)):
    citas = db.query(models.Cita).options(
        joinedload(models.Cita.cliente),
        joinedload(models.Cita.servicios)
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

@router.get("/ultimo-tratamiento/{paciente_id}")
def get_ultimo_tratamiento(paciente_id: int, db: Session = Depends(get_db)):
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

@router.put("/reagendar/{cita_id}")
def reagendar_cita(cita_id: int, data: schemas.CitaReagendar, db: Session = Depends(get_db)):
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

@router.get("/mis-citas-hoy", response_model=List[schemas.Cita])
def read_mis_citas_hoy(
    fecha: Optional[str] = None,
    db: Session = Depends(get_db)
):
    from datetime import datetime, timedelta
    import logging
    
    logger = logging.getLogger("uvicorn.error")
    
    if fecha:
        try:
            target_date = datetime.strptime(fecha, "%Y-%m-%d")
        except ValueError:
            target_date = datetime.now()
    else:
        target_date = datetime.now()

    today_start = target_date.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)
    
    citas = db.query(models.Cita).options(
        joinedload(models.Cita.cliente),
        joinedload(models.Cita.servicios)
    ).filter(
        models.Cita.fecha_hora_inicio >= today_start,
        models.Cita.fecha_hora_inicio < today_end
    ).all()
    
    return citas
