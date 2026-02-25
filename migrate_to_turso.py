import os
import sys
import logging
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Ensure project root is in system path so 'backend' can be imported
base_dir = os.path.dirname(os.path.abspath(__file__))
if base_dir not in sys.path:
    sys.path.insert(0, base_dir)

# Set up logging format
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def migrate():
    logger.info("Iniciando Proceso de Migración: Local SQLite -> Turso Serverless DB")
    
    # 1. Load all models to register them with Base.metadata
    logger.info("Cargando módulos y esquemas de SQLAlchemy...")
    from backend.database import Base
    import backend.modules.pacientes.models
    import backend.modules.servicios.models
    import backend.modules.agenda.models
    import backend.modules.cobranza.models
    import backend.modules.inventario.models
    import backend.modules.staff.models

    # 2. Local Database Connection (Source)
    # The default location created by uvicorn running from the root is usually the root dir
    local_db_path = os.path.join(base_dir, "depilarte.db")
    if not os.path.exists(local_db_path):
        logger.error(f"No se encontró la base de datos local en: {local_db_path}")
        return
        
    local_url = f"sqlite:///{local_db_path}"
    local_engine = create_engine(local_url)
    LocalSession = sessionmaker(bind=local_engine)
    logger.info(f"Conectado a la base de datos local (Origen): {local_db_path}")

    # 3. Turso Database Connection (Destination)
    load_dotenv(os.path.join(base_dir, "backend", ".env")) # Ensuring the specific backend env is loaded
    load_dotenv(os.path.join(base_dir, ".env")) # Fallback to root env
    
    turso_url = os.getenv("TURSO_DATABASE_URL")
    turso_token = os.getenv("TURSO_AUTH_TOKEN")
    
    if not turso_url or not turso_token:
        logger.error("¡Faltan TURSO_DATABASE_URL o TURSO_AUTH_TOKEN en el archivo .env!")
        return
        
    # Ensure compatible sqlite+libsql dialect for SQLAlchemy
    db_url = turso_url.replace("libsql://", "sqlite+libsql://")
    remote_url = f"{db_url}?authToken={turso_token}&secure=true"
    
    logger.info(f"Conectando a Turso DB en la nube...")
    remote_engine = create_engine(remote_url)
    RemoteSession = sessionmaker(bind=remote_engine)
    
    # 4. Recreate Table Structure in Turso
    logger.info("Creando estructura de tablas en la base de datos remota (Si no existen)...")
    try:
        Base.metadata.create_all(bind=remote_engine, checkfirst=True)
        logger.info("Tablas validadas/creadas exitosamente en Turso.")
    except Exception as e:
        logger.error(f"Error creando tablas en Turso: {e}")
        return

    # 5. Migrate Data (Table by Table respecting Foreign Keys)
    # Base.metadata.sorted_tables returns tables sorted by their dependencies
    local_session = LocalSession()
    remote_session = RemoteSession()
    
    try:
        for table in Base.metadata.sorted_tables:
            logger.info(f"Analizando tabla origen: {table.name}...")
            
            # Fetch all existing rows as mappings/dicts from local db using Core syntax
            local_records = local_session.execute(table.select()).mappings().all()
            
            if not local_records:
                logger.info(f"  -> La tabla '{table.name}' está vacía. Saltando.")
                continue
                
            records_to_insert = [dict(row) for row in local_records]
            
            # Check if remote already has records to prevent duplication during a retry
            existing_remote_records = remote_session.execute(table.select().limit(1)).fetchall()
            if existing_remote_records:
                logger.warning(f"  -> La tabla '{table.name}' ya tiene registros en Turso. Se omitirá para evitar duplicados.")
                continue
            
            # Execute Bulk Insert into Turso
            remote_session.execute(table.insert(), records_to_insert)
            logger.info(f"  -> Volcados {len(records_to_insert)} registros en '{table.name}'.")
            
        # Commit the massive transaction
        logger.info("Guardando los cambios de forma definitiva (Commit)...")
        remote_session.commit()
        logger.info("✅ ¡Migración de SQLite a Turso completada EXITOSAMENTE! Ya puedes desplegar tu backend configurando las variables.")
        
    except Exception as e:
        remote_session.rollback()
        logger.error(f"❌ Ocurrió un error copiando los registros. Transacción abortada (Rollback ejecutado): {e}")
    finally:
        local_session.close()
        remote_session.close()

if __name__ == "__main__":
    migrate()
