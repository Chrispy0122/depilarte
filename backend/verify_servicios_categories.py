import sys
import os
# Add parent directory to path to allow imports from backend
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.database import SessionLocal
from backend.modules.servicios.models import PaqueteSpa

def verify():
    db = SessionLocal()
    try:
        categories = ['depilacion', 'facial', 'corporal', 'fototerapia', 'otros']
        print("--- Category Counts ---")
        for cat in categories:
            count = db.query(PaqueteSpa).filter(PaqueteSpa.categoria == cat).count()
            print(f"{cat.capitalize()}: {count}")
            
        print("\n--- Samples with Prices ---")
        samples = db.query(PaqueteSpa).limit(10).all()
        for s in samples:
            print(f"ID: {s.id} | {s.nombre} | Sesion: {s.sesion} | Paquete4: {s.paquete_4_sesiones} | ComisR: {s.comision_recepcionista} | ComisE: {s.comision_especialista}")

    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    verify()
