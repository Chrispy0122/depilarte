from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float, Table
from sqlalchemy.orm import relationship
from backend.database import Base
import enum

# Association Table
cita_servicios = Table(
    'cita_servicios',
    Base.metadata,
    Column('id', Integer, primary_key=True, autoincrement=True),
    Column('cita_id', Integer, ForeignKey('citas.id', ondelete="CASCADE")),
    Column('servicio_id', Integer, ForeignKey('servicios.id', ondelete="CASCADE"))
)

class EstadoCita(str, enum.Enum):
    PENDIENTE = "pendiente"
    CONFIRMADA = "confirmada"
    CANCELADA = "cancelada"
    ASISTIO = "asistio"
    PAGADA = "pagada"


class Cita(Base):
    __tablename__ = "citas"

    id = Column(Integer, primary_key=True, index=True)
    cliente_id = Column(Integer, ForeignKey("clientes.id"), nullable=False)
    # servicio_id Removed in favor of M:N
    fecha_hora_inicio = Column(DateTime, nullable=False)
    fecha_hora_fin = Column(DateTime, nullable=False)
    
    # Simple status string, defaulting to pending
    estado = Column(String(20), default="pendiente")
    
    # Relations
    cliente = relationship("backend.modules.pacientes.models.Cliente", foreign_keys=[cliente_id], overlaps="citas")
    # M:N Relationship
    servicios = relationship("Servicio", secondary=cita_servicios, backref="citas")
    pagos = relationship("backend.modules.cobranza.models.Pago", back_populates="cita")


class Servicio(Base):
    __tablename__ = "servicios"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(100), unique=True, index=True)
    descripcion = Column(String(200))
    precio_sesion = Column(Float)
    precio_paquete = Column(Float, nullable=True)
    duracion_minutos = Column(Integer, default=20)
    categoria = Column(String(50))
