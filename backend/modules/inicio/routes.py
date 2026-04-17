from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload
from datetime import datetime, date, time, timedelta
from backend.database import get_db
from backend.modules.agenda import models
from backend.modules.inicio import schemas

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

def __get_week_boundaries(base_date: date):
    """Calcula el inicio (Lunes 00:00:00) y fin (Domingo 23:59:59) de la semana para una fecha dada"""
    start_date = base_date - timedelta(days=base_date.weekday())
    end_date = start_date + timedelta(days=6)
    return datetime.combine(start_date, time.min), datetime.combine(end_date, time.max)

@router.get("/week-appointments", response_model=schemas.WeekAppointments)
def get_week_appointments(db: Session = Depends(get_db)):
    today = date.today()
    
    # 1. Lógica de Fechas (Estrictamente semanal: Lunes a Domingo)
    cw_start, cw_end = __get_week_boundaries(today)
    
    # Próxima semana (Lunes a Domingo)
    next_week_date = today + timedelta(days=7)
    nw_start, nw_end = __get_week_boundaries(next_week_date)
    
    # 2. Queries Separados eficientes
    def count_citas(start_dt, end_dt):
        # Query para citas confirmadas (incluye equivalentes a éxito)
        confirmadas = db.query(models.Cita).filter(
            models.Cita.fecha_hora_inicio >= start_dt,
            models.Cita.fecha_hora_inicio <= end_dt,
            models.Cita.estado.in_([
                'confirmada', 'Confirmada', 'asistio', 'Asistio', 'Asistió', 'asistió', 'pagada', 'Pagada'
            ])
        ).count()
        
        # Query para citas agendadas/pendientes
        pendientes = db.query(models.Cita).filter(
            models.Cita.fecha_hora_inicio >= start_dt,
            models.Cita.fecha_hora_inicio <= end_dt,
            models.Cita.estado.in_([
                'pendiente', 'Pendiente', 'agendada', 'Agendada'
            ])
        ).count()
        
        return {"confirmadas": confirmadas, "pendientes": pendientes}

    # 3. Estructura de Respuesta JSON limpia estructurada por semanas
    return {
        "current_week": count_citas(cw_start, cw_end),
        "next_week": count_citas(nw_start, nw_end)
    }

from sqlalchemy import or_

@router.get("/today-stats", response_model=schemas.TodayStats)
def get_today_stats(db: Session = Depends(get_db)):
    today = date.today()
    start_dt = datetime.combine(today, time.min)
    end_dt = datetime.combine(today, time.max)
    
    total = db.query(models.Cita).filter(
        models.Cita.fecha_hora_inicio >= start_dt,
        models.Cita.fecha_hora_inicio <= end_dt
    ).count()
    
    confirmed = db.query(models.Cita).filter(
        models.Cita.fecha_hora_inicio >= start_dt,
        models.Cita.fecha_hora_inicio <= end_dt,
        or_(
            models.Cita.estado == 'confirmada',
            models.Cita.estado == 'Confirmada',
            models.Cita.estado == 'asistio',
            models.Cita.estado == 'Asistio',
            models.Cita.estado == 'pagada'
        )
    ).count()
    
    return {"total_citas": total, "confirmed_citas": confirmed}

@router.get("/confirmed-stats", response_model=schemas.ConfirmedStats)
def get_confirmed_stats(db: Session = Depends(get_db)):
    now = datetime.now()
    count = db.query(models.Cita).filter(
        models.Cita.fecha_hora_inicio > now,
        or_(
            models.Cita.estado == 'confirmada',
            models.Cita.estado == 'Confirmada',
            models.Cita.estado == 'asistio', # Just in case
            models.Cita.estado == 'pagada'
        )
    ).count()
    return {"future_confirmed": count}
