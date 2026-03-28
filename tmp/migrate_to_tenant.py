import sys
import os
from sqlalchemy import text

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from backend.database import engine, SessionLocal, Base

from backend.modules.core.models import Negocio
from backend.modules.pacientes.models import Cliente
from backend.modules.staff.models import Empleado
from backend.modules.agenda.models import Cita, Servicio
from backend.modules.cobranza.models import Cobro, Pago
from backend.modules.inventario.models import Producto, MovimientoInventario
from backend.modules.servicios.models import PaqueteSpa

tables_to_migrate = [
    'clientes',
    'empleados',
    'citas',
    'servicios',
    'cobros',
    'pagos',
    'productos_inventario',
    'movimientos_inventario',
    'paquetes_spa'
]

def check_column_exists(connection, table_name, column_name):
    query = text(f"SHOW COLUMNS FROM {table_name} LIKE '{column_name}'")
    result = connection.execute(query).fetchone()
    return result is not None

print("Starting tenant migration...")

try:
    with engine.connect() as conn:
        conn.execute(text("SET FOREIGN_KEY_CHECKS=0;"))
        try:
            conn.execute(text("DROP TABLE IF EXISTS negocios;"))
            conn.commit()
            print("Dropped old 'negocios' table if it existed.")
        except Exception as e:
            print("Could not drop negocios table:", e)
        conn.execute(text("SET FOREIGN_KEY_CHECKS=1;"))

    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    
    negocio_default = db.query(Negocio).filter(Negocio.id == 1).first()
    if not negocio_default:
        negocio_default = Negocio(id=1, nombre="Depilarte", tipo_negocio="laser")
        db.add(negocio_default)
        db.commit()
        print("Created default Negocio 'Depilarte' with ID=1")
    
    with engine.connect() as conn:
        for table in tables_to_migrate:
            print(f"Migrating table {table}...")
            # Disable FK checks temporarily
            conn.execute(text("SET FOREIGN_KEY_CHECKS=0;"))
            
            if not check_column_exists(conn, table, 'negocio_id'):
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN negocio_id INT;"))
                print(f"  - Added column negocio_id to {table}")
                
            conn.execute(text(f"UPDATE {table} SET negocio_id = 1 WHERE negocio_id IS NULL;"))
            print(f"  - Updated rows to negocio_id = 1 for {table}")
            
            try:
                conn.execute(text(f"ALTER TABLE {table} MODIFY COLUMN negocio_id INT NOT NULL;"))
            except Exception as exp:
                print(f"  - Warning modifying column to NOT NULL: {exp}")

            try:
                conn.execute(text(f"""
                ALTER TABLE {table}
                ADD CONSTRAINT fk_{table}_negocio_id
                FOREIGN KEY (negocio_id) REFERENCES negocios(id) ON DELETE CASCADE;
                """))
                print(f"  - Added Foreign Key to {table}")
            except Exception as e:
                if '1061' in str(e) or 'Duplicate key' in str(e) or 'already exists' in str(e):
                    pass # Already exists
                else:
                    print(f"  - Error adding FK to {table}: {e}")
            
            # Commit after each table
            conn.commit()
            conn.execute(text("SET FOREIGN_KEY_CHECKS=1;"))

    print("Migration completed successfully.")

except Exception as e:
    print(f"Migration failed: {e}")
