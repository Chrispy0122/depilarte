import sqlite3
import libsql_client
import os
import time

from dotenv import load_dotenv

load_dotenv()

TURSO_DATABASE_URL = os.getenv("TURSO_DATABASE_URL").replace("sqlite+libsql://", "https://") if os.getenv("TURSO_DATABASE_URL") else None
TURSO_AUTH_TOKEN = os.getenv("TURSO_AUTH_TOKEN")
LOCAL_DB_PATH = "depilarte.db"

def migrate():
    print("Starting migration using BATCH...")
    
    if not os.path.exists(LOCAL_DB_PATH):
        print(f"Error: Local database {LOCAL_DB_PATH} not found.")
        return

    local_conn = sqlite3.connect(LOCAL_DB_PATH)
    local_cursor = local_conn.cursor()
    
    try:
        remote_client = libsql_client.create_client_sync(
            url=TURSO_DATABASE_URL,
            auth_token=TURSO_AUTH_TOKEN
        )
    except Exception as e:
        print(f"Error connecting to Turso: {e}")
        return

    print("Connected to both databases.")

    local_cursor.execute("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    tables_data = local_cursor.fetchall()

    batch_stmts = []
    
    import re
    # 2. Drop and Create Tables
    for table_name, create_sql in tables_data:
        # Strip FOREIGN KEY constraints to allow migration of orphan data
        # Regex to remove table-level constraints: , FOREIGN KEY (...) REFERENCES ...
        # Simplified: remove everything starting with , FOREIGN KEY up to ) or end
        # But we need to be careful not to match inside string literals (unlikely in CREATE TABLE)
        # And handle nested parens? No, FK syntax is usually flat.
        
        # Remove table-level FOREIGN KEY
        create_sql_clean = re.sub(r',\s*FOREIGN\s+KEY\s*\(.*?\)\s*REFERENCES\s*\w+\s*\(.*?\)(?:\s*ON\s+\w+\s+\w+)*', '', create_sql, flags=re.IGNORECASE | re.DOTALL)
        
        # Remove column-level REFERENCES (e.g. "col INTEGER REFERENCES other(id)")
        create_sql_clean = re.sub(r'\s+REFERENCES\s+\w+\s*\(.*?\)(?:\s*ON\s+\w+\s+\w+)*', '', create_sql_clean, flags=re.IGNORECASE | re.DOTALL)
        
        print(f"DEBUG: Original SQL for {table_name}:\n{create_sql}")
        print(f"DEBUG: Cleaned SQL for {table_name}:\n{create_sql_clean}")
        
        batch_stmts.append(f"DROP TABLE IF EXISTS {table_name}")
        batch_stmts.append(create_sql_clean)
        
    # 3. Insert Data
    total_rows = 0
    for table_name, _ in tables_data:
        local_cursor.execute(f"SELECT * FROM {table_name}")
        rows = local_cursor.fetchall()
        
        if not rows:
            continue
            
        col_count = len(local_cursor.description)
        placeholders = ",".join(["?"] * col_count)
        insert_sql = f"INSERT INTO {table_name} VALUES ({placeholders})"
        
        for row in rows:
            # Add as (sql, args) tuple for batch
            batch_stmts.append((insert_sql, list(row)))
            total_rows += 1
            
    print(f"Prepared batch with {len(batch_stmts)} statements (Total data rows: {total_rows}). Sending...")
    
    try:
        # Execute batch
        # Depending on size, we might need to chunk if Turso rejects huge payloads.
        # But let's try all at once first. 340KB DB results in maybe 500KB JSON payload. Turso should handle it.
        # If it fails with "Payload Too Large" (413), we will know.
        
        remote_client.batch(batch_stmts)
        print("Batch execution successful! Migration complete.")
        
    except Exception as e:
        # We patched http.py so we should see the error
        import traceback
        traceback.print_exc()
        print(f"Batch execution failed: {type(e).__name__}: {e}")

    local_conn.close()
    remote_client.close()

if __name__ == "__main__":
    migrate()
