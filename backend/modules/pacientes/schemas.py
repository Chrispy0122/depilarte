from typing import Optional, List
from pydantic import BaseModel
import datetime


class ServicioHistorial(BaseModel):
    nombre: str
    tipo_venta: str

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
    historia_clinica: Optional[dict] = None

class ClienteCreate(ClienteBase):
    pass

class Cliente(ClienteBase):
    id: int
    nombre: Optional[str] = None
    apellido: Optional[str] = None
    historial_citas: List[HistorialItem] = []

    class Config:
        from_attributes = True

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


# ── Historia Depilación ──────────────────────────────────────────────────────

class HistoriaDepilacionBase(BaseModel):
    # Bloque 2: Antecedentes
    epilepsia:           Optional[bool] = False
    ovario_poliquistico: Optional[bool] = False
    asma:                Optional[bool] = False
    gastricos:           Optional[bool] = False
    hipertension:        Optional[bool] = False
    hepaticos:           Optional[bool] = False
    alergias:            Optional[bool] = False
    hirsutismo:          Optional[bool] = False
    respiratorios:       Optional[bool] = False
    diabetes:            Optional[bool] = False
    artritis:            Optional[bool] = False
    cancer:              Optional[bool] = False
    analgesicos:         Optional[bool] = False
    antibioticos:        Optional[bool] = False

    # Bloque 3: Dermatológicos
    tipo_piel:            Optional[str]  = None
    aspecto_piel:         Optional[str]  = None
    bronceado:            Optional[bool] = False
    acne:                 Optional[bool] = False
    fuma:                 Optional[bool] = False
    alcohol:              Optional[bool] = False
    blanqueamientos_piel: Optional[bool] = False
    biopolimeros:         Optional[bool] = False
    botox:                Optional[bool] = False
    plasma:               Optional[bool] = False
    dermatitis:           Optional[bool] = False
    tatuajes:             Optional[bool] = False
    vitaminas:            Optional[bool] = False
    hilos_tensores:       Optional[bool] = False
    acido_hialuronico:    Optional[bool] = False

    # Bloque 4: Observaciones
    medicamentos_consumidos_ultimo_mes: Optional[str] = None
    metodo_anticonceptivo:              Optional[str] = None
    metodo_depilacion_utilizado:        Optional[str] = None
    otros:                              Optional[str] = None


class HistoriaDepilacionCreate(HistoriaDepilacionBase):
    pass


class HistoriaDepilacion(HistoriaDepilacionBase):
    id: int
    paciente_id: int

    class Config:
        from_attributes = True

