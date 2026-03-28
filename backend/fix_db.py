import sys
import os
from sqlalchemy import text # Fix: Import text for SQL execution
from datetime import datetime, timedelta
import random

# Add project root to path
sys.path.append(os.getcwd())

from backend.database import SessionLocal, engine, Base
from backend.modules.agenda.models import Cita, Servicio, EstadoCita
from backend.modules.pacientes.models import Cliente
# Import Cobranza models to ensure they are registered for relationships
import backend.modules.cobranza.models

def fix_database():
    db = SessionLocal()
    try:
        print("--- STARTING EMERGENCY RECOVERY ---")
        
        # 1. Drop Intermediate Table if exists
        print("1. Dropping 'cita_servicios' table...")
        try:
            db.execute(text("DROP TABLE IF EXISTS cita_servicios"))
            db.commit()
            print("   -> Dropped (or didn't exist).")
        except Exception as e:
            print(f"   -> Error dropping table: {e}")
            db.rollback()

        # 2. Clear Citas Table
        print("2. Clearing 'citas' table...")
        try:
            db.query(Cita).delete()
            db.commit()
            print("   -> Citas table cleared.")
        except Exception as e:
            print(f"   -> Error clearing quotes: {e}")
            db.rollback()

        # 3. Verify Clients
        client_count = db.query(Cliente).count()
        print(f"3. Verifying Clients... Found: {client_count}")
        if client_count == 0:
            print("   -> WARNING: No clients found! Seeding dummy clients...")
            # Seed dummy if 0 (Safety net, though user said 124 exist)
            for i in range(5):
                c = Cliente(
                    nombre_completo=f"Cliente {i}",
                    numero_historia=f"H{i}",
                    telefono="555-5555"
                )
                db.add(c)
            db.commit()
            client_count = 5

        # 4. Verify Services
        service_count = db.query(Servicio).count()
        print(f"4. Verifying Services... Found: {service_count}")
        if service_count == 0:
            print("   -> WARNING: No services found! Seeding dummy services...")
            servicios_data = [
                {"nombre": "Depilación Laser Piernas", "precio_sesion": 50.0},
                {"nombre": "Limpieza Facial", "precio_sesion": 30.0},
                {"nombre": "Masaje Relajante", "precio_sesion": 40.0}
            ]
            for s in servicios_data:
                db.add(Servicio(**s))
            db.commit()
        
        # 5. Seed New Citas (Single Service)
        print("5. Seeding valid Citas (1-1 Service)...")
        clients = db.query(Cliente).limit(10).all()
        services = db.query(Servicio).limit(3).all()
        
        citas_created = 0
        today = datetime.now().date()
        
        # Create some for Today and Tomorrow
        for day_offset in [0, 1]:
            target_date = today + timedelta(days=day_offset)
            start_hour = 9 # 9 AM
            
            for i in range(3): # 3 appts per day
                cliente = random.choice(clients)
                servicio = random.choice(services)
                
                # Time logic
                hour = start_hour + (i * 2) # Every 2 hours
                start_dt = datetime.combine(target_date, datetime.min.time().replace(hour=hour))
                end_dt = start_dt + timedelta(minutes=servicio.duracion_minutos or 30)
                
                cita = Cita(
                    cliente_id=cliente.id,
                    servicio_id=servicio.id,
                    fecha_hora_inicio=start_dt,
                    fecha_hora_fin=end_dt,
                    monto_estimado=servicio.precio_sesion,
                    estado=EstadoCita.PENDIENTE,
                    servicio_nombre=servicio.nombre
                )
                db.add(cita)
                citas_created += 1
        
        db.commit()
        print(f"   -> Successfully created {citas_created} appointments.")
        print("--- RECOVERY COMPLETE ---")

    except Exception as e:
        print(f"CRITICAL ERROR: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    fix_database()
