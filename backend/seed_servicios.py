import sys
import os
from sqlalchemy.orm import Session
# Add parent directory to path to allow imports from backend
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.database import SessionLocal, engine, Base
from backend.modules.servicios.models import PaqueteSpa, Base as ServiciosBase
from backend.modules.pacientes.models import Cliente
from backend.modules.agenda.models import Cita
from backend.modules.cobranza.models import Cobro, DetalleCobro
from backend.modules.staff.models import Empleado   

def seed_servicios():
    db = SessionLocal()
    
    # JSON Data source
    data = {
      "servicios_depilacion": [
        {"codigo": "CAR", "nombre": "Cara Completa", "precio_sesion": 12, "precio_paquete_4": 40, "zonas": "1", "rango_sesiones": "8 a 12"},
        {"codigo": "BOZ-M", "nombre": "Bozo + Menton", "precio_sesion": 10, "precio_paquete_4": 32, "zonas": "1", "rango_sesiones": "8 a 12"},
        {"codigo": "BARB", "nombre": "Barba", "precio_sesion": 15, "precio_paquete_4": 48, "zonas": "1", "rango_sesiones": "8 a 12"},
        {"codigo": "CUE", "nombre": "Cuello", "precio_sesion": 12, "precio_paquete_4": 40, "zonas": "1", "rango_sesiones": "8 a 12"},
        {"codigo": "ESC", "nombre": "Escote", "precio_sesion": 10, "precio_paquete_4": 32, "zonas": "1", "rango_sesiones": "8 a 12"},
        {"codigo": "AXX", "nombre": "Axilas", "precio_sesion": 10, "precio_paquete_4": 32, "zonas": "1", "rango_sesiones": "8 a 12"},
        {"codigo": "SEN", "nombre": "Senos", "precio_sesion": 10, "precio_paquete_4": 32, "zonas": "1", "rango_sesiones": "8 a 12"},
        {"codigo": "PEC", "nombre": "Pecho", "precio_sesion": 25, "precio_paquete_4": 84, "zonas": "2", "rango_sesiones": "8 a 12"},
        {"codigo": "HOM", "nombre": "Hombros", "precio_sesion": 10, "precio_paquete_4": 32, "zonas": "1", "rango_sesiones": "8 a 12"},
        {"codigo": "ABD", "nombre": "Abdomen", "precio_sesion": 20, "precio_paquete_4": 64, "zonas": "2", "rango_sesiones": "8 a 12"},
        {"codigo": "LOM", "nombre": "Linea Ombligo", "precio_sesion": 10, "precio_paquete_4": 32, "zonas": "1", "rango_sesiones": "8 a 12"},
        {"codigo": "ESP", "nombre": "Espalda", "precio_sesion": 40, "precio_paquete_4": 128, "zonas": "3 a 4", "rango_sesiones": "8 a 12"},
        {"codigo": "BRA", "nombre": "Brazos", "precio_sesion": 20, "precio_paquete_4": 64, "zonas": "2", "rango_sesiones": "8 a 12"},
        {"codigo": "MAN", "nombre": "Mano", "precio_sesion": 10, "precio_paquete_4": 32, "zonas": "1", "rango_sesiones": "8 a 12"},
        {"codigo": "PC", "nombre": "Pierna Completa", "precio_sesion": 50, "precio_paquete_4": 160, "zonas": "4 a 5", "rango_sesiones": "8 a 12"},
        {"codigo": "MP", "nombre": "Media Pierna", "precio_sesion": 30, "precio_paquete_4": 96, "zonas": "2 a 3", "rango_sesiones": "8 a 12"},
        {"codigo": "GLU", "nombre": "Gluteos", "precio_sesion": 20, "precio_paquete_4": 64, "zonas": "2", "rango_sesiones": "8 a 12"},
        {"codigo": "LB", "nombre": "Linea Bikini", "precio_sesion": 12, "precio_paquete_4": 40, "zonas": "1", "rango_sesiones": "8 a 12"},
        {"codigo": "BC", "nombre": "Bikini Completo", "precio_sesion": 20, "precio_paquete_4": 64, "zonas": "2", "rango_sesiones": "8 a 12"},
        {"codigo": "BXX", "nombre": "Brasilero", "precio_sesion": 25, "precio_paquete_4": 88, "zonas": "3", "rango_sesiones": "8 a 12"},
        {"codigo": "PER", "nombre": "Perianal", "precio_sesion": 12, "precio_paquete_4": 40, "zonas": "1", "rango_sesiones": "8 a 12"},
        {"codigo": "PIE", "nombre": "Pies", "precio_sesion": 10, "precio_paquete_4": 32, "zonas": "1", "rango_sesiones": "8 a 12"}
      ],
      "tratamientos_y_otros": [
        {"nombre": "Limpieza profunda", "precio": 14},
        {"nombre": "Limpieza premium", "precio": 20},
        {"nombre": "Hydra facial", "precio": 30},
        {"nombre": "Dermapen + Limpieza", "precio": 28},
        {"nombre": "Peeling Quimico + Limpieza facial", "precio": 35},
        {"nombre": "Reductivo aparatologia", "precio": 50},
        {"nombre": "Madero terapia + Drenaje", "precio": 50},
        {"nombre": "Masaje Relajante Dama", "precio": 35},
        {"nombre": "Masaje Relajante Caballero", "precio": 45}
      ],
      "reglas_especiales": [
         {"nombre": "Foto rejuvenecimiento", "rango_sesiones": "3 a 5"},
         {"nombre": "Foto manchas o acne", "rango_sesiones": "3 a 5"}
      ]
    }

    # Classification Logic
    FACIAL_KEYWORDS = ["Limpieza", "Hydra", "Dermapen", "Peeling"]
    CORPORAL_KEYWORDS = ["Reductivo", "Madero", "Masaje"]

    import re
    
    def get_categoria_tratamiento(nombre):
        for k in FACIAL_KEYWORDS:
            if k.lower() in nombre.lower():
                return "facial"
        for k in CORPORAL_KEYWORDS:
            if k.lower() in nombre.lower():
                return "corporal"
        return "otros"

    def calculate_commissions(categoria, nombre, precio, zonas_str):
        """
        Calcula comisiones estrictas basadas en reglas de negocio (Validado con Tests).
        """
        cat_lower = str(categoria).lower().strip()
        nombre_lower = str(nombre).lower().strip()
        precio_float = float(precio) if precio else 0.0
        
        # 1. DEPILACION (y FOTOTERAPIA que usa misma logica de zonas)
        if cat_lower == "depilacion" or cat_lower == "fototerapia":
            # Paso 1: Extraer numero de zonas
            n_zonas = 1
            if zonas_str:
                try:
                    # Encontrar todos los digitos y tomar el maximo (ej "4 a 5" -> 5)
                    nums = [int(n) for n in re.findall(r'\d+', str(zonas_str))]
                    if nums:
                        n_zonas = max(nums)
                except:
                    n_zonas = 1
            
            # Paso 2: Calculo directo
            com_recep = float(n_zonas) * 0.60
            com_spec = float(n_zonas) * 1.00
            
            return com_recep, com_spec

        # 2. FACIAL / LIMPIEZA
        elif cat_lower == "facial" or "limpieza" in nombre_lower or "facial" in nombre_lower:
            # Excepcion por nombre: Dermapen con precio 28
            if "dermapen" in nombre_lower and abs(precio_float - 28.0) < 0.1:
                return 3.00, 16.00
            
            # Reglas por Precio
            if precio_float <= 20: 
                return 2.00, 5.60
            elif precio_float > 20 and precio_float <= 35:
                # Cubre 30 y 35
                return 3.00, 12.00
            elif precio_float >= 40:
                return 3.00, 18.00
                
            return 2.00, 5.60

        # 3. CORPORAL (Masajes y Reductivos)
        elif cat_lower == "corporal" or "masaje" in nombre_lower:
            return 2.00, 7.50

        # DEFAULT (Otros)
        return 0.0, 0.0

    try:
        print("Clearing existing services...")
        db.query(PaqueteSpa).delete()
        db.commit()

        # 1. Depilacion
        print("Seeding Depilacion...")
        for item in data["servicios_depilacion"]:
            com_r, com_s = calculate_commissions("depilacion", item["nombre"], item["precio_sesion"], item["zonas"])
            
            servicio = PaqueteSpa(
                codigo=item["codigo"],
                nombre=item["nombre"],
                sesion=item["precio_sesion"],
                paquete_4_sesiones=item["precio_paquete_4"],
                num_zonas=item["zonas"],
                cantidad_sesiones=item["rango_sesiones"],
                comision_recepcionista=com_r,
                comision_especialista=com_s,
                categoria="depilacion",
                activo=1
            )
            db.add(servicio)
        
        # 2. Tratamientos Generales
        print("Seeding Tratamientos...")
        for i, item in enumerate(data["tratamientos_y_otros"]):
            words = item["nombre"].split()
            code_base = "".join([w[:3].upper() for w in words[:2]])
            code = f"TRAT-{code_base}-{i}"
            
            cat = get_categoria_tratamiento(item["nombre"])
            com_r, com_s = calculate_commissions(cat, item["nombre"], item["precio"], None)

            servicio = PaqueteSpa(
                codigo=code,
                nombre=item["nombre"],
                sesion=item["precio"],
                paquete_4_sesiones=None,
                num_zonas=None,
                cantidad_sesiones=None,
                comision_recepcionista=com_r,
                comision_especialista=com_s,
                categoria=cat,
                activo=1
            )
            db.add(servicio)

        # 3. Foto Rejuvenecimiento / Manchas
        print("Seeding Foto Rejuvenecimiento & Manchas...")
        special_rules = data["reglas_especiales"]
        
        for rule in special_rules:
            base_name = rule["nombre"]
            rango = rule["rango_sesiones"]
            prefix = "FOTO" if "rejuvenecimiento" in base_name.lower() else "MANCHA"
            
            for item in data["servicios_depilacion"]:
                new_name = f"{base_name} - {item['nombre']}"
                new_code = f"{prefix}-{item['codigo']}"
                
                com_r, com_s = calculate_commissions("fototerapia", new_name, item["precio_sesion"], item["zonas"])
                
                servicio = PaqueteSpa(
                    codigo=new_code,
                    nombre=new_name,
                    sesion=item["precio_sesion"],
                    paquete_4_sesiones=item["precio_paquete_4"],
                    num_zonas=item["zonas"],
                    cantidad_sesiones=rango,
                    comision_recepcionista=com_r,
                    comision_especialista=com_s,
                    categoria="fototerapia", # Distinct category
                    activo=1
                )
                db.add(servicio)

        db.commit()
        print("Services seeded successfully!")
        
    except Exception as e:
        print(f"Error seeding services: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_servicios()
