from database import SessionLocal
from modules.pacientes.models import Cliente
import os

db = SessionLocal()
try:
    clientes = db.query(Cliente).all()
    print("Total clientes:", len(clientes))
    for c in clientes:
        print(c.id, c.nombre_completo, c.telefono)
    print("---")
finally:
    db.close()
