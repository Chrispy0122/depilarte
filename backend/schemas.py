from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from enum import Enum

# Enums
class TipoTransaccionEnum(str, Enum):
    CREDITO = "CREDITO"
    DEBITO = "DEBITO"

class EstadoCitaEnum(str, Enum):
    Pendiente = "Pendiente"
    Confirmada = "Confirmada"
    Cancelada = "Cancelada"
    Asistio = "Asistió"
    # Legacy / DB Uppercase Compatibility
    PENDIENTE = "PENDIENTE"
    CONFIRMADA = "CONFIRMADA"
    CANCELADA = "CANCELADA"
    ASISTIO = "ASISTIO"

# Servicio Schemas
class ServicioBase(BaseModel):
    nombre: str
    descripcion: Optional[str] = None
    precio_sesion: float
    precio_paquete: Optional[float] = None
    duracion_minutos: int = 30
    categoria: str = "General"
    dias_recuperacion: Optional[int] = 21

class ServicioCreate(ServicioBase):
    pass

class Servicio(ServicioBase):
    id: int
    class Config:
        orm_mode = True

# Cliente Schemas
class ClienteBase(BaseModel):
    numero_historia: str
    nombre_completo: str
    telefono: Optional[str] = None
    historia_clinica: Optional[dict] = None
    # saldo_favor removed

class ClienteCreate(ClienteBase):
    pass

class Cliente(ClienteBase):
    id: int
    class Config:
        orm_mode = True

# Presupuesto Schemas
class PresupuestoBase(BaseModel):
    nombre_tratamiento: str
    total_citas: int
    monto_total: float
    activo: int = 1

class PresupuestoCreate(PresupuestoBase):
    cliente_id: int

class Presupuesto(PresupuestoBase):
    id: int
    cliente_id: int
    class Config:
        orm_mode = True

# Cita Schemas
class CitaBase(BaseModel):
    fecha_hora_inicio: datetime
    fecha_hora_fin: datetime
    estado: EstadoCitaEnum = EstadoCitaEnum.Pendiente

class CitaCreate(CitaBase):
    cliente_id: int

class CitaUpdateStatus(BaseModel):
    estado: EstadoCitaEnum

class Cita(CitaBase):
    id: int
    cliente_id: int
    cliente: Optional[Cliente] = None
    class Config:
        orm_mode = True

# Dashboard Stats Schemas
class WeekAppointments(BaseModel):
    current_week: List[Cita]
    next_week: List[Cita]

class TodayStats(BaseModel):
    total_citas: int
    confirmed_citas: int

class ConfirmedStats(BaseModel):
    future_confirmed: int
