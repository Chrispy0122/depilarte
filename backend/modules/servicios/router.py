from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from backend.database import get_db
from .models import PaqueteSpa
from .schemas import PaqueteSpaResponse

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
