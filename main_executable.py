import os
import sys
import webbrowser
import uvicorn
import multiprocessing

# Verify if running as executable
if getattr(sys, 'frozen', False):
    # PyInstaller creates a temp folder and stores path in _MEIPASS
    base_path = sys._MEIPASS
else:
    base_path = os.path.dirname(os.path.abspath(__file__))

# Add base path to sys.path so backend imports work
sys.path.append(base_path)

if __name__ == "__main__":
    multiprocessing.freeze_support()
    
    # Define paths
    backend_dir = os.path.join(base_path, "backend")
    frontend_dir = os.path.join(base_path, "frontend")
    
    print(f"Starting Depilarte System...")
    print(f"Root: {base_path}")
    
    # Open Browser Loop
    def open_browser():
        webbrowser.open("http://localhost:8000")
        
    # Run Server
    # We use string import "backend.main:app" for reload=False, but here we can import the app object directly?
    # Better to use the string if we can ensure path is correct, or the app object.
    # Using app object explicitly avoids import string issues in frozen exe.
    
    try:
        from backend.main import app
        
        # Override StaticFiles directory to be absolute path in frozen mode
        # This is CRITICAL because the original main.py might use relative paths
        # We need to ensure main.py's static mount points to the correct place.
        # But we can't easily patch main.py from here without monkeypatching.
        # However, backend.main likely does: app.mount("/", StaticFiles(directory="frontend", html=True))
        # If "frontend" is relative, it depends on CWD.
        # So we must set CWD to base_path or ensure "frontend" exists in CWD.
        
        if getattr(sys, 'frozen', False):
             os.chdir(base_path)

        # Launch Browser
        # threading.Timer(1.5, open_browser).start()
        open_browser()
        
        # Run
        uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
        
    except Exception as e:
        print(f"Critical Error: {e}")
        input("Press Enter to exit...")
