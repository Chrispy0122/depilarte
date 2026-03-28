from sqlalchemy import create_engine, text
import os
from dotenv import load_dotenv
from pathlib import Path

# Load .env
BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

MYSQL_DATABASE_URL = os.getenv("MYSQL_DATABASE_URL")
if MYSQL_DATABASE_URL and MYSQL_DATABASE_URL.startswith("mysql://"):
    db_url = MYSQL_DATABASE_URL.replace("mysql://", "mysql+pymysql://")
else:
    db_url = MYSQL_DATABASE_URL or "sqlite:///./depilarte.db"

engine = create_engine(db_url)

def run_migration():
    with engine.connect() as conn:
        print("Checking/Updating schema...")
        
        # Add especialista_id to citas if not present
        try:
            conn.execute(text("ALTER TABLE citas ADD COLUMN especialista_id INT NULL"))
            print("Column 'especialista_id' added to table 'citas'.")
        except Exception as e:
            if "Duplicate column name" in str(e) or "already exists" in str(e).lower():
                print("Column 'especialista_id' already exists in 'citas'.")
            else:
                print(f"Error adding column to 'citas': {e}")

        # Add rol to empleados if not present (just in case)
        try:
            conn.execute(text("ALTER TABLE empleados ADD COLUMN rol VARCHAR(50) NULL"))
            print("Column 'rol' added to table 'empleados'.")
        except Exception as e:
            if "Duplicate column name" in str(e) or "already exists" in str(e).lower():
                print("Column 'rol' already exists in 'empleados'.")
            else:
                print(f"Error adding column to 'empleados': {e}")
        
        conn.commit()
    print("Done.")

if __name__ == "__main__":
    run_migration()
