import sys
sys.path.append(r"C:\Users\Windows\Documents\Depilarte")

from backend.database import engine
from sqlalchemy import text

with engine.connect() as conn:
    try:
        conn.execute(text("ALTER TABLE clientes ADD COLUMN fecha_registro DATETIME NULL;"))
        conn.commit()
        print("OK - Columna 'fecha_registro' agregada exitosamente.")
    except Exception as e:
        if "Duplicate column name" in str(e) or "already exists" in str(e).lower():
            print("INFO: La columna 'fecha_registro' ya existe, no se necesitan cambios.")
        else:
            print(f"ERROR: {e}")
