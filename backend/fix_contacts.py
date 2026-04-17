import sys
import os

# Ensure backend can be imported
sys.path.append(os.getcwd())

from backend.database import SessionLocal
from backend.modules.pacientes.models import Cliente

def clean_contacts():
    db = SessionLocal()
    try:
        # Get all clients
        clientes = db.query(Cliente).all()
        print(f"Total de contactos encontrados: {len(clientes)}")
        
        for c in clientes:
            # Drop anyone not named Christopher Hernandez
            if "christopher" not in c.nombre_completo.lower():
                print(f"Eliminando contacto: {c.nombre_completo} ({c.telefono})")
                db.delete(c)
        
        # Check if Osman Vivas exists
        osman = db.query(Cliente).filter(Cliente.telefono.like('%58 424-5405230%')).first()
        if not osman:
            print("Añadiendo a Osman Vivas...")
            nuevo_osman = Cliente(
                nombre_completo="Osman Vivas",
                telefono="+58 424-5405230",
                cedula="V-00000000", # Placeholder needed since cedula is unique and required
                numero_historia="OSM-001"
            )
            db.add(nuevo_osman)
        else:
            print("Osman Vivas ya existe en la base de datos.")

        db.commit()
        print("Limpieza completada con éxito.")

    except Exception as e:
        print(f"Error al limpiar contactos: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    clean_contacts()
