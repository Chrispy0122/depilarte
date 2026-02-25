from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class DetalleCobroCreate(BaseModel):
    servicio_id: int
    tipo_venta: str # 'sesion' or 'paquete'
    precio_aplicado: float
    recepcionista_id: Optional[int] = None
    especialista_id: Optional[int] = None

class CobroCreate(BaseModel):
    cliente_id: int
    items: List[DetalleCobroCreate]
    metodo_pago: str
    referencia: Optional[str] = None
    fecha_proxima: Optional[str] = None # YYYY-MM-DD
    
    # Partial Payment
    monto_abonado: Optional[float] = None # Now refers to Wallet Top-Up
    monto_wallet_usado: Optional[float] = 0.0
