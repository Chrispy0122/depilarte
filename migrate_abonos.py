from sqlalchemy import create_engine, text
from backend.database import SQLALCHEMY_DATABASE_URL as DATABASE_URL

def migrate_abonos():
    engine = create_engine(DATABASE_URL)
    with engine.connect() as conn:
        print("Migrating Cobros table for Abonos...")
        try:
            # Add columns if they don't exist
            # SQLite doesn't support IF NOT EXISTS in ADD COLUMN easily, so we try/except or check pragma
            # Assuming SQLite for simplicity of "try adding"
            
            try:
                conn.execute(text("ALTER TABLE cobros ADD COLUMN monto_total_venta FLOAT DEFAULT 0"))
                print("Added monto_total_venta")
            except Exception as e:
                print(f"Skipped monto_total_venta (probably exists): {e}")

            try:
                conn.execute(text("ALTER TABLE cobros ADD COLUMN monto_abonado FLOAT DEFAULT 0"))
                print("Added monto_abonado")
            except Exception as e:
                print(f"Skipped monto_abonado (probably exists): {e}")

            try:
                conn.execute(text("ALTER TABLE cobros ADD COLUMN deuda FLOAT DEFAULT 0"))
                print("Added deuda")
            except Exception as e:
                print(f"Skipped deuda (probably exists): {e}")
            
            # Update existing records
            # Set monto_abonado = total (Legacy data was fully paid)
            # Set monto_total_venta = total
            # Set deuda = 0
            print("Updating legacy data...")
            conn.execute(text("UPDATE cobros SET monto_abonado = total, monto_total_venta = total, deuda = 0 WHERE monto_abonado = 0 AND total > 0"))
            conn.commit()
            print("Migration complete.")
            
        except Exception as e:
            print(f"Migration Error: {e}")

if __name__ == "__main__":
    migrate_abonos()
