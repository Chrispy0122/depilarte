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
