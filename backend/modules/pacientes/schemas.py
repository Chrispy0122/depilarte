from typing import Optional, List
from pydantic import BaseModel
import datetime
import datetime


class ServicioHistorial(BaseModel):
    nombre: str
    tipo_venta: str  # e.g., 'sesion', 'paquete', 'promocion', etc.

class HistorialItem(BaseModel):
    fecha: datetime.date
    servicios_detalle: List[ServicioHistorial]
    monto_total: float
    pagos: List[str]
    asistio: bool

class ClienteBase(BaseModel):
    nombre_completo: str
    cedula: str
    numero_historia: str
    telefono: Optional[str] = None
    email: Optional[str] = None
    saldo_wallet: Optional[float] = 0.0
    fecha_proxima_estimada: Optional[datetime.date] = None
    historia_clinica: Optional[dict] = None # Expose full JSON

class ClienteCreate(ClienteBase):
    pass

class Cliente(ClienteBase):
    id: int
    # Extra fields for frontend convenience
    nombre: Optional[str] = None
    apellido: Optional[str] = None
    historial_citas: List[HistorialItem] = []

    class Config:
        from_attributes = True

# Schemas for the new DB-backed HistorialClinico (if used)
class HistorialClinicoBase(BaseModel):
    fecha: datetime.date
    descripcion: str
    monto: Optional[float] = 0.0

class HistorialClinicoCreate(HistorialClinicoBase):
    pass

class HistorialClinico(HistorialClinicoBase):
    id: int
    cliente_id: int

    class Config:
        from_attributes = True
