from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from backend.database import get_db
from . import models, schemas

router = APIRouter(
    prefix="/api/staff",
    tags=["Staff"]
)

@router.get("/", response_model=List[schemas.Empleado])
def read_empleados(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    empleados = db.query(models.Empleado).filter(models.Empleado.activo == 1).offset(skip).limit(limit).all()
    return empleados

@router.post("/", response_model=schemas.Empleado)
def create_empleado(empleado: schemas.EmpleadoCreate, db: Session = Depends(get_db)):
    db_empleado = models.Empleado(**empleado.dict())
    db.add(db_empleado)
    db.commit()
    db.refresh(db_empleado)
    return db_empleado
@router.post("/login")
def login(login_data: schemas.EmpleadoBase, db: Session = Depends(get_db)):
    # 1. HARDCODE BYPASS FOR SPECIALIST TESTING
    if login_data.nombre_completo == "especialista":
        return {
            "token": "fake-specialist-token-1-tenant-1",
            "user": {"id": 1, "nombre_completo": "Especialista Temporal", "rol": "especialista"},
            "negocio_id": 1,
            "tipo_negocio": "laser",
            "nombre_negocio": "Depilarte"
        }

    # 2. DEFAULT ADMIN BYPASS (Existing)
    if login_data.nombre_completo == "depilarte":
        return {
            "token": "fake-admin-token-tenant-1",
            "user": {"id": 0, "nombre_completo": "Administrador", "rol": "admin"},
            "negocio_id": 1,
            "tipo_negocio": "laser",
            "nombre_negocio": "Depilarte"
        }

    # 3. NORMAL DB SEARCH
    empleado = db.query(models.Empleado).filter(models.Empleado.nombre_completo == login_data.nombre_completo).first()
    
    if not empleado:
        return {"error": "Usuario no encontrado"}, 401
    
    # 4. FETCH NEGOCIO CONTEXT
    from backend.modules.core.models import Negocio
    negocio = db.query(Negocio).filter(Negocio.id == empleado.negocio_id).first()
    
    # BACKWARD COMPATIBILITY: Default role to 'admin' if null or empty
    rol_final = empleado.rol if empleado.rol else "admin"
    
    return {
        "token": f"fake-token-{empleado.id}-tenant-{empleado.negocio_id}",
        "user": {
            "id": empleado.id,
            "nombre_completo": empleado.nombre_completo,
            "rol": rol_final
        },
        "negocio_id": negocio.id if negocio else 1,
        "tipo_negocio": negocio.tipo_negocio if negocio else "laser",
        "nombre_negocio": negocio.nombre if negocio else "Depilarte"
    }
