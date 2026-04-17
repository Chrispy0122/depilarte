from pydantic import BaseModel
from typing import List
from backend.modules.agenda.schemas import Cita

# Dashboard Stats Schemas
class WeeklyCount(BaseModel):
    confirmadas: int
    pendientes: int

class WeekAppointments(BaseModel):
    current_week: WeeklyCount
    next_week: WeeklyCount

class TodayStats(BaseModel):
    total_citas: int
    confirmed_citas: int

class ConfirmedStats(BaseModel):
    future_confirmed: int
