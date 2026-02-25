import os
import sys
import logging
import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Ensure project root is in system path so 'backend' can be imported
base_dir = os.path.dirname(os.path.abspath(__file__))
if base_dir not in sys.path:
    sys.path.insert(0, base_dir)

# Set up logging format
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def format_value_for_mysql(value):
    """
    Format Python values into valid MySQL string representations.
    """
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "1" if value else "0"
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, (datetime.datetime, datetime.date)):
        # Ensure it creates a string like '2023-12-01 15:30:00'
        return f"'{value.strftime('%Y-%m-%d %H:%M:%S')}'"
    
    # Escape single quotes in strings
    cleaned_string = str(value).replace("'", "\\'")
    return f"'{cleaned_string}'"

def generate_mysql_dump():
    logger.info("Iniciando generación de script SQL para MySQL...")
    output_file = os.path.join(base_dir, "migracion_depilarte.sql")
    
    # 1. Load all models to register them with Base.metadata
    logger.info("Cargando esquemas de SQLAlchemy...")
    from backend.database import Base
    import backend.modules.pacientes.models
    import backend.modules.servicios.models
    import backend.modules.agenda.models
    import backend.modules.cobranza.models
    import backend.modules.inventario.models
    import backend.modules.staff.models

    # 2. Local Database Connection (Source)
    local_db_path = os.path.join(base_dir, "depilarte.db")
    if not os.path.exists(local_db_path):
        logger.error(f"No se encontró la DB local en: {local_db_path}")
        return
        
    local_url = f"sqlite:///{local_db_path}"
    local_engine = create_engine(local_url)
    LocalSession = sessionmaker(bind=local_engine)

    local_session = LocalSession()
    
    try:
        with open(output_file, "w", encoding="utf-8") as f:
            f.write("-- MIGRACIÓN DE DATOS DEPILARTE (SQLITE -> MYSQL)\n")
            f.write("-- Generado automáticamente para evitar problemas de compatibilidad.\n")
            f.write("-- Desactivar chequeos de FKs durante la importación:\n")
            f.write("SET FOREIGN_KEY_CHECKS=0;\n\n")
            
            # 3. Iterate tables obeying Foreign Key Constraints
            for table in Base.metadata.sorted_tables:
                logger.info(f"Procesando tabla: {table.name}...")
                
                # We won't generate CREATE TABLE since Base.metadata.create_all() handles that cleaner.
                # Just the INSERT statements.
                f.write(f"\n-- Datos para la tabla `{table.name}`\n")
                
                from sqlalchemy import text
                stmt = text(f"SELECT * FROM `{table.name}`")
                
                records = local_session.execute(stmt).mappings().all()
                if not records:
                    f.write(f"-- (Sin registros encontrados)\n")
                    continue
                
                # Fetch columns directly from the keys of the first row
                columns = list(records[0].keys())
                columns_str = ", ".join([f"`{col}`" for col in columns])
                
                for row_idx, row in enumerate(records):
                    values = []
                    for col in columns:
                        raw_value = row[col]
                        formatted_value = format_value_for_mysql(raw_value)
                        values.append(formatted_value)
                    
                    values_str = ", ".join(values)
                    
                    # Generate INSERT statement
                    insert_stmt = f"INSERT INTO `{table.name}` ({columns_str}) VALUES ({values_str});\n"
                    f.write(insert_stmt)
                    
            # Wrap up
            f.write("\n-- Reactivar choqueos de Foráneas\n")
            f.write("SET FOREIGN_KEY_CHECKS=1;\n")
            
        logger.info(f"✅ ¡Archivo SQL generado exitosamente en: {output_file}!")
        logger.info("Abre este archivo en MySQL Workbench y ejecútalo para volcar tu data.")
            
    except Exception as e:
        logger.error(f"❌ Ocurrió un error generando el SQL: {e}")
    finally:
        local_session.close()

if __name__ == "__main__":
    generate_mysql_dump()
