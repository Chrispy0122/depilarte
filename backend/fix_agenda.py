import sys
import os

# Add the parent directory to sys.path to allow imports from backend
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.database import engine, Base
from sqlalchemy import text, inspect

def reset_agenda_table():
    print("=" * 60)
    print("AGENDA FIX SCRIPT - Restaurando tabla Citas")
    print("=" * 60)
    
    # Import all models to ensure Base knows about them
    from backend.modules.agenda.models import Cita, Servicio
    from backend.modules.pacientes.models import Cliente
    
    # Check existing tables
    inspector = inspect(engine)
    existing_tables = inspector.get_table_names()
    print(f"\n✓ Tablas existentes: {existing_tables}")
    
    with engine.connect() as connection:
        # Drop citas table
        print("\n[1/2] Eliminando tabla 'citas'...")
        try:
            connection.execute(text("DROP TABLE IF EXISTS citas"))
            connection.commit()
            print("✓ Tabla 'citas' eliminada.")
        except Exception as e:
            print(f"✗ Error eliminando tabla: {e}")
            return

    # Recreate table
    print("\n[2/2] Recreando tabla 'citas'...")
    try:
        Base.metadata.create_all(bind=engine, tables=[Cita.__table__])
        print("✓ Tabla 'citas' reconstruida exitosamente.")
        
        # Verify
        inspector = inspect(engine)
        columns = [c['name'] for c in inspector.get_columns('citas')]
        print(f"\n✓ Columnas creadas: {columns}")
        
        print("\n" + "=" * 60)
        print("SUCCESS: Agenda restaurada correctamente.")
        print("Puedes recargar la página.")
        print("=" * 60)
        
    except Exception as e:
        print(f"✗ Error creando tabla: {e}")
        print("\nNOTA: Esto puede ser normal si hay dependencias circulares.")
        print("Intenta reiniciar el servidor FastAPI.")

if __name__ == "__main__":
    reset_agenda_table()
