import os
import sys
from dotenv import load_dotenv

# 1. Configurar el path para que Python pueda encontrar el paquete 'backend'
base_dir = os.path.dirname(os.path.abspath(__file__))
if base_dir not in sys.path:
    sys.path.insert(0, base_dir)

# 2. Cargar las variables de entorno donde está tu MYSQL_DATABASE_URL
# Cargamos el .env que está en la raíz del proyecto
load_dotenv(os.path.join(base_dir, ".env"))

# 3. Importar el engine y el Base de tu módulo local local database.py
from backend.database import engine, Base

# 4. ¡CRÍTICO! Importar de manera explícita todos tus modelos SQLAlchemy.
# Esto garantiza que SQLAlchemy registre las clases como tablas en Base.metadata
# antes de que ejecutemos el comando create_all().
import backend.modules.pacientes.models
import backend.modules.servicios.models
import backend.modules.agenda.models
import backend.modules.cobranza.models
import backend.modules.inventario.models
import backend.modules.staff.models

def crear_tablas():
    print("Conectando a MySQL mediante PyMySQL...")
    try:
        # 5. Generar la estructura de tablas vacías
        Base.metadata.create_all(bind=engine)
        print("EXITO: ¡Estructura de la base de datos creada EXITOSAMENTE en MySQL!")
        print("Ya puedes ir a MySQL Workbench e importar tus datos desde migracion_depilarte.sql.")
    except Exception as e:
        print(f"ERROR: Error al crear las tablas: {e}")

if __name__ == "__main__":
    crear_tablas()
