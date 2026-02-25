log_file = "c:/Users/Windows/Documents/Depilarte/debug_db_log.txt"

def log(msg):
    # print(msg) 
    with open(log_file, "a", encoding="utf-8") as f:
        f.write(msg + "\n")

# Clear log
with open(log_file, "w", encoding="utf-8") as f:
    f.write("--- DB DEBUG START ---\n")

try:
    from sqlalchemy import create_engine, inspect
    from backend.database import SQLALCHEMY_DATABASE_URL, engine
    from backend.modules.servicios.models import PaqueteSpa
    from backend.database import SessionLocal
except Exception as e:
    log(f"CRITICAL IMPORT ERROR: {e}")
    sys.exit(1)

def log(msg):
    # print(msg) # Disabled for safety
    with open(log_file, "a", encoding="utf-8") as f:
        f.write(msg + "\n")

# Clear log
with open(log_file, "w", encoding="utf-8") as f:
    f.write("--- DB DEBUG START ---\n")

log(f"DATABASE URL: {SQLALCHEMY_DATABASE_URL}")

try:
    # Check tables
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    log(f"Tables found: {tables}")
    
    if "paquetes_spa" not in tables:
        log("❌ CRITICAL: Table 'paquetes_spa' DOES NOT EXIST in this database.")
    else:
        log("✅ Table 'paquetes_spa' exists.")
        
        # Check data
        db = SessionLocal()
        count = db.query(PaqueteSpa).count()
        log(f"Row count in 'paquetes_spa': {count}")
        
        if count > 0:
            first = db.query(PaqueteSpa).first()
            log(f"Sample data: {first.nombre} - ${first.sesion}")
        else:
            log("⚠️ Table exists but is empty!")
        db.close()

except Exception as e:
    log(f"❌ Error inspecting DB: {e}")
