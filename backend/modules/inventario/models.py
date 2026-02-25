from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean, Date, Enum as SQLEnum
from sqlalchemy.orm import relationship
from backend.database import Base
import enum
from datetime import datetime

class TipoProducto(str, enum.Enum):
    USO_INTERNO = "uso_interno"  # Cabina (ml, g)
    RETAIL = "retail"             # Venta (unidades)

class Producto(Base):
    __tablename__ = "productos_inventario"
    
    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(100), nullable=False, index=True)
    descripcion = Column(String(500))
    tipo = Column(String(20), default="uso_interno")  # uso_interno o retail
    categoria = Column(String(50), index=True)  # "Depilación", "Facial", etc.
    unidad_medida = Column(String(20), default="ml")  # "ml", "g", "unidades"
    imagen_url = Column(String(255), nullable=True) # Emoticon or URL
    
    # Stock
    stock_actual = Column(Float, default=0.0)
    stock_minimo = Column(Float, default=0.0)
    stock_maximo = Column(Float, default=1000.0)
    
    # Costos y Precios
    costo_unitario = Column(Float, default=0.0)  # Precio de costo
    precio_venta = Column(Float, nullable=True)  # Solo para retail
    
    # Caducidad
    fecha_caducidad = Column(Date, nullable=True)
    
    # Metadata
    imagen_url = Column(String(500), nullable=True)
    activo = Column(Boolean, default=True)
    fecha_creacion = Column(DateTime, default=datetime.now)
    
    # Relaciones
    movimientos = relationship("MovimientoInventario", back_populates="producto")
    ingredientes = relationship("RecetaIngrediente", back_populates="producto")


class RecetaServicio(Base):
    """Receta (BOM - Bill of Materials) de productos que consume un servicio"""
    __tablename__ = "recetas_servicio"
    
    id = Column(Integer, primary_key=True, index=True)
    servicio_id = Column(Integer, ForeignKey("servicios.id"), nullable=False)
    descripcion = Column(String(200))
    activa = Column(Boolean, default=True)
    fecha_creacion = Column(DateTime, default=datetime.now)
    
    # Relaciones
    # servicio = relationship("Servicio", backref="recetas")  # Removed temporarily to fix dependency issue
    ingredientes = relationship("RecetaIngrediente", back_populates="receta", cascade="all, delete-orphan")


class RecetaIngrediente(Base):
    """Ingrediente individual de una receta"""
    __tablename__ = "recetas_ingredientes"
    
    id = Column(Integer, primary_key=True, index=True)
    receta_id = Column(Integer, ForeignKey("recetas_servicio.id"), nullable=False)
    producto_id = Column(Integer, ForeignKey("productos_inventario.id"), nullable=False)
    cantidad = Column(Float, nullable=False)  # Cantidad consumida por servicio
    unidad = Column(String(20))  # ml, g, unidades
    
    # Relaciones
    receta = relationship("RecetaServicio", back_populates="ingredientes")
    producto = relationship("Producto", back_populates="ingredientes")


class TipoMovimiento(str, enum.Enum):
    ENTRADA = "entrada"      # Compra
    SALIDA = "salida"        # Venta retail
    AJUSTE = "ajuste"        # Corrección manual
    CONSUMO = "consumo"      # Descuento automático por servicio

class MovimientoInventario(Base):
    """Registro de todos los movimientos de inventario"""
    __tablename__ = "movimientos_inventario"
    
    id = Column(Integer, primary_key=True, index=True)
    producto_id = Column(Integer, ForeignKey("productos_inventario.id"), nullable=False)
    tipo = Column(String(20), nullable=False)  # entrada, salida, ajuste, consumo
    cantidad = Column(Float, nullable=False)  # Positivo para entrada, negativo para salida
    stock_anterior = Column(Float)  # Stock antes del movimiento
    stock_nuevo = Column(Float)  # Stock después del movimiento
    
    fecha = Column(DateTime, default=datetime.now, index=True)
    referencia = Column(String(200))  # "Cita #123", "Compra #456", etc.
    usuario = Column(String(100))
    notas = Column(String(500))
    
    # Relaciones
    producto = relationship("Producto", back_populates="movimientos")
