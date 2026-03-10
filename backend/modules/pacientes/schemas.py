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

class ClienteUpdate(BaseModel):
    """Solo campos básicos del paciente — no toca historias."""
    nombre_completo:         Optional[str]  = None
    cedula:                  Optional[str]  = None
    telefono:                Optional[str]  = None
    email:                   Optional[str]  = None
    historia_clinica:        Optional[dict] = None   # para parchar datos personales internos

class Cliente(ClienteBase):
    id: int
    nombre: Optional[str] = None
    apellido: Optional[str] = None
    historial_citas: List[HistorialItem] = []
    deuda_total: Optional[float] = 0.0

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
    medicamentos_ultimo_mes:            Optional[str] = None
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


# ── Historia Limpieza ─────────────────────────────────────────────────────────

class HistoriaLimpiezaBase(BaseModel):
    # Estilo de vida
    fuma:                   Optional[bool] = False
    alcohol:                Optional[bool] = False
    comida_chatarra:        Optional[bool] = False
    agua_diaria:            Optional[str]  = None
    horas_sueno:            Optional[str]  = None
    actividad_fisica:       Optional[str]  = None

    # Antecedentes médicos faciales
    diabetes:               Optional[bool] = False
    hipertension:           Optional[bool] = False
    alergias:               Optional[bool] = False
    ovarios_poliquisticos:  Optional[bool] = False
    hormonas:               Optional[bool] = False
    anticonceptivos:        Optional[bool] = False
    biopolimeros:           Optional[bool] = False
    implantes:              Optional[bool] = False
    botox:                  Optional[bool] = False
    acido_hialuronico:      Optional[bool] = False

    # Diagnóstico facial
    biotipo_cutaneo:        Optional[str]  = None
    fototipo:               Optional[str]  = None
    pat_acne:               Optional[bool] = False
    pat_melasma:            Optional[bool] = False
    pat_rosacea:            Optional[bool] = False
    pat_cicatrices:         Optional[bool] = False
    observaciones:          Optional[str]  = None


class HistoriaLimpiezaCreate(HistoriaLimpiezaBase):
    pass


class HistoriaLimpieza(HistoriaLimpiezaBase):
    id: int
    paciente_id: int

    class Config:
        from_attributes = True
