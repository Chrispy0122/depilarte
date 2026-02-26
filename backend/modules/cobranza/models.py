from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from backend.database import Base
from datetime import datetime

class Pago(Base):
    __tablename__ = "pagos"

    id = Column(Integer, primary_key=True, index=True)
    cita_id = Column(Integer, ForeignKey("citas.id"))
    monto = Column(Float)
    metodo = Column(String(50)) # Zelle, Efectivo, PagoMovil, Wallet
    referencia = Column(String(100), nullable=True)

    cita = relationship("backend.modules.agenda.models.Cita", back_populates="pagos")

class Cobro(Base):
    __tablename__ = "cobros"

    id = Column(Integer, primary_key=True, index=True)
    cliente_id = Column(Integer, ForeignKey("clientes.id"), nullable=False)
    fecha = Column(DateTime, default=datetime.utcnow)
    total = Column(Float, default=0.0)
    metodo_pago = Column(String(50)) # Principal payment method or 'Multiple'
    observaciones = Column(String(200), nullable=True)
    referencia = Column(String(100), nullable=True) # Added via migration script
    
    # New Fields for Partial Payments (Abonos)
    monto_total_venta = Column(Float, default=0.0) # Precio real total
    monto_abonado = Column(Float, default=0.0) # Lo que pagó hoy
    deuda = Column(Float, default=0.0) # Lo que debe
    tasa_bcv = Column(Float, nullable=True) # Tasa BCV al momento del cobro

    # Relationships
    cliente = relationship("backend.modules.pacientes.models.Cliente")
    detalles = relationship("DetalleCobro", back_populates="cobro", cascade="all, delete-orphan")

class DetalleCobro(Base):
    __tablename__ = "detalle_cobros"

    id = Column(Integer, primary_key=True, index=True)
    cobro_id = Column(Integer, ForeignKey("cobros.id"))
    servicio_id = Column(Integer, ForeignKey("paquetes_spa.id")) 
    servicio_nombre = Column(String(200)) # Snapshot
    tipo_venta = Column(String(20)) # 'sesion' | 'paquete'
    precio_unitario = Column(Float) # Original price
    precio_aplicado = Column(Float) # Final price
    cantidad = Column(Integer, default=1)
    
    # Staff & Commissions (Snapshot at moment of sale)
    recepcionista_id = Column(Integer, ForeignKey("empleados.id"), nullable=True)
    especialista_id = Column(Integer, ForeignKey("empleados.id"), nullable=True)
    monto_comision_recepcionista = Column(Float, default=0.0)
    monto_comision_especialista = Column(Float, default=0.0)

    cobro = relationship("Cobro", back_populates="detalles")
    servicio = relationship("backend.modules.servicios.models.PaqueteSpa")
    
    # Relationships to Staff (using string reference to avoid circular imports if model file is loaded early)
    recepcionista = relationship("backend.modules.staff.models.Empleado", foreign_keys=[recepcionista_id])
    especialista = relationship("backend.modules.staff.models.Empleado", foreign_keys=[especialista_id])
