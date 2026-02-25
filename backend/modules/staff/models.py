from sqlalchemy import Column, Integer, String, Float
from backend.database import Base

class Empleado(Base):
    __tablename__ = "empleados"

    id = Column(Integer, primary_key=True, index=True)
    nombre_completo = Column(String(200), nullable=False)
    rol = Column(String(50), nullable=False) # 'recepcionista', 'especialista', 'ambos'
    activo = Column(Integer, default=1)
