import sys
import os

# Ensure backend matches path
sys.path.append(os.getcwd())

from backend.database import engine, SessionLocal
from sqlalchemy import text, inspect
from backend.modules.staff.models import Empleado
from backend.modules.cobranza.models import DetalleCobro
from backend.modules.servicios.models import PaqueteSpa

def fix_schema():
    insp = inspect(engine)
    
    with engine.connect() as conn:
        # 1. Check DetalleCobro columns
        columns_dc = [c['name'] for c in insp.get_columns('detalle_cobros')]
        print(f"DetalleCobro columns: {columns_dc}")
        
        if 'recepcionista_id' not in columns_dc:
            print("Adding recepcionista_id to detalle_cobros...")
            conn.execute(text("ALTER TABLE detalle_cobros ADD COLUMN recepcionista_id INTEGER"))
        
        if 'especialista_id' not in columns_dc:
            print("Adding especialista_id to detalle_cobros...")
            conn.execute(text("ALTER TABLE detalle_cobros ADD COLUMN especialista_id INTEGER"))
            
        if 'monto_comision_recepcionista' not in columns_dc:
            print("Adding monto_comision_recepcionista...")
            conn.execute(text("ALTER TABLE detalle_cobros ADD COLUMN monto_comision_recepcionista FLOAT DEFAULT 0"))
            
        if 'monto_comision_especialista' not in columns_dc:
            print("Adding monto_comision_especialista...")
            conn.execute(text("ALTER TABLE detalle_cobros ADD COLUMN monto_comision_especialista FLOAT DEFAULT 0"))

        # 2. Check PaqueteSpa columns
        columns_ps = [c['name'] for c in insp.get_columns('paquetes_spa')]
        print(f"PaqueteSpa columns: {columns_ps}")
        
        if 'comision_recepcionista' not in columns_ps:
            print("Adding comision_recepcionista to paquetes_spa...")
            conn.execute(text("ALTER TABLE paquetes_spa ADD COLUMN comision_recepcionista FLOAT DEFAULT 0"))
            
        if 'comision_especialista' not in columns_ps:
            print("Adding comision_especialista to paquetes_spa...")
            conn.execute(text("ALTER TABLE paquetes_spa ADD COLUMN comision_especialista FLOAT DEFAULT 0"))

        # 3. Check Empleados table
        if not insp.has_table('empleados'):
            print("Creating empleados table...")
            Empleado.__table__.create(engine)
        else:
            print("Table 'empleados' exists.")

        conn.commit()
        print("Schema verification complete.")

if __name__ == "__main__":
    fix_schema()
