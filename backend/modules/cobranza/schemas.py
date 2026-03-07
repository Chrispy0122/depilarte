from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime


class DetalleCobroCreate(BaseModel):
    servicio_id: int
    tipo_venta: str  # 'sesion' or 'paquete'
    precio_aplicado: float
    recepcionista_id: Optional[int] = None
    especialista_id: Optional[int] = None
    tipo_cobro: str = "completo"  # 'completo' o 'fraccionado'
    sesiones_totales: int = 1     # Usado al vender un paquete fraccionado o completo


class CobroCreate(BaseModel):
    cliente_id: int
    items: List[DetalleCobroCreate]
    metodo_pago: str
    referencia: Optional[str] = None
    fecha_proxima: Optional[str] = None  # YYYY-MM-DD

    # Partial Payment
    monto_abonado: Optional[float] = None  # Wallet Top-Up
    monto_wallet_usado: Optional[float] = 0.0
    tasa_bcv: Optional[float] = None


# ── Paquetes / Cuponera (gestionados desde Cobranza) ────────────────────────
class PaqueteClienteCreate(BaseModel):
    nombre_paquete: str
    total_sesiones: int
    costo_total:    float   # precio total del paquete, ej. 32.0

class PaqueteClienteOut(BaseModel):
    id:              int
    paciente_id:     int
    nombre_paquete:  str
    total_sesiones:  int
    sesiones_usadas: int
    costo_total:     float
    monto_pagado:    float
    activo:          bool

    class Config:
        from_attributes = True

class AbonarSesionIn(BaseModel):
    monto: float  # lo que paga por esta sesión, ej. 8.0
