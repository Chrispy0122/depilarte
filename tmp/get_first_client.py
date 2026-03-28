import sys
import os
sys.path.append(r"C:\Users\Windows\Documents\Depilarte")

from backend.database import SessionLocal
from backend.modules.pacientes.models import Cliente

db = SessionLocal()
c = db.query(Cliente).first()
if c:
    print(c.__dict__)
    if c.historia_clinica:
        print(c.historia_clinica)
db.close()
