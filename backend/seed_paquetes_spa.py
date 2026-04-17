
from backend.database import SessionLocal, engine
from backend.modules.servicios.models import PaqueteSpa
import backend.models as models

def seed_paquetes():
    print("Connecting to database...")
    # Crear tablas si no existen
    try:
        models.Base.metadata.create_all(bind=engine)
    except Exception as e:
        print(f"❌ Error creating tables: {e}")
        return
    
    db = SessionLocal()
    
    try:
        # Verificar si ya existen datos
        existing = db.query(PaqueteSpa).count()
        if existing > 0:
            print(f"⚠️  Ya existen {existing} paquetes. Limpiando...")
            db.query(PaqueteSpa).delete()
            db.commit()
        
        # Datos extraídos de la imagen (REVISADO CON PRECISIÓN)
        paquetes_data = [
            # DEPILACIÓN - Zonas Corporales
            {"codigo": "CAR", "nombre": "Cara Completa", "sesion": 12, "paquete_4_sesiones": 40, "num_zonas": "1", "cantidad_sesiones": "8 a 12", "categoria": "depilacion"},
            {"codigo": "BOZ-M", "nombre": "Bozo + Mentón", "sesion": 10, "paquete_4_sesiones": 32, "num_zonas": "1", "cantidad_sesiones": "8 a 12", "categoria": "depilacion"},
            {"codigo": "BARB", "nombre": "Barba", "sesion": 15, "paquete_4_sesiones": 48, "num_zonas": "1", "cantidad_sesiones": "8 a 12", "categoria": "depilacion"},
            {"codigo": "CUE", "nombre": "Cuello", "sesion": 12, "paquete_4_sesiones": 40, "num_zonas": "1", "cantidad_sesiones": "8 a 12", "categoria": "depilacion"},
            {"codigo": "ESC", "nombre": "Escote", "sesion": 10, "paquete_4_sesiones": 32, "num_zonas": "1", "cantidad_sesiones": "8 a 12", "categoria": "depilacion"},
            {"codigo": "AXX", "nombre": "Axilas", "sesion": 10, "paquete_4_sesiones": 32, "num_zonas": "1", "cantidad_sesiones": "8 a 12", "categoria": "depilacion"},
            {"codigo": "SEN", "nombre": "Senos", "sesion": 10, "paquete_4_sesiones": 32, "num_zonas": "1", "cantidad_sesiones": "8 a 12", "categoria": "depilacion"},
            {"codigo": "PEC", "nombre": "Pecho", "sesion": 25, "paquete_4_sesiones": 84, "num_zonas": "2", "cantidad_sesiones": "8 a 12", "categoria": "depilacion"},
            {"codigo": "HOM", "nombre": "Hombros", "sesion": 10, "paquete_4_sesiones": 32, "num_zonas": "1", "cantidad_sesiones": "8 a 12", "categoria": "depilacion"},
            {"codigo": "ABD", "nombre": "Abdomen", "sesion": 20, "paquete_4_sesiones": 64, "num_zonas": "2", "cantidad_sesiones": "8 a 12", "categoria": "depilacion"},
            {"codigo": "LOM", "nombre": "Línea Ombligo", "sesion": 10, "paquete_4_sesiones": 32, "num_zonas": "1", "cantidad_sesiones": "8 a 12", "categoria": "depilacion"},
            {"codigo": "ESP", "nombre": "Espalda", "sesion": 40, "paquete_4_sesiones": 128, "num_zonas": "3 a 4", "cantidad_sesiones": "8 a 12", "categoria": "depilacion"},
            {"codigo": "BRA", "nombre": "Brazos", "sesion": 20, "paquete_4_sesiones": 64, "num_zonas": "2", "cantidad_sesiones": "8 a 12", "categoria": "depilacion"},
            {"codigo": "MAN", "nombre": "Manos", "sesion": 10, "paquete_4_sesiones": 32, "num_zonas": "1", "cantidad_sesiones": "8 a 12", "categoria": "depilacion"},
            {"codigo": "PC", "nombre": "Pierna Completa", "sesion": 50, "paquete_4_sesiones": 160, "num_zonas": "4 a 5", "cantidad_sesiones": "8 a 12", "categoria": "depilacion"},
            {"codigo": "MP", "nombre": "Media Pierna", "sesion": 30, "paquete_4_sesiones": 96, "num_zonas": "2 a 3", "cantidad_sesiones": "8 a 12", "categoria": "depilacion"},
            {"codigo": "GLU", "nombre": "Glúteos", "sesion": 20, "paquete_4_sesiones": 64, "num_zonas": "2", "cantidad_sesiones": "8 a 12", "categoria": "depilacion"},
            {"codigo": "LB", "nombre": "Línea Bikini", "sesion": 12, "paquete_4_sesiones": 40, "num_zonas": "1", "cantidad_sesiones": "8 a 12", "categoria": "depilacion"},
            {"codigo": "B", "nombre": "Bikini Completo", "sesion": 20, "paquete_4_sesiones": 64, "num_zonas": "2", "cantidad_sesiones": "8 a 12", "categoria": "depilacion"},
            {"codigo": "BXX", "nombre": "Brasilero", "sesion": 25, "paquete_4_sesiones": 88, "num_zonas": "3", "cantidad_sesiones": "8 a 12", "categoria": "depilacion"},
            {"codigo": "PER", "nombre": "Perianal", "sesion": 12, "paquete_4_sesiones": 40, "num_zonas": "1", "cantidad_sesiones": "8 a 12", "categoria": "depilacion"},
            {"codigo": "PIE", "nombre": "Pies", "sesion": 10, "paquete_4_sesiones": 32, "num_zonas": "1", "cantidad_sesiones": "8 a 12", "categoria": "depilacion"},
            
            # TRATAMIENTOS FACIALES
            {"codigo": "FOTO-REJUV", "nombre": "Foto rejuvenecimiento (mismo precio de depilación)", "sesion": 0, "paquete_4_sesiones": None, "num_zonas": None, "cantidad_sesiones": "3 a 5", "categoria": "facial"},
            {"codigo": "FOTO-MANCHA", "nombre": "Foto mancha o acné (mismo precio de depilación)", "sesion": 0, "paquete_4_sesiones": None, "num_zonas": None, "cantidad_sesiones": "3 a 5", "categoria": "facial"},
            {"codigo": "LIMP-PROF", "nombre": "Limpieza profunda", "sesion": 14, "paquete_4_sesiones": None, "num_zonas": None, "cantidad_sesiones": None, "categoria": "facial"},
            {"codigo": "LIMP-PREM", "nombre": "Limpieza premium", "sesion": 20, "paquete_4_sesiones": None, "num_zonas": None, "cantidad_sesiones": None, "categoria": "facial"},
            {"codigo": "HYDRA-FAC", "nombre": "Hydra facial", "sesion": 30, "paquete_4_sesiones": None, "num_zonas": None, "cantidad_sesiones": None, "categoria": "facial"},
            {"codigo": "DERMA-LIMP", "nombre": "Dermapen + Limpieza", "sesion": 28, "paquete_4_sesiones": None, "num_zonas": None, "cantidad_sesiones": None, "categoria": "facial"},
            {"codigo": "PEEL-QUIM", "nombre": "Peeling Químico + Limpieza facial", "sesion": 35, "paquete_4_sesiones": None, "num_zonas": None, "cantidad_sesiones": None, "categoria": "facial"},
            
            # TRATAMIENTOS CORPORALES
            {"codigo": "RED-APAT", "nombre": "Reductivo aparatología", "sesion": 50, "paquete_4_sesiones": None, "num_zonas": None, "cantidad_sesiones": None, "categoria": "corporal"},
            {"codigo": "MAD-TER", "nombre": "Madero terapia + Drenaje", "sesion": 50, "paquete_4_sesiones": None, "num_zonas": None, "cantidad_sesiones": None, "categoria": "corporal"},
            {"codigo": "MASAJ-REL-D", "nombre": "Masaje Relajante Dama", "sesion": 35, "paquete_4_sesiones": None, "num_zonas": None, "cantidad_sesiones": None, "categoria": "corporal"},
            {"codigo": "MASAJ-REL-C", "nombre": "Masaje Relajante Caballero", "sesion": 45, "paquete_4_sesiones": None, "num_zonas": None, "cantidad_sesiones": None, "categoria": "corporal"},
        ]
        
        # Insertar datos
        for data in paquetes_data:
            paquete = PaqueteSpa(**data)
            db.add(paquete)
        
        db.commit()
        
        # Log success to file
        with open("c:/Users/Windows/Documents/Depilarte/seed_result.log", "w", encoding="utf-8") as f:
            f.write(f"SUCCESS: Inserted {len(paquetes_data)} packages.\n")
            
        print(f"[OK] Se insertaron {len(paquetes_data)} paquetes correctamente!")
        
    except Exception as e:
        # Log error to file
        with open("c:/Users/Windows/Documents/Depilarte/seed_result.log", "w", encoding="utf-8") as f:
            f.write(f"ERROR: {str(e)}\n")
        print(f"[ERROR] Error during seeding: {e}")
        db.rollback()
        raise e # Re-raise to ensure calling script knows it failed
    finally:
        db.close()
