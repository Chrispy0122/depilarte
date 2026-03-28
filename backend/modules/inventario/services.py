from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from datetime import datetime, date, timedelta
from typing import List, Optional, Tuple
from . import models, schemas

def calcular_estado_stock(producto: models.Producto) -> Tuple[float, str]:
    """Calcula el porcentaje de stock y su estado"""
    stock_max = producto.stock_maximo or 1000.0  # Use default if None
    if stock_max <= 0:
        porcentaje = 0
        estado = "sin_datos"
    else:
        porcentaje = (producto.stock_actual / stock_max) * 100
        
        if porcentaje < 20:
            estado = "critico"
        elif porcentaje < 50:
            estado = "bajo"
        elif porcentaje <= 100:
            estado = "optimo"
        else:
            estado = "exceso"
    
    return porcentaje, estado

def calcular_dias_hasta_caducidad(fecha_caducidad: Optional[date]) -> Optional[int]:
    """Calcula días hasta que caduque el producto"""
    if not fecha_caducidad:
        return None
    
    hoy = date.today()
    delta = fecha_caducidad - hoy
    return delta.days

def enriquecer_producto(producto: models.Producto) -> dict:
    """Agrega campos calculados al producto para la UI"""
    porcentaje, estado = calcular_estado_stock(producto)
    dias = calcular_dias_hasta_caducidad(producto.fecha_caducidad)
    
    return {
        "id": producto.id,
        "nombre": producto.nombre,
        "descripcion": producto.descripcion,
        "tipo": producto.tipo,
        "categoria": producto.categoria,
        "unidad_medida": producto.unidad_medida,
        "stock_actual": producto.stock_actual,
        "stock_minimo": producto.stock_minimo,
        "stock_maximo": producto.stock_maximo or 1000.0,  # Default for None
        "costo_unitario": producto.costo_unitario,
        "precio_venta": producto.precio_venta,
        "fecha_caducidad": producto.fecha_caducidad.isoformat() if producto.fecha_caducidad else None,
        "imagen_url": producto.imagen_url,
        "activo": producto.activo,
        "fecha_creacion": producto.fecha_creacion.isoformat() if producto.fecha_creacion else datetime.now().isoformat(),
        "porcentaje_stock": round(porcentaje, 1),
        "estado_stock": estado,
        "dias_hasta_caducidad": dias
    }

# --- PRODUCTOS ---
def obtener_productos(
    db: Session, 
    tipo: Optional[str] = None,
    categoria: Optional[str] = None,
    solo_bajo_stock: bool = False,
    solo_proximos_vencer: bool = False
) -> List[dict]:
    """Obtiene productos con filtros opcionales"""
    query = db.query(models.Producto).filter(models.Producto.activo == True)
    
    if tipo:
        query = query.filter(models.Producto.tipo == tipo)
    
    if categoria:
        query = query.filter(models.Producto.categoria == categoria)
    
    if solo_bajo_stock:
        query = query.filter(models.Producto.stock_actual < models.Producto.stock_minimo)
    
    if solo_proximos_vencer:
        fecha_limite = date.today() + timedelta(days=30)
        query = query.filter(
            and_(
                models.Producto.fecha_caducidad.isnot(None),
                models.Producto.fecha_caducidad <= fecha_limite
            )
        )
    
    productos = query.all()
    return [enriquecer_producto(p) for p in productos]

def crear_producto(db: Session, producto: schemas.ProductoCreate, negocio_id: int = 1) -> models.Producto:
    """Crea un nuevo producto. Requiere negocio_id para TenantMixin."""
    db_producto = models.Producto(
        nombre=producto.nombre,
        descripcion=getattr(producto, 'descripcion', None),
        tipo=producto.tipo,
        categoria=producto.categoria,
        unidad_medida=producto.unidad_medida,
        stock_actual=getattr(producto, 'stock_actual', 0.0),
        stock_minimo=getattr(producto, 'stock_minimo', 0.0),
        stock_maximo=getattr(producto, 'stock_maximo', 1000.0),
        costo_unitario=getattr(producto, 'costo_unitario', 0.0),
        precio_venta=getattr(producto, 'precio_venta', None),
        fecha_caducidad=getattr(producto, 'fecha_caducidad', None),
        imagen_url=getattr(producto, 'imagen_url', None),
        activo=getattr(producto, 'activo', True),
    )
    db_producto.negocio_id = negocio_id  # TenantMixin requerido
    db.add(db_producto)
    db.commit()
    db.refresh(db_producto)
    return db_producto

def actualizar_producto(db: Session, producto_id: int, datos: schemas.ProductoUpdate) -> Optional[models.Producto]:
    """Actualiza un producto existente"""
    producto = db.query(models.Producto).filter(models.Producto.id == producto_id).first()
    if not producto:
        return None
    
    for key, value in datos.dict(exclude_unset=True).items():
        setattr(producto, key, value)
    
    db.commit()
    db.refresh(producto)
    return producto

# --- RECETAS BOM ---
def obtener_receta_por_servicio(db: Session, servicio_id: int) -> Optional[models.RecetaServicio]:
    """Obtiene la receta activa de un servicio"""
    return db.query(models.RecetaServicio).filter(
        and_(
            models.RecetaServicio.servicio_id == servicio_id,
            models.RecetaServicio.activa == True
        )
    ).first()

def crear_receta(db: Session, receta_data: schemas.RecetaCreate) -> models.RecetaServicio:
    """Crea una nueva receta para un servicio"""
    # Desactivar recetas anteriores del mismo servicio
    db.query(models.RecetaServicio).filter(
        models.RecetaServicio.servicio_id == receta_data.servicio_id
    ).update({"activa": False})
    
    # Crear nueva receta
    nueva_receta = models.RecetaServicio(
        servicio_id=receta_data.servicio_id,
        descripcion=receta_data.descripcion,
        activa=True
    )
    db.add(nueva_receta)
    db.flush()
    
    # Agregar ingredientes
    for ing_data in receta_data.ingredientes:
        ingrediente = models.RecetaIngrediente(
            receta_id=nueva_receta.id,
            **ing_data.dict()
        )
        db.add(ingrediente)
    
    db.commit()
    db.refresh(nueva_receta)
    return nueva_receta

def consumir_receta(
    db: Session,
    receta_id: int,
    referencia: str = "",
    negocio_id: int = 1           # <-- propagado desde el cobro para TenantMixin
) -> List[models.MovimientoInventario]:
    """
    Descuenta del inventario todos los ingredientes de una receta (BOM).
    Cada descuento genera un MovimientoInventario de tipo 'consumo'.
    IMPORTANTE: NO hace db.commit() propio — el commit lo ejecuta el llamador
    para garantizar atomicidad con el cobro completo.
    """
    receta = db.query(models.RecetaServicio).filter(models.RecetaServicio.id == receta_id).first()
    if not receta:
        return []
    
    movimientos = []
    for ingrediente in receta.ingredientes:
        movimiento = registrar_movimiento(
            db=db,
            producto_id=ingrediente.producto_id,
            tipo="consumo",
            cantidad=-abs(ingrediente.cantidad),  # Negativo = salida de inventario
            referencia=referencia,
            negocio_id=negocio_id
        )
        if movimiento:
            movimientos.append(movimiento)
    
    return movimientos

# --- MOVIMIENTOS ---
def registrar_movimiento(
    db: Session,
    producto_id: int,
    tipo: str,
    cantidad: float,
    referencia: Optional[str] = None,
    notas: Optional[str] = None,
    negocio_id: int = 1           # <-- requerido por TenantMixin en MovimientoInventario
) -> Optional[models.MovimientoInventario]:
    """Registra un movimiento de inventario y actualiza el stock del producto."""
    producto = db.query(models.Producto).filter(models.Producto.id == producto_id).first()
    if not producto:
        return None
    
    stock_anterior = producto.stock_actual
    stock_nuevo = stock_anterior + cantidad
    
    # Prevenir stock negativo
    if stock_nuevo < 0:
        print(f"WARNING: Stock de {producto.nombre} quedaría negativo ({stock_nuevo}). Ajustando a 0.")
        stock_nuevo = 0
        cantidad = -stock_anterior
    
    # Actualizar stock del producto
    producto.stock_actual = stock_nuevo
    
    # Crear el movimiento con negocio_id estampado (TenantMixin)
    movimiento = models.MovimientoInventario(
        producto_id=producto_id,
        tipo=tipo,
        cantidad=cantidad,
        stock_anterior=stock_anterior,
        stock_nuevo=stock_nuevo,
        fecha=datetime.now(),
        referencia=referencia,
        notas=notas
    )
    movimiento.negocio_id = negocio_id  # TenantMixin: sin esto el commit falla silenciosamente
    db.add(movimiento)
    # IMPORTANTE: usar flush() en lugar de commit() para preservar atomicidad.
    # El llamador (crear_cobro / endpoint de movimiento) es quien hace el commit final.
    db.flush()
    
    return movimiento

# --- DASHBOARD & ANALYTICS ---
def calcular_kpis(db: Session) -> dict:
    """Calcula los KPIs del dashboard"""
    productos = db.query(models.Producto).filter(models.Producto.activo == True).all()
    
    valor_total = sum(p.stock_actual * p.costo_unitario for p in productos)
    
    # Productos críticos (bajo stock mínimo)
    criticos = [p for p in productos if p.stock_actual < p.stock_minimo]
    
    # Próximos a vencer (30 días)
    fecha_limite = date.today() + timedelta(days=30)
    proximos_vencer = [p for p in productos if p.fecha_caducidad and p.fecha_caducidad <= fecha_limite]
    
    # Top consumidos (últimos 30 días)
    fecha_inicio = datetime.now() - timedelta(days=30)
    top_consumidos_query = db.query(
        models.MovimientoInventario.producto_id,
        func.sum(models.MovimientoInventario.cantidad).label('total_consumido')
    ).filter(
        and_(
            models.MovimientoInventario.tipo == "consumo",
            models.MovimientoInventario.fecha >= fecha_inicio
        )
    ).group_by(models.MovimientoInventario.producto_id).order_by(func.sum(models.MovimientoInventario.cantidad)).limit(5).all()
    
    top_consumidos = []
    for producto_id, total in top_consumidos_query:
        producto = db.query(models.Producto).get(producto_id)
        if producto:
            top_consumidos.append({
                "nombre": producto.nombre,
                "cantidad": abs(total),
                "unidad": producto.unidad_medida
            })
    
    # Alertas
    alertas = []
    for p in criticos[:5]:  # Top 5 críticos
        alertas.append({
            "tipo": "stock_bajo",
            "producto": p.nombre,
            "mensaje": f"Stock crítico: {p.stock_actual}{p.unidad_medida} (mínimo: {p.stock_minimo})"
        })
    
    for p in proximos_vencer[:5]:
        dias = calcular_dias_hasta_caducidad(p.fecha_caducidad)
        alertas.append({
            "tipo": "caducidad",
            "producto": p.nombre,
            "mensaje": f"Caduca en {dias} días ({p.fecha_caducidad.strftime('%d/%m/%Y')})"
        })
    
    return {
        "valor_total_inventario": round(valor_total, 2),
        "productos_criticos": len(criticos),
        "productos_proximos_vencer": len(proximos_vencer),
        "top_consumidos": top_consumidos,
        "alertas": alertas
    }

def obtener_consumo_historico(db: Session, producto_id: int, dias: int = 30) -> dict:
    """Obtiene el historial de consumo de un producto"""
    fecha_inicio = datetime.now() - timedelta(days=dias)
    
    movimientos = db.query(models.MovimientoInventario).filter(
        and_(
            models.MovimientoInventario.producto_id == producto_id,
            models.MovimientoInventario.tipo == "consumo",
            models.MovimientoInventario.fecha >= fecha_inicio
        )
    ).order_by(models.MovimientoInventario.fecha).all()
    
    fechas = [m.fecha.strftime('%Y-%m-%d') for m in movimientos]
    cantidades = [abs(m.cantidad) for m in movimientos]
    
    producto = db.query(models.Producto).get(producto_id)
    
    return {
        "producto_id": producto_id,
        "producto_nombre": producto.nombre if producto else "Desconocido",
        "fechas": fechas,
        "cantidades": cantidades
    }
