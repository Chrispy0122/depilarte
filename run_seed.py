
import sys
import os

# Add root directory to python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Log file setup
log_file = "c:/Users/Windows/Documents/Depilarte/seed_execution.log"

def log(msg):
    # print(msg) # Disabled to avoid encoding errors on Windows console
    with open(log_file, "a", encoding="utf-8") as f:
        f.write(msg + "\n")

# Clear log
with open(log_file, "w", encoding="utf-8") as f:
    f.write("Starting execution...\n")

try:
    log("Importing backend.seed_paquetes_spa...")
    from backend.seed_paquetes_spa import seed_paquetes
    log("Calling seed_paquetes()...")
    seed_paquetes()
    log("Execution finished successfully.")
except Exception as e:
    log(f"CRITICAL ERROR: {e}")
