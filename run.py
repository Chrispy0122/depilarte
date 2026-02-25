import os
import sys
import multiprocessing
import logging
import webbrowser

# Redirect stdout and stderr to avoid crashes in --noconsole mode (where they are None)
if sys.stdout is None:
    sys.stdout = open(os.devnull, "w")
if sys.stderr is None:
    sys.stderr = open(os.devnull, "w")

# CRITICAL: Path Resolution at the very beginning
if getattr(sys, 'frozen', False):
    # PyInstaller creates a temp folder and stores path in _MEIPASS
    base_path = sys._MEIPASS
    # For --onedir, _MEIPASS is the root of the extracted folder containing _internal
    # If the executable is in the same folder as _internal, we need to be careful.
    # Actually, sys._MEIPASS is the folder where the EXE or the shared libs are.
    # We want to be in the same folder where 'backend' and 'frontend' directories exist.
else:
    base_path = os.path.dirname(os.path.abspath(__file__))

# Move into the base path immediately to satisfy relative path imports/db
os.chdir(base_path)

# Set up logging early
log_file = os.path.join(base_path, "execution_log.txt")
logging.basicConfig(
    filename=log_file,
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

logging.info(f"System starting. Base Path: {base_path}")
logging.info(f"CWD: {os.getcwd()}")

# Add base path to sys.path
sys.path.append(base_path)

def open_browser():
    try:
        logging.info("Attempting to open browser...")
        webbrowser.open("http://localhost:8000")
    except Exception as e:
        logging.error(f"Failed to open browser: {e}")

if __name__ == "__main__":
    multiprocessing.freeze_support()
    
    try:
        logging.info("Importing backend.main...")
        # Import app AFTER chdir and path setup
        from backend.main import app
        logging.info("Backend app imported successfully")
        
        import uvicorn
        
        # Launch browser
        open_browser()
        
        logging.info("Starting uvicorn server...")
        uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
        
    except Exception as e:
        logging.critical(f"FATAL ERROR: {e}", exc_info=True)
        # Since this is --noconsole, we hope the log file captures this.
