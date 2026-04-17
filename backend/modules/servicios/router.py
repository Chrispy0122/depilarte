from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import List, Optional
import re
from backend.database import get_db
from .models import PaqueteSpa
from .schemas import PaqueteSpaResponse, PaqueteSpaCreate

class DummyUsuario:
    def __init__(self, negocio_id: int):
        self.negocio_id = negocio_id

def get_current_usuario(authorization: str = Header(None)):
    """Extrae negocio_id del token JWT/fake-token almacenado en localStorage."""
    if authorization:
        match = re.search(r"tenant-(\d+)", authorization)
        if match:
            return DummyUsuario(negocio_id=int(match.group(1)))
    return DummyUsuario(negocio_id=1)

router = APIRouter(prefix="/api/servicios", tags=["Servicios"])

@router.get("/", response_model=List[PaqueteSpaResponse])
def listar_paquetes(
    categoria: str = None,
    activo: Optional[int] = None,
    search: str = None,
    db: Session = Depends(get_db)
):
    """
    Lista todos los paquetes y servicios del spa.
    Puede filtrar por categoría (depilacion, facial, masajes) y estado activo.
    También permite buscar por nombre o código.
    """
    query = db.query(PaqueteSpa)
    
    if categoria:
        query = query.filter(PaqueteSpa.categoria == categoria)
    
    if activo is not None:
        query = query.filter(PaqueteSpa.activo == activo)
        
    if search:
        search_term = f"%{search}%"
        # ILIKE is Postgres specific, for SQLite use like with some care or just like in python if needed.
        # But SQLAlchemy `ilike` usually handles it or we can use `or_` with `like`.
        from sqlalchemy import or_
        query = query.filter(
            or_(
                PaqueteSpa.nombre.ilike(search_term),
                PaqueteSpa.codigo.ilike(search_term)
            )
        )
    
    return query.order_by(PaqueteSpa.id).all()

@router.get("/{paquete_id}", response_model=PaqueteSpaResponse)
def obtener_paquete(paquete_id: int, db: Session = Depends(get_db)):
    """
    Obtiene un paquete específico por ID.
    """
    paquete = db.query(PaqueteSpa).filter(PaqueteSpa.id == paquete_id).first()
    if not paquete:
        raise HTTPException(status_code=404, detail="Paquete no encontrado")
    return paquete

@router.post("/", response_model=PaqueteSpaResponse)
def crear_paquete(
    paquete: PaqueteSpaCreate, 
    db: Session = Depends(get_db),
    usuario_actual: DummyUsuario = Depends(get_current_usuario)
):
    """
    Crea un nuevo paquete o servicio.
    """
    # Verificar si el código ya existe
    existe = db.query(PaqueteSpa).filter(PaqueteSpa.codigo == paquete.codigo).first()
    if existe:
        raise HTTPException(status_code=400, detail="El código de servicio ya existe.")
        
    nuevo_servicio = PaqueteSpa(**paquete.dict())
    
    # 1. Asegurar estado activo (1) por defecto, para no romper vistas GET
    if getattr(nuevo_servicio, 'activo', None) is None:
        nuevo_servicio.activo = 1
        
    # Inyectar negocio_id del tenant autenticado (requerido por TenantMixin)
    nuevo_servicio.negocio_id = usuario_actual.negocio_id
        
    # 2. Add y commit/refresh obligatorio
    db.add(nuevo_servicio)
    db.commit()
    db.refresh(nuevo_servicio)
    
    return nuevo_servicio
