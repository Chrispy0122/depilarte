from sqlalchemy import Column, Integer, String, Boolean, ForeignKey
from sqlalchemy.orm import declared_attr
from backend.database import Base

class Negocio(Base):
    __tablename__ = 'negocios'
    
    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(100), nullable=False)
    tipo_negocio = Column(String(50), nullable=False) # ej: 'laser', 'belleza', 'odonto'
    activo = Column(Boolean, default=True)
    bot_activo = Column(Boolean, default=False)

class TenantMixin:
    @declared_attr
    def negocio_id(cls):
        return Column(Integer, ForeignKey('negocios.id', ondelete='CASCADE'), nullable=False, index=True)
