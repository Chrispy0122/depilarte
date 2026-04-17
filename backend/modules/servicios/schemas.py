from pydantic import BaseModel
from typing import Optional

class PaqueteSpaBase(BaseModel):
    codigo: str
    nombre: str
    sesion: int
    paquete_4_sesiones: Optional[int] = None
    num_zonas: Optional[str] = None
    cantidad_sesiones: Optional[str] = None
    comision_recepcionista: Optional[float] = 0.0
    comision_especialista: Optional[float] = 0.0
    categoria: str = "depilacion"
    activo: int = 1

class PaqueteSpaCreate(PaqueteSpaBase):
    pass

class PaqueteSpaResponse(PaqueteSpaBase):
    id: int
    
    class Config:
        from_attributes = True
