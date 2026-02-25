from sqlalchemy import Column, Integer, String, Float, Date, JSON
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
    
    # Relationship with Presupuesto (legacy/mixed support)
    # presupuestos = relationship("backend.models.Presupuesto", back_populates="cliente")
