
import sys
import os
import urllib.request
import json

# Add root directory to python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend.database import SessionLocal
from backend.modules.servicios.models import PaqueteSpa

log_file = "c:/Users/Windows/Documents/Depilarte/verification.log"

def log(msg):
    print(msg)
    with open(log_file, "a", encoding="utf-8") as f:
        f.write(msg + "\n")

# Clear log
with open(log_file, "w", encoding="utf-8") as f:
    f.write("--- VERIFICATION START ---\n")

# 1. CHECK DATABASE
try:
    db = SessionLocal()
    count = db.query(PaqueteSpa).count()
    log(f"DB CHECK: Found {count} packages in database.")
    
    if count == 0:
        log("❌ CRITICAL: Database is empty!")
    else:
        first = db.query(PaqueteSpa).first()
        log(f"   Sample: {first.nombre} (${first.sesion})")
        log("✅ DB seems OK.")
    db.close()
except Exception as e:
    log(f"❌ DB ERROR: {e}")

# 2. CHECK API
try:
    url = "http://127.0.0.1:8001/api/servicios/"
    log(f"API CHECK: Requesting {url}...")
    with urllib.request.urlopen(url) as response:
        if response.status == 200:
            data = json.loads(response.read().decode())
            log(f"   API returned {len(data)} items.")
            log("✅ API seems OK.")
        else:
            log(f"❌ API returned status {response.status}")
except Exception as e:
    log(f"❌ API ERROR: {e}")
    log("   (Make sure uvicorn is running on port 8001)")
