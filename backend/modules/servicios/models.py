from sqlalchemy import Column, Integer, String, Float
from backend.database import Base

class PaqueteSpa(Base):
    """
    Modelo para almacenar información de paquetes y servicios del spa.
    Basado en la tabla de precios de tratamientos de depilación.
    """
    __tablename__ = "paquetes_spa"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    codigo = Column(String(20), unique=True, nullable=False)  # CAR, BOZ-M, BARB, etc.
    nombre = Column(String(200), nullable=False)  # Cara Completa, Bozo + Menton, etc.
    sesion = Column(Integer, nullable=False)  # Precio por sesión individual
    paquete_4_sesiones = Column(Integer, nullable=True)  # Precio paquete de 4 sesiones
    num_zonas = Column(String(20), nullable=True)  # 1, 2, "3 a 4", etc.
    cantidad_sesiones = Column(String(20), nullable=True)  # "8 a 12", "3 a 5", etc.
    comision_recepcionista = Column(Float, default=0.0)
    comision_especialista = Column(Float, default=0.0)
    categoria = Column(String(50), default="depilacion")  # depilacion, facial, masajes, etc.
    activo = Column(Integer, default=1)  # 1 = activo, 0 = inactivo
