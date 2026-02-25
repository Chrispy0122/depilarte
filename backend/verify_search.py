import sys
import os
# Add parent directory to path to allow imports from backend
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.database import SessionLocal
from backend.modules.servicios.models import PaqueteSpa
from sqlalchemy import or_

def verify_search(term):
    db = SessionLocal()
    try:
        search_term = f"%{term}%"
        results = db.query(PaqueteSpa).filter(
            or_(
                PaqueteSpa.nombre.ilike(search_term),
                PaqueteSpa.codigo.ilike(search_term)
            )
        ).all()
        
        print(f"--- Search Results for '{term}' ---")
        for r in results:
            print(f"[{r.codigo}] {r.nombre}")
        print(f"Count: {len(results)}\n")
            
    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    verify_search("Axilas") # Should find Depil + Foto
    verify_search("CAR")    # Should find CAR (Cara) by code
    verify_search("Foto")   # Should find all foto treatments
