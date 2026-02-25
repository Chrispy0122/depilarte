from backend.database import SessionLocal
from backend.modules.servicios.models import PaqueteSpa

db = SessionLocal()
count = db.query(PaqueteSpa).count()
print(f"Total paquetes: {count}")
first = db.query(PaqueteSpa).first()
if first:
    print(f"Ejemplo: {first.nombre} - ${first.sesion}")
db.close()
