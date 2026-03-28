from datetime import datetime, timedelta
import random
import sys
import os

# Add the project root to the python path to allow imports from backend
sys.path.append(os.getcwd())

from backend.database import SessionLocal, engine, Base
from backend.modules.pacientes.models import Cliente
from backend.modules.agenda.models import Cita, EstadoCita
from backend.modules.cobranza.models import Pago

# Data Pools
NOMBRES = [
    "María", "Ana", "Valentina", "Camila", "Isabella", "Sofía", "Daniela", "Gabriela", "Victoria", "Andrea",
    "José", "Carlos", "Luis", "Jesús", "Miguel", "Alejandro", "Gabriel", "David", "Diego", "Fernando"
]
APELLIDOS = [
    "Pérez", "González", "Rodríguez", "Hernández", "García", "Martínez", "López", "Suárez", "Silva", "Gómez",
    "Díaz", "Fernández", "Alvarez", "Rojas", "Jiménez", "Mendoza", "Castillo", "Flores", "Toro", "Vargas"
]
PREFIXES = ["0414", "0424", "0412", "0416"]

def seed_data():
    db = SessionLocal()
    try:
        print("Dropping all tables to ensure schema update...")
        Base.metadata.drop_all(bind=engine)
        # Create tables
        Base.metadata.create_all(bind=engine)

        print("Creating Clients for Retention Testing...")
        
        now = datetime.now()
        today = now.date()
        
        # Calculate dates
        start_of_week = now - timedelta(days=now.weekday())
        
        # 1. FIVE URGENT CLIENTS (Date = Today)
        print("Creating 5 Urgent Clients (Date = Today)...")
        for i in range(5):
            nom = random.choice(NOMBRES)
            ape = "Urgente" # Tag for easy ID
            full_name = f"{nom} {ape} {i+1}"
            hist = f"URG-{100 + i}"
            phone = f"{random.choice(PREFIXES)} {random.randint(1000000, 9999999)}"
            
            cedula = f"V-{random.randint(10000000, 30000000)}"
            freq = random.choice([15, 21, 30, 45])
            
            cliente = Cliente(
                nombre_completo=full_name,
                cedula=cedula,
                numero_historia=hist,
                telefono=phone,
                email=f"urgent{i}@depilarte.com",
                frecuencia_visitas=freq,
                fecha_proxima_estimada=today # HOY
            )
            db.add(cliente)

        # 2. FIVE THIS WEEK CLIENTS (Distributed)
        print("Creating 5 This-Week Clients (Distributed)...")
        for i in range(5):
            nom = random.choice(NOMBRES)
            ape = "Semana" # Tag for easy ID
            full_name = f"{nom} {ape} {i+1}"
            hist = f"SEM-{100 + i}"
            phone = f"{random.choice(PREFIXES)} {random.randint(1000000, 9999999)}"
            cedula_w = f"V-{random.randint(10000000, 30000000)}"
            freq = random.choice([15, 21, 30, 45])
            
            # Random day mon-sun
            random_day = start_of_week + timedelta(days=random.randint(0, 6))
            
            cliente = Cliente(
                nombre_completo=full_name,
                cedula=cedula_w,
                numero_historia=hist,
                telefono=phone,
                email=f"weekly{i}@depilarte.com",
                frecuencia_visitas=freq,
                fecha_proxima_estimada=random_day.date()
            )
            db.add(cliente)

        # 3. FILLER CLIENTS (Future dates, shouldn't appear)
        print("Creating 5 Filler Clients (Next Week)...")
        next_week = start_of_week + timedelta(weeks=1)
        for i in range(5):
            nom = random.choice(NOMBRES)
            ape = "Futuro"
            full_name = f"{nom} {ape} {i+1}"
            hist = f"FUT-{100 + i}"
            
            cedula = f"V-{random.randint(10000000, 30000000)}"
            
            cliente = Cliente(
                nombre_completo=full_name,
                cedula=cedula,
                numero_historia=hist,
                telefono="0000000",
                email=f"client{i}@example.com",
                fecha_proxima_estimada=(next_week + timedelta(days=i)).date()
            )
            db.add(cliente)

        # 4. SEED SERVICES (OFFICIAL PRICE LIST)
        print("Seeding Official Services List...")
        
        # Clear existing services first to avoid duplicates/conflicts
        try:
            from backend.modules.agenda.models import Servicio
            db.query(Servicio).delete()
            db.commit()
        except Exception as e:
            print(f"Warning clearing services: {e}")

        servicios_depilarte = [
            # DEPILACIÓN (Zonas)
            {"nombre": "Cara Completa", "precio_sesion": 12.0, "precio_paquete": 40.0, "cat": "Depilacion"},
            {"nombre": "Bozo + Mentón", "precio_sesion": 10.0, "precio_paquete": 32.0, "cat": "Depilacion"},
            {"nombre": "Barba", "precio_sesion": 15.0, "precio_paquete": 48.0, "cat": "Depilacion"},
            {"nombre": "Cuello", "precio_sesion": 12.0, "precio_paquete": 40.0, "cat": "Depilacion"},
            {"nombre": "Escote", "precio_sesion": 10.0, "precio_paquete": 32.0, "cat": "Depilacion"},
            {"nombre": "Axilas", "precio_sesion": 10.0, "precio_paquete": 32.0, "cat": "Depilacion"},
            {"nombre": "Senos", "precio_sesion": 10.0, "precio_paquete": 32.0, "cat": "Depilacion"},
            {"nombre": "Pecho", "precio_sesion": 25.0, "precio_paquete": 84.0, "cat": "Depilacion"},
            {"nombre": "Hombros", "precio_sesion": 10.0, "precio_paquete": 32.0, "cat": "Depilacion"},
            {"nombre": "Abdomen", "precio_sesion": 20.0, "precio_paquete": 64.0, "cat": "Depilacion"},
            {"nombre": "Línea Ombligo", "precio_sesion": 10.0, "precio_paquete": 32.0, "cat": "Depilacion"},
            {"nombre": "Espalda", "precio_sesion": 40.0, "precio_paquete": 128.0, "cat": "Depilacion"},
            {"nombre": "Brazos", "precio_sesion": 20.0, "precio_paquete": 64.0, "cat": "Depilacion"},
            {"nombre": "Manos", "precio_sesion": 10.0, "precio_paquete": 32.0, "cat": "Depilacion"},
            {"nombre": "Pierna Completa", "precio_sesion": 50.0, "precio_paquete": 160.0, "cat": "Depilacion"},
            {"nombre": "Media Pierna", "precio_sesion": 30.0, "precio_paquete": 96.0, "cat": "Depilacion"},
            {"nombre": "Glúteos", "precio_sesion": 20.0, "precio_paquete": 64.0, "cat": "Depilacion"},
            {"nombre": "Línea Bikini", "precio_sesion": 12.0, "precio_paquete": 40.0, "cat": "Depilacion"},
            {"nombre": "Bikini Completo", "precio_sesion": 20.0, "precio_paquete": 64.0, "cat": "Depilacion"},
            {"nombre": "Brasilero", "precio_sesion": 25.0, "precio_paquete": 88.0, "cat": "Depilacion"},
            {"nombre": "Perianal", "precio_sesion": 12.0, "precio_paquete": 40.0, "cat": "Depilacion"},
            {"nombre": "Pies", "precio_sesion": 10.0, "precio_paquete": 32.0, "cat": "Depilacion"},

            # OTROS TRATAMIENTOS
            {"nombre": "Limpieza Profunda", "precio_sesion": 14.0, "precio_paquete": None, "cat": "Facial"},
            {"nombre": "Limpieza Premium", "precio_sesion": 20.0, "precio_paquete": None, "cat": "Facial"},
            {"nombre": "Hydra Facial", "precio_sesion": 30.0, "precio_paquete": None, "cat": "Facial"},
            {"nombre": "Dermapen + Limpieza", "precio_sesion": 28.0, "precio_paquete": None, "cat": "Facial"},
            {"nombre": "Peeling Químico + Limpieza", "precio_sesion": 35.0, "precio_paquete": None, "cat": "Facial"},
            {"nombre": "Reductivo Aparatología", "precio_sesion": 50.0, "precio_paquete": None, "cat": "Corporal"},
            {"nombre": "Maderoterapia + Drenaje", "precio_sesion": 50.0, "precio_paquete": None, "cat": "Corporal"},
            {"nombre": "Masaje Relajante Dama", "precio_sesion": 35.0, "precio_paquete": None, "cat": "Corporal"},
            {"nombre": "Masaje Relajante Caballero", "precio_sesion": 45.0, "precio_paquete": None, "cat": "Corporal"}
        ]

        for s in servicios_depilarte:
            nuevo_servicio = Servicio(
                nombre=s["nombre"],
                descripcion=f"Tratamiento de {s['nombre']}",
                precio_sesion=s["precio_sesion"],
                precio_paquete=s["precio_paquete"],
                duracion_minutos=30,
                categoria=s["cat"]
            )
            db.add(nuevo_servicio)

        db.commit()
        print(f"Seed completed! Created 10 Target Clients and {len(servicios_depilarte)} Services.")
        print("Note: NO Appointments were created, as requested.")
        
    except Exception as e:
        print(f"Error seeding data: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_data()
