from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime

# --- PRODUCTO SCHEMAS ---
class ProductoBase(BaseModel):
    nombre: str
    descripcion: Optional[str] = None
    tipo: str = "uso_interno"  # uso_interno o retail
    categoria: str
    unidad_medida: str = "ml"
    stock_minimo: float = 0.0
    stock_maximo: float = 1000.0
    costo_unitario: float = 0.0
    precio_venta: Optional[float] = None
    fecha_caducidad: Optional[date] = None
    imagen_url: Optional[str] = None

class ProductoCreate(ProductoBase):
    stock_actual: float = 0.0

class ProductoUpdate(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    stock_actual: Optional[float] = None
    stock_minimo: Optional[float] = None
    stock_maximo: Optional[float] = None
    costo_unitario: Optional[float] = None
    precio_venta: Optional[float] = None
    fecha_caducidad: Optional[date] = None

class ProductoResponse(ProductoBase):
    id: int
    stock_actual: float
    activo: bool
    fecha_creacion: datetime
    
    # Campos calculados para UI
    porcentaje_stock: Optional[float] = None
    estado_stock: Optional[str] = None  # "critico", "bajo", "optimo", "exceso"
    dias_hasta_caducidad: Optional[int] = None
    
    class Config:
        from_attributes = True

# --- RECETA SCHEMAS ---
class IngredienteBase(BaseModel):
    producto_id: int
    cantidad: float
    unidad: str

class IngredienteCreate(IngredienteBase):
    pass

class IngredienteResponse(IngredienteBase):
    id: int
    producto_nombre: Optional[str] = None
    
    class Config:
        from_attributes = True

class RecetaCreate(BaseModel):
    servicio_id: int
    descripcion: Optional[str] = None
    ingredientes: List[IngredienteCreate]

class RecetaResponse(BaseModel):
    id: int
    servicio_id: int
    descripcion: Optional[str]
    activa: bool
    ingredientes: List[IngredienteResponse]
    costo_total: Optional[float] = None  # Calculado
    
    class Config:
        from_attributes = True

# --- MOVIMIENTO SCHEMAS ---
class MovimientoCreate(BaseModel):
    producto_id: int
    tipo: str  # entrada, salida, ajuste, consumo
    cantidad: float
    referencia: Optional[str] = None
    notas: Optional[str] = None

class MovimientoResponse(BaseModel):
    id: int
    producto_id: int
    tipo: str
    cantidad: float
    stock_anterior: Optional[float]
    stock_nuevo: Optional[float]
    fecha: datetime
    referencia: Optional[str]
    usuario: Optional[str]
    notas: Optional[str]
    
    class Config:
        from_attributes = True

# --- DASHBOARD SCHEMAS ---
class DashboardKPIs(BaseModel):
    valor_total_inventario: float
    productos_criticos: int
    productos_proximos_vencer: int
    top_consumidos: List[dict]
    alertas: List[dict]

class ConsumoHistorico(BaseModel):
    producto_id: int
    producto_nombre: str
    fechas: List[str]
    cantidades: List[float]
