from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from backend.modules.pacientes.schemas import Cliente # Assuming this exists, or we define a simple one

class ServicioBase(BaseModel):
    nombre: str
    precio_sesion: float
    duracion_minutos: int

class ServicioCreate(ServicioBase):
    pass

class Servicio(ServicioBase):
    id: int
    class Config:
        orm_mode = True

class ClienteSimple(BaseModel):
    id: int
    nombre_completo: str
    class Config:
        orm_mode = True

class ClienteCreate(BaseModel):
    nombre_completo: str
    cedula: str
    telefono: Optional[str] = None
    email: Optional[str] = None

class CitaCreate(BaseModel):
    cliente_id: int
    servicios_ids: List[int]
    fecha_hora_inicio: datetime
    duracion_total: Optional[int] = None  # In minutes

class CitaUpdateStatus(BaseModel):
    estado: str

class Cita(BaseModel):
    id: int
    fecha_hora_inicio: datetime
    fecha_hora_fin: datetime
    estado: str
    
    cliente: Optional[ClienteSimple]
    servicios: List[Servicio] = [] # Changed from single Service to List

    class Config:
        orm_mode = True
