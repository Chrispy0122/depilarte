import sys
import os
from sqlalchemy import text
# Add parent directory to path to allow imports from backend
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.database import SessionLocal
from backend.modules.servicios.models import PaqueteSpa

def verify():
    db = SessionLocal()
    try:
        total = db.query(PaqueteSpa).count()
        depil = db.query(PaqueteSpa).filter(PaqueteSpa.categoria == 'depilacion').count()
        foto = db.query(PaqueteSpa).filter(PaqueteSpa.codigo.like('FOTO-%')).count()
        
        print(f"Total Services: {total}")
        print(f"Depilacion Services: {depil}")
        print(f"Foto Rejuvenecimiento Services: {foto}")
        
        # Check a specific sample
        sample = db.query(PaqueteSpa).filter(PaqueteSpa.codigo == 'FOTO-AXX').first()
        if sample:
            print(f"Sample FOTO-AXX: {sample.nombre} | Price: {sample.sesion}")
        else:
            print("Sample FOTO-AXX not found!")
            
    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    verify()
