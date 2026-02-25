from sqlalchemy.orm import Session
from backend.database import SessionLocal, engine
from backend.modules.pacientes import models as pacientes_models
from backend.modules.agenda import models as agenda_models
from backend.modules.cobranza import models as cobranza_models
import backend.models # Register legacy models
from datetime import datetime, timedelta

def debug_data():
    db = SessionLocal()
    try:
        # Check Clients
        clients = db.query(pacientes_models.Cliente).all()
        print(f"--- CLIENTES ({len(clients)}) ---")
        for c in clients:
            print(f"ID: {c.id}, Nombre: {c.nombre_completo}")

        if not clients:
            print("Creating test client...")
            test_client = pacientes_models.Cliente(
                numero_historia="TEST001", 
                nombre_completo="Paciente Prueba", 
                telefono="555-0000"
            )
            db.add(test_client)
            db.commit()
            print("Test client created.")
        
        # Check Appointments (Citas)
        citas = db.query(agenda_models.Cita).all()
        print(f"\n--- CITAS ({len(citas)}) ---")
        for c in citas:
            print(f"ID: {c.id}, Cliente ID: {c.cliente_id}, Fecha: {c.fecha_hora_inicio}, Estado: {c.estado}")

        # Check if there are appointments for THIS week (Dashboard View)
        today = datetime.now()
        start_week = today - timedelta(days=today.weekday())
        end_week = start_week + timedelta(days=7)
        
        week_citas = [c for c in citas if start_week <= c.fecha_hora_inicio <= end_week]
        
        if not week_citas:
            print(f"\nNo appointments found for this week ({start_week.date()} to {end_week.date()}).")
            print("Creating test appointment for TODAY...")
            
            # Find a client
            client = db.query(pacientes_models.Cliente).first()
            
            # Find or Create a Service
            service = db.query(agenda_models.Servicio).first()
            if not service:
                print("Creating test service...")
                service = agenda_models.Servicio(
                    nombre="Consulta General",
                    descripcion="Consulta de rutina",
                    precio_sesion=50.0,
                    duracion_minutos=30
                )
                db.add(service)
                db.commit()
                db.refresh(service)
            
            new_cita = agenda_models.Cita(
                cliente_id=client.id,
                servicio_id=service.id,
                fecha_hora_inicio=datetime.now(),
                fecha_hora_fin=datetime.now() + timedelta(minutes=30),
                estado=agenda_models.EstadoCita.PENDIENTE
            )
            db.add(new_cita)
            db.commit()
            print("Test appointment created for NOW.")
            
    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    debug_data()
