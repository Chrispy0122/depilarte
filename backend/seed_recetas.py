"""
Seed Script: Productos de Inventario y Recetas por Servicio
"""
import sys
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

DATABASE_URL = "sqlite:///./depilarte.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def seed_productos_y_recetas():
    db = SessionLocal()
    
    try:
        print("=" * 60)
        print("CREANDO: Productos y Recetas de Servicios")
        print("=" * 60)
        
        productos_data = [
            ("Gel Conductor IPL", "Cabina", "uso_interno", 5000.0, "ml", 1000.0, 0.05),
            ("Papel Camilla Desechable", "Desechables", "uso_interno", 500.0, "unidades", 100.0, 0.30),
            ("Crema Post-Tratamiento", "Cabina", "uso_interno", 2000.0, "ml", 500.0, 0.08),
            ("Gasas Esterilizadas", "Desechables", "uso_interno", 300.0, "unidades", 50.0, 0.15),
            ("Alcohol 70%", "Cabina", "uso_interno", 3000.0, "ml", 500.0, 0.02)
        ]
        
        print("\n[1/3] Creando Productos...")
        productos_ids = {}
        for nombre, cat, tipo, stock, unidad, minimo, costo in productos_data:
            result = db.execute(text("SELECT id FROM productos_inventario WHERE nombre = :nombre"), {"nombre": nombre}).fetchone()
            
            if result:
                print(f"  {nombre} ya existe")
                productos_ids[nombre] = result[0]
            else:
                db.execute(text("""
                    INSERT INTO productos_inventario (nombre, categoria, tipo, stock_actual, unidad_medida, stock_minimo, costo_unitario, activo)
                    VALUES (:nombre, :cat, :tipo, :stock, :unidad, :minimo, :costo, 1)
                """), {"nombre": nombre, "cat": cat, "tipo": tipo, "stock": stock, "unidad": unidad, "minimo": minimo, "costo": costo})
                db.commit()
                result = db.execute(text("SELECT id FROM productos_inventario WHERE nombre = :nombre"), {"nombre": nombre}).fetchone()
                productos_ids[nombre] = result[0]
                print(f"  Creado: {nombre}")
        
        print("\n[2/3] Obteniendo Servicios...")
        servicios = db.execute(text("SELECT id, nombre FROM servicios")).fetchall()
        print(f"  Encontrados: {len(servicios)} servicios")
        
        recetas_config = {
            "axila": [("Gel Conductor IPL", 15.0), ("Papel Camilla Desechable", 1.0), ("Crema Post-Tratamiento", 5.0), ("Alcohol 70%", 10.0)],
            "piernas": [("Gel Conductor IPL", 80.0), ("Papel Camilla Desechable", 2.0), ("Crema Post-Tratamiento", 25.0), ("Gasas Esterilizadas", 2.0), ("Alcohol 70%", 30.0)],
            "pecho": [("Gel Conductor IPL", 50.0), ("Papel Camilla Desechable", 1.0), ("Crema Post-Tratamiento", 20.0), ("Gasas Esterilizadas", 1.0), ("Alcohol 70%", 25.0)],
            "espalda": [("Gel Conductor IPL", 100.0), ("Papel Camilla Desechable", 2.0), ("Crema Post-Tratamiento", 30.0), ("Gasas Esterilizadas", 2.0), ("Alcohol 70%", 35.0)],
            "brazos": [("Gel Conductor IPL", 45.0), ("Papel Camilla Desechable", 1.0), ("Crema Post-Tratamiento", 18.0), ("Alcohol 70%", 22.0)],
            "rostro": [("Gel Conductor IPL", 20.0), ("Crema Post-Tratamiento", 10.0), ("Gasas Esterilizadas", 2.0), ("Alcohol 70%", 15.0)],
            "bozo": [("Gel Conductor IPL", 8.0), ("Crema Post-Tratamiento", 5.0), ("Gasas Esterilizadas", 1.0), ("Alcohol 70%", 10.0)],
            "bikini": [("Gel Conductor IPL", 25.0), ("Papel Camilla Desechable", 1.0), ("Crema Post-Tratamiento", 12.0), ("Gasas Esterilizadas", 1.0), ("Alcohol 70%", 18.0)],
            "brasileno": [("Gel Conductor IPL", 35.0), ("Papel Camilla Desechable", 1.0), ("Crema Post-Tratamiento", 15.0), ("Gasas Esterilizadas", 2.0), ("Alcohol 70%", 20.0)]
        }
        
        print("\n[3/3] Creando Recetas...")
        recetas_creadas = 0
        for servicio_id, servicio_nombre in servicios:
            config = None
            for key in recetas_config.keys():
                if key in servicio_nombre.lower():
                    config = recetas_config[key]
                    break
            
            if not config:
                continue
            
            exists = db.execute(text("SELECT id FROM recetas_servicio WHERE servicio_id = :sid AND activa = 1"), {"sid": servicio_id}).fetchone()
            if exists:
                print(f"  Receta ya existe para: {servicio_nombre}")
                continue
            
            db.execute(text("INSERT INTO recetas_servicio (servicio_id, descripcion, activa) VALUES (:sid, :desc, 1)"), 
                      {"sid": servicio_id, "desc": f"Receta para {servicio_nombre}"})
            db.commit()
            
            receta_id = db.execute(text("SELECT last_insert_rowid()")).fetchone()[0]
            
            for producto_nombre, cantidad in config:
                producto_id = productos_ids.get(producto_nombre)
                if producto_id:
                    db.execute(text("INSERT INTO recetas_ingredientes (receta_id, producto_id, cantidad) VALUES (:rid, :pid, :cant)"),
                              {"rid": receta_id, "pid": producto_id, "cant": cantidad})
            
            db.commit()
            recetas_creadas += 1
            print(f"  Receta creada: {servicio_nombre}")
        
        print("\n" + "=" * 60)
        print(f"COMPLETADO - Productos: {len(productos_ids)}, Recetas: {recetas_creadas}")
        print("=" * 60)
        
    except Exception as e:
        print(f"\nERROR: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_productos_y_recetas()
