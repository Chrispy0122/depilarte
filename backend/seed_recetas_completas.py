"""
Script: Crear recetas para TODOS los servicios usando productos existentes
"""
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

DATABASE_URL = "sqlite:///./depilarte.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def crear_recetas_completas():
    db = SessionLocal()
    
    try:
        print("=" * 70)
        print("CREANDO RECETAS PARA TODOS LOS SERVICIOS")
        print("=" * 70)
        
        # 1. Obtener todos los productos existentes
        productos = db.execute(text("SELECT id, nombre FROM productos_inventario")).fetchall()
        productos_map = {nombre: pid for pid, nombre in productos}
        
        print(f"\nProductos disponibles: {len(productos)}")
        
        # 2. Obtener todos los servicios
        servicios = db.execute(text("SELECT id, nombre FROM servicios")).fetchall()
        print(f"Servicios encontrados: {len(servicios)}\n")
        
        # 3. Definir recetas para TODOS los servicios
        # Clasificacion por tamano de area y tipo de tratamiento
        recetas_config = {
            # === DEPILACION LASER - AREAS PEQUENAS ===
            "axilas": [("Gel Conductor", 15.0), ("Papel Camilla Desechable", 1.0), ("Discos de Algodón", 2.0)],
            "bozo": [("Gel Conductor", 8.0), ("Discos de Algodón", 2.0), ("Guantes", 2.0)],
            "menton": [("Gel Conductor", 8.0), ("Discos de Algodón", 2.0)],
            "cuello": [("Gel Conductor", 20.0), ("Papel Camilla Desechable", 1.0), ("Discos de Algodón", 3.0)],
            "escote": [("Gel Conductor", 25.0), ("Papel Camilla Desechable", 1.0), ("Discos de Algodón", 3.0)],
            "linea ombligo": [("Gel Conductor", 15.0), ("Discos de Algodón", 2.0)],
            "linea bikini": [("Gel Conductor", 20.0), ("Papel Camilla Desechable", 1.0), ("Discos de Algodón", 3.0), ("Guantes", 2.0)],
            "manos": [("Gel Conductor", 20.0), ("Discos de Algodón", 2.0)],
            "pies": [("Gel Conductor", 25.0), ("Discos de Algodón", 2.0)],
            "perianal": [("Gel Conductor", 20.0), ("Papel Camilla Desechable", 1.0), ("Guantes", 2.0), ("Discos de Algodón", 3.0)],
            
            # === DEPILACION LASER - AREAS MEDIANAS ===
            "cara completa": [("Gel Conductor", 30.0), ("Discos de Algodón", 4.0), ("Guantes", 2.0)],
            "barba": [("Gel Conductor", 35.0), ("Discos de Algodón", 4.0), ("Guantes", 2.0)],
            "senos": [("Gel Conductor", 40.0), ("Papel Camilla Desechable", 1.0), ("Discos de Algodón", 3.0)],
            "pecho": [("Gel Conductor", 50.0), ("Papel Camilla Desechable", 1.0), ("Discos de Algodón", 4.0)],
            "abdomen": [("Gel Conductor", 50.0), ("Papel Camilla Desechable", 1.0), ("Discos de Algodón", 4.0)],
            "hombros": [("Gel Conductor", 45.0), ("Papel Camilla Desechable", 1.0), ("Discos de Algodón", 3.0)],
            "media pierna": [("Gel Conductor", 60.0), ("Papel Camilla Desechable", 1.0), ("Discos de Algodón", 4.0)],
            "brazos": [("Gel Conductor", 50.0), ("Papel Camilla Desechable", 1.0), ("Discos de Algodón", 4.0)],
            
            # === DEPILACION LASER - AREAS GRANDES ===
            "pierna completa": [("Gel Conductor", 100.0), ("Papel Camilla Desechable", 2.0), ("Discos de Algodón", 6.0)],
            "espalda": [("Gel Conductor", 120.0), ("Papel Camilla Desechable", 2.0), ("Discos de Algodón", 6.0)],
            "gluteos": [("Gel Conductor", 80.0), ("Papel Camilla Desechable", 1.0), ("Discos de Algodón", 5.0), ("Guantes", 2.0)],
            
            # === DEPILACION LASER - AREAS ESPECIFICAS ===
            "linea bikini": [("Gel Conductor", 20.0), ("Papel Camilla Desechable", 1.0), ("Discos de Algodón", 3.0), ("Guantes", 2.0)],
            "linea ombligo": [("Gel Conductor", 15.0), ("Discos de Algodón", 2.0)],
            
            # === DEPILACION LASER - ZONAS INTIMAS ===
            "bikini completo": [("Gel Conductor", 35.0), ("Papel Camilla Desechable", 1.0), ("Guantes", 2.0), ("Discos de Algodón", 4.0)],
            "brasilero": [("Gel Conductor", 45.0), ("Papel Camilla Desechable", 1.0), ("Guantes", 2.0), ("Discos de Algodón", 5.0)],
            
            # === TRATAMIENTOS FACIALES ===
            "limpieza profunda": [("Aloe Gel", 20.0), ("Discos de Algodón", 8.0), ("Guantes", 2.0), ("Toallas Húmedas", 2.0)],
            "limpieza premium": [("Aloe Gel", 25.0), ("Discos de Algodón", 10.0), ("Guantes", 2.0), ("Toallas Húmedas", 2.0)],
            "hydra facial": [("Gel Anti Bacterial", 15.0), ("Discos de Algodón", 10.0), ("Guantes", 2.0), ("Toallas Húmedas", 2.0)],
            "dermapen": [("Aloe Gel", 20.0), ("Guantes", 2.0), ("Discos de Algodón", 8.0), ("Agua Destilada", 50.0)],
            "peeling quimico": [("Aloe Gel", 20.0), ("Discos de Algodón", 10.0), ("Guantes", 2.0), ("Toallas Húmedas", 3.0)],
            
            # === TRATAMIENTOS CORPORALES ===
            "maderoterapia": [("Gel Anti Bacterial", 50.0), ("Papel Camilla Desechable", 2.0), ("Toallón", 1.0)],
            "drenaje": [("Gel Anti Bacterial", 40.0), ("Papel Camilla Desechable", 2.0), ("Toallón", 1.0)],
            "masaje relajante": [("Aloe Gel", 100.0), ("Papel Camilla Desechable", 2.0), ("Toallón", 2.0)],
            "reductivo": [("Gel Conductor", 80.0), ("Papel Camilla Desechable", 2.0), ("Toallón", 1.0)]
        }
        
        print("Creando recetas...\n")
        recetas_creadas = 0
        servicios_sin_receta = []
        
        for servicio_id, servicio_nombre in servicios:
            # Buscar configuracion de receta
            config = None
            servicio_lower = servicio_nombre.lower()
            
            for key, ingredientes in recetas_config.items():
                if key in servicio_lower:
                    config = ingredientes
                    break
            
            if not config:
                servicios_sin_receta.append(servicio_nombre)
                continue
            
            # Verificar si ya existe receta
            existe = db.execute(text("""
                SELECT id FROM recetas_servicio 
                WHERE servicio_id = :sid AND activa = 1
            """), {"sid": servicio_id}).fetchone()
            
            if existe:
                print(f"  [EXISTE] {servicio_nombre}")
                continue
            
            # Crear receta
            db.execute(text("""
                INSERT INTO recetas_servicio (servicio_id, descripcion, activa)
                VALUES (:sid, :desc, 1)
            """), {
                "sid": servicio_id,
                "desc": f"Receta automatica para {servicio_nombre}"
            })
            db.commit()
            
            receta_id = db.execute(text("SELECT last_insert_rowid()")).fetchone()[0]
            
            # Agregar ingredientes
            ingredientes_ok = 0
            for producto_nombre, cantidad in config:
                producto_id = productos_map.get(producto_nombre)
                if producto_id:
                    db.execute(text("""
                        INSERT INTO recetas_ingredientes (receta_id, producto_id, cantidad)
                        VALUES (:rid, :pid, :cant)
                    """), {"rid": receta_id, "pid": producto_id, "cant": cantidad})
                    ingredientes_ok += 1
            
            db.commit()
            recetas_creadas += 1
            print(f"  [CREADA] {servicio_nombre} ({ingredientes_ok} ingredientes)")
        
        print("\n" + "=" * 70)
        print(f"RESULTADO:")
        print(f"  Recetas creadas: {recetas_creadas}")
        if servicios_sin_receta:
            print(f"\n  Servicios sin receta configurada ({len(servicios_sin_receta)}):")
            for s in servicios_sin_receta:
                print(f"    - {s}")
        print("=" * 70)
        
    except Exception as e:
        print(f"\nERROR: {e}")
        db.rollback()
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    crear_recetas_completas()
