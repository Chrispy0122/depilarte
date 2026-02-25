
import sqlite3
import os

DB_PATH = "c:/Users/Windows/Documents/Depilarte/depilarte.db"

def seed_sqlite():
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Check if table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='paquetes_spa'")
        if not cursor.fetchone():
            print("Creating table...")
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS paquetes_spa (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    codigo VARCHAR(20) NOT NULL UNIQUE,
                    nombre VARCHAR(200) NOT NULL,
                    sesion INTEGER NOT NULL,
                    paquete_4_sesiones INTEGER,
                    num_zonas VARCHAR(20),
                    cantidad_sesiones VARCHAR(20),
                    categoria VARCHAR(50) DEFAULT 'depilacion',
                    activo INTEGER DEFAULT 1
                )
            """)
        else:
            print("Table exists. Clearing...")
            cursor.execute("DELETE FROM paquetes_spa")
        
        paquetes_data = [
            # DEPILACIÓN - Zonas Corporales
            ("CAR", "Cara Completa", 12, 40, "1", "8 a 12", "depilacion"),
            ("BOZ-M", "Bozo + Mentón", 10, 32, "1", "8 a 12", "depilacion"),
            ("BARB", "Barba", 15, 48, "1", "8 a 12", "depilacion"),
            ("CUE", "Cuello", 12, 40, "1", "8 a 12", "depilacion"),
            ("ESC", "Escote", 10, 32, "1", "8 a 12", "depilacion"),
            ("AXX", "Axilas", 10, 32, "1", "8 a 12", "depilacion"),
            ("SEN", "Senos", 10, 32, "1", "8 a 12", "depilacion"),
            ("PEC", "Pecho", 25, 84, "2", "8 a 12", "depilacion"),
            ("HOM", "Hombros", 10, 32, "1", "8 a 12", "depilacion"),
            ("ABD", "Abdomen", 20, 64, "2", "8 a 12", "depilacion"),
            ("LOM", "Línea Ombligo", 10, 32, "1", "8 a 12", "depilacion"),
            ("ESP", "Espalda", 40, 128, "3 a 4", "8 a 12", "depilacion"),
            ("BRA", "Brazos", 20, 64, "2", "8 a 12", "depilacion"),
            ("MAN", "Manos", 10, 32, "1", "8 a 12", "depilacion"),
            ("PC", "Pierna Completa", 50, 160, "4 a 5", "8 a 12", "depilacion"),
            ("MP", "Media Pierna", 30, 96, "2 a 3", "8 a 12", "depilacion"),
            ("GLU", "Glúteos", 20, 64, "2", "8 a 12", "depilacion"),
            ("LB", "Línea Bikini", 12, 40, "1", "8 a 12", "depilacion"),
            ("B", "Bikini Completo", 20, 64, "2", "8 a 12", "depilacion"),
            ("BXX", "Brasilero", 25, 88, "3", "8 a 12", "depilacion"),
            ("PER", "Perianal", 12, 40, "1", "8 a 12", "depilacion"),
            ("PIE", "Pies", 10, 32, "1", "8 a 12", "depilacion"),
            
            # TRATAMIENTOS FACIALES
            ("FOTO-REJUV", "Foto rejuvenecimiento (mismo precio de depilación)", 0, None, None, "3 a 5", "facial"),
            ("FOTO-MANCHA", "Foto mancha o acné (mismo precio de depilación)", 0, None, None, "3 a 5", "facial"),
            ("LIMP-PROF", "Limpieza profunda", 14, None, None, None, "facial"),
            ("LIMP-PREM", "Limpieza premium", 20, None, None, None, "facial"),
            ("HYDRA-FAC", "Hydra facial", 30, None, None, None, "facial"),
            ("DERMA-LIMP", "Dermapen + Limpieza", 28, None, None, None, "facial"),
            ("PEEL-QUIM", "Peeling Químico + Limpieza facial", 35, None, None, None, "facial"),
            
            # TRATAMIENTOS CORPORALES
            ("RED-APAT", "Reductivo aparatología", 50, None, None, None, "corporal"),
            ("MAD-TER", "Madero terapia + Drenaje", 50, None, None, None, "corporal"),
            ("MASAJ-REL-D", "Masaje Relajante Dama", 35, None, None, None, "corporal"),
            ("MASAJ-REL-C", "Masaje Relajante Caballero", 45, None, None, None, "corporal")
        ]
        
        print(f"Inserting {len(paquetes_data)} rows...")
        cursor.executemany("""
            INSERT INTO paquetes_spa (codigo, nombre, sesion, paquete_4_sesiones, num_zonas, cantidad_sesiones, categoria)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, paquetes_data)
        
        conn.commit()
        print("Success!")
        conn.close()
        
        # Write success file
        with open("c:/Users/Windows/Documents/Depilarte/sqlite_seed_success.txt", "w") as f:
            f.write("OK")
            
    except Exception as e:
        print(f"Error: {e}")
        with open("c:/Users/Windows/Documents/Depilarte/sqlite_seed_error.txt", "w") as f:
            f.write(str(e))

if __name__ == "__main__":
    seed_sqlite()
