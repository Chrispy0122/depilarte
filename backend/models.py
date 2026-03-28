from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Enum, Boolean, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from backend.database import Base
import enum


class TipoTransaccion(str, enum.Enum):
    CREDITO = "CREDITO"
    DEBITO = "DEBITO"

# EstadoCita is now in backend.modules.agenda.models

# Cliente moved to backend.modules.pacientes.models
# Servicio moved to backend.modules.agenda.models
# Cita moved to backend.modules.agenda.models

class Presupuesto(Base):
    __tablename__ = "presupuestos"

    id = Column(Integer, primary_key=True, index=True)
    cliente_id = Column(Integer, ForeignKey("clientes.id"))
    nombre_tratamiento = Column(String(200))
    total_citas = Column(Integer)
    monto_total = Column(Float)
    activo = Column(Integer, default=1)

    # Relationship to modular Cliente
    cliente = relationship("backend.modules.pacientes.models.Cliente", backref="presupuestos")

class Transaccion(Base):
    __tablename__ = "transacciones"

    id = Column(Integer, primary_key=True, index=True)
    tipo = Column(Enum(TipoTransaccion))
    monto_dolares = Column(Float)
    metodo_pago = Column(String(50))

class Sesion(Base):
    __tablename__ = "sesiones"

    id = Column(Integer, primary_key=True, index=True)
    fecha_sesion = Column(DateTime)
    total_a_pagar = Column(Float)

    detalles = relationship("DetalleSesion", back_populates="sesion")

class DetalleSesion(Base):
    __tablename__ = "detalle_sesiones"

    id = Column(Integer, primary_key=True, index=True)
    sesion_id = Column(Integer, ForeignKey("sesiones.id"))
    servicio_id = Column(Integer, ForeignKey("servicios.id"))
    precio_aplicado = Column(Float)

    sesion = relationship("Sesion", back_populates="detalles")
    # Relationship to modular Servicio
    servicio = relationship("backend.modules.agenda.models.Servicio")
