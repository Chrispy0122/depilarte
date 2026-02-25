from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from backend.database import get_db
from . import schemas, services, models

router = APIRouter(
    prefix="/api/inventario",
    tags=["Inventario"]
)

# --- DASHBOARD ---
@router.get("/dashboard", response_model=schemas.DashboardKPIs)
def get_dashboard_kpis(db: Session = Depends(get_db)):
    """Obtiene los KPIs principales del dashboard de inventario"""
    return services.calcular_kpis(db)

@router.get("/analytics/consumo/{producto_id}")
def get_consumo_historico(
    producto_id: int, 
    dias: int = 30, 
    db: Session = Depends(get_db)
):
    """Obtiene el historial de consumo de un producto"""
    return services.obtener_consumo_historico(db, producto_id, dias)

# --- PRODUCTOS ---
@router.get("/productos", response_model=List[schemas.ProductoResponse])
def get_productos(
    tipo: Optional[str] = None,
    categoria: Optional[str] = None,
    solo_bajo_stock: bool = False,
    solo_proximos_vencer: bool = False,
    db: Session = Depends(get_db)
):
    """Obtiene lista de productos con filtros"""
    return services.obtener_productos(db, tipo, categoria, solo_bajo_stock, solo_proximos_vencer)

@router.post("/productos", response_model=schemas.ProductoResponse)
def create_producto(producto: schemas.ProductoCreate, db: Session = Depends(get_db)):
    """Crea un nuevo producto"""
    return services.crear_producto(db, producto)

@router.put("/productos/{producto_id}", response_model=schemas.ProductoResponse)
def update_producto(
    producto_id: int, 
    producto: schemas.ProductoUpdate, 
    db: Session = Depends(get_db)
):
    """Actualiza un producto existente"""
    db_producto = services.actualizar_producto(db, producto_id, producto)
    if not db_producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return services.enriquecer_producto(db_producto)

# --- RECETAS (BOM) ---
@router.get("/recetas", response_model=Optional[schemas.RecetaResponse])
def get_receta_servicio(servicio_id: int, db: Session = Depends(get_db)):
    """Obtiene la receta activa de un servicio"""
    receta = services.obtener_receta_por_servicio(db, servicio_id)
    if not receta:
        return None
    return receta

@router.post("/recetas", response_model=schemas.RecetaResponse)
def create_receta(receta: schemas.RecetaCreate, db: Session = Depends(get_db)):
    """Crea o actualiza la receta de un servicio"""
    return services.crear_receta(db, receta)

# --- MOVIMIENTOS ---
@router.post("/movimientos/entrada", response_model=schemas.MovimientoResponse)
def registrar_entrada(
    entrada: schemas.MovimientoCreate, 
    db: Session = Depends(get_db)
):
    """Registra una entrada de inventario (compra)"""
    if entrada.tipo != "entrada":
        raise HTTPException(status_code=400, detail="Tipo de movimiento debe ser 'entrada'")
    
    movimiento = services.registrar_movimiento(
        db, 
        entrada.producto_id, 
        entrada.tipo, 
        abs(entrada.cantidad), 
        entrada.referencia, 
        entrada.notas
    )
    if not movimiento:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return movimiento

@router.post("/movimientos/ajuste", response_model=schemas.MovimientoResponse)
def registrar_ajuste(
    ajuste: schemas.MovimientoCreate, 
    db: Session = Depends(get_db)
):
    """Registra un ajuste de inventario (manual)"""
    # El ajuste puede ser positivo (entrada) o negativo (salida)
    # Si el usuario envía la diferencia, la usamos.
    # Si el usuario envía el stock real, deberíamos calcular la diferencia en el frontend o aquí.
    # Por simplicidad, asumimos que envía la diferencia (+5 o -2)
    
    movimiento = services.registrar_movimiento(
        db, 
        ajuste.producto_id, 
        "ajuste", 
        ajuste.cantidad, 
        ajuste.referencia, 
        ajuste.notas
    )
    if not movimiento:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return movimiento
