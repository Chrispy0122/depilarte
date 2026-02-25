from pydantic import BaseModel
from typing import Optional

class EmpleadoBase(BaseModel):
    nombre_completo: str
    rol: str
    activo: Optional[int] = 1

class EmpleadoCreate(EmpleadoBase):
    pass

class Empleado(EmpleadoBase):
    id: int

    class Config:
        from_attributes = True
