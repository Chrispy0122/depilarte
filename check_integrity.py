import sqlite3
import os

LOCAL_DB_PATH = "depilarte.db"

def check():
    if not os.path.exists(LOCAL_DB_PATH):
        print("DB not found")
        return

    conn = sqlite3.connect(LOCAL_DB_PATH)
    cursor = conn.cursor()
    
    print("Checking foreign key constraints...")
    cursor.execute("PRAGMA foreign_key_check")
    errors = cursor.fetchall()
    
    if errors:
        print(f"Found {len(errors)} integrity violations:")
        for error in errors:
            # table, rowid, referent, fk_index
            print(f"  - Table: {error[0]}, RowID: {error[1]}, Ref Table: {error[2]}, FK Index: {error[3]}")
    else:
        print("No integrity violations found in local DB.")
        
    conn.close()

if __name__ == "__main__":
    check()
