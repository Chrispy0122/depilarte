import sys
import os

# Go up two levels to reach C:\Users\Windows\Documents\Depilarte
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from backend.database import engine
from sqlalchemy import text

def run_migration():
    with engine.begin() as conn:
        try:
            result = conn.execute(text("SHOW COLUMNS FROM clientes LIKE 'eliminado'"))
            if result.fetchone() is None:
                print("Agregando columna 'eliminado' a la tabla 'clientes'...")
                conn.execute(text("ALTER TABLE clientes ADD COLUMN eliminado BOOLEAN NOT NULL DEFAULT 0"))
                print("Migración completada con éxito.")
            else:
                print("La columna 'eliminado' ya existe.")
        except Exception as e:
            print(f"Error durante la migración: {e}")

if __name__ == "__main__":
    run_migration()
