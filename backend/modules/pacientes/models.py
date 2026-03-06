from sqlalchemy import Column, Integer, String, Float, Date, JSON, Boolean, Text, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from backend.database import Base

class Cliente(Base):
    __tablename__ = "clientes"

    id = Column(Integer, primary_key=True, index=True)
    nombre_completo = Column(String(100), index=True)
    cedula = Column(String(20), unique=True, index=True, nullable=False)
    numero_historia = Column(String(50), unique=True, index=True, nullable=False)
    telefono = Column(String(20))
    email = Column(String(100), nullable=True)
    frecuencia_visitas = Column(Integer, default=21) # Días entre sesiones
    saldo_wallet = Column(Float, default=0.0)
    fecha_proxima_estimada = Column(Date, nullable=True)
    historia_clinica = Column(JSON, nullable=True)

    # Relación with Citas
    citas = relationship("backend.modules.agenda.models.Cita", foreign_keys="[backend.modules.agenda.models.Cita.cliente_id]", overlaps="cliente")
    
    # Relationship with HistoriaDepilacion (one-to-one)
    historia_depilacion = relationship("HistoriaDepilacion", back_populates="paciente", uselist=False)


class HistoriaDepilacion(Base):
    """Historia Clínica específica de Depilación (planilla física Depilarte)."""
    __tablename__ = "historias_depilacion"

    id = Column(Integer, primary_key=True, index=True)
    paciente_id = Column(Integer, ForeignKey("clientes.id"), unique=True, nullable=False)

    # ── 2. ANTECEDENTES PERSONALES (Boolean) ──────────────────────────────────
    epilepsia           = Column(Boolean, default=False)
    ovario_poliquistico = Column(Boolean, default=False)
    asma                = Column(Boolean, default=False)
    gastricos           = Column(Boolean, default=False)
    hipertension        = Column(Boolean, default=False)
    hepaticos           = Column(Boolean, default=False)
    alergias            = Column(Boolean, default=False)
    hirsutismo          = Column(Boolean, default=False)
    respiratorios       = Column(Boolean, default=False)
    diabetes            = Column(Boolean, default=False)
    artritis            = Column(Boolean, default=False)
    cancer              = Column(Boolean, default=False)
    analgesicos         = Column(Boolean, default=False)
    antibioticos        = Column(Boolean, default=False)

    # ── 3. DERMATOLÓGICOS ─────────────────────────────────────────────────────
    tipo_piel            = Column(String(50), nullable=True)   # Ej: "Seca", "Grasa", "Mixta"
    aspecto_piel         = Column(String(50), nullable=True)   # "Hidratada" / "Deshidratada"
    bronceado            = Column(Boolean, default=False)
    fuma                 = Column(Boolean, default=False)
    blanqueamientos_piel = Column(Boolean, default=False)
    botox                = Column(Boolean, default=False)
    acne                 = Column(Boolean, default=False)
    alcohol              = Column(Boolean, default=False)
    biopolimeros         = Column(Boolean, default=False)
    plasma               = Column(Boolean, default=False)
    dermatitis           = Column(Boolean, default=False)
    tatuajes             = Column(Boolean, default=False)
    vitaminas            = Column(Boolean, default=False)
    hilos_tensores       = Column(Boolean, default=False)
    acido_hialuronico    = Column(Boolean, default=False)

    # ── 4. OBSERVACIONES (Text) ───────────────────────────────────────────────
    medicamentos_ultimo_mes      = Column(Text, nullable=True)
    metodo_anticonceptivo        = Column(String(100), nullable=True)
    metodo_depilacion_utilizado  = Column(String(100), nullable=True)
    otros                        = Column(Text, nullable=True)

    # Relación inversa
    paciente = relationship("Cliente", back_populates="historia_depilacion")
