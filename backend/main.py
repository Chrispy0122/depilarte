from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlalchemy.orm import Session
import os
import sys
import subprocess
import atexit
import threading
import signal
import logging

# --- FILTER LOGS FOR /api/bot/status ---
class EndpointFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        # Avoid logging /api/bot/status requests
        return record.args and len(record.args) >= 3 and "/api/bot/status" not in str(record.args[2])

logging.getLogger("uvicorn.access").addFilter(EndpointFilter())

# ─── BOT PROCESS MANAGEMENT (MODULE-LEVEL SINGLETON) ──────────────────────────
# Almacenamos el proceso vivo aquí para poder matarlo después.
_bot_process: subprocess.Popen = None
_bot_process_lock = threading.Lock()

# Construir la ruta ABSOLUTA al index.js del chatbot (funciona sin importar
# desde qué directorio se arranque uvicorn).
BACKEND_DIR  = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR     = os.path.dirname(BACKEND_DIR)
CHATBOT_DIR  = os.path.join(ROOT_DIR, "chatbot")
CHATBOT_SCRIPT = os.path.join(CHATBOT_DIR, "index.js")

# Archivo de log para salida del proceso Node (rotativo, máx 2MB)
BOT_LOG_FILE = os.path.join(BACKEND_DIR, "bot_node.log")


def _kill_zombie_nodes():
    """Mata cualquier proceso node.js anterior que siga corriendo el chatbot."""
    try:
        # Windows: taskkill /F mata todos los node.exe
        subprocess.run(
            ["taskkill", "/F", "/IM", "node.exe"],
            capture_output=True, timeout=5
        )
    except Exception:
        pass  # Sin nodo que matar — está bien


def _start_bot_process():
    """Inicia el proceso Node.js del chatbot con ruta absoluta.
    Retorna (True, "") en éxito o (False, mensaje_error) en fallo."""
    global _bot_process
    with _bot_process_lock:
        # 1. Verificar que el script existe
        if not os.path.isfile(CHATBOT_SCRIPT):
            return False, f"Archivo no encontrado: {CHATBOT_SCRIPT}"

        # 2. Matar zombis previos
        _kill_zombie_nodes()

        # 3. Abrir archivo de log (append) para redirigir stdout/stderr
        # IMPORTANTE: NO usar subprocess.PIPE — en Windows el buffer se llena
        # rápidamente con la salida de puppeteer/whatsapp-web.js y el proceso
        # se queda bloqueado (deadlock). Redirigir a fichero es la solución.
        try:
            log_file = open(BOT_LOG_FILE, "a", encoding="utf-8", errors="replace")
        except Exception:
            import subprocess as sp
            log_file = sp.DEVNULL   # Fallback: descartar salida

        # 4. Arrancar el nuevo proceso
        try:
            _bot_process = subprocess.Popen(
                ["node", CHATBOT_SCRIPT],
                cwd=CHATBOT_DIR,       # CWD = carpeta chatbot para que los require() funcionen
                stdout=log_file,
                stderr=log_file,
                # Crear grupo de proceso propio en Windows para poder matarlo limpiamente
                creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if sys.platform == "win32" else 0
            )
            # Hilo monitor: detecta si el proceso muere y actualiza el estado
            _start_monitor_thread()
            return True, ""
        except FileNotFoundError:
            return False, "'node' no está en el PATH. ¿Node.js está instalado?"
        except Exception as ex:
            return False, str(ex)


def _start_monitor_thread():
    """Lanza un hilo demonio que vigila el proceso Node y actualiza el estado
    del bot si el proceso muere inesperadamente."""
    def _monitor():
        import time
        time.sleep(2)  # Darle chance a Node.js de arrancar bien antes de vigilar
        
        if _bot_process is not None:
            proc = _bot_process
            proc.wait()  # Bloquea hasta que el proceso termina
            
            # Verificar nuevamente porque _stop_bot_process pudo haberlo vuelto None
            if _bot_process is not None:
                rc = _bot_process.returncode
                print(f"[BOT MONITOR] Proceso Node.js terminó con código: {rc}")
                # Solo marcar como error si no fue un apagado limpio (returncode != 0 y != -15)
                if rc not in (0, -15, 1):  # 1 en Windows cuando se mata con CTRL_BREAK
                    _save_bot_state({"status": "ERROR", "qr": None,
                                     "error": f"Node.js terminó inesperadamente (código {rc})"})
    t = threading.Thread(target=_monitor, daemon=True)
    t.start()


def _stop_bot_process():
    """Detiene el proceso Node.js si está corriendo."""
    global _bot_process
    with _bot_process_lock:
        if _bot_process and _bot_process.poll() is None:
            try:
                _bot_process.terminate()
                _bot_process.wait(timeout=5)
            except Exception:
                _bot_process.kill()
        _bot_process = None

# Asegurarse de matar el proceso node cuando FastAPI se cierre
atexit.register(_stop_bot_process)

# Ensure backend directory is in path (sometimes needed for absolute imports if running from root)
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from backend.database import engine, Base, get_db
from backend.modules.core.models import Negocio

# --- IMPORT MODELS FOR SQLALCHEMY (MANDATORY) ---
# This registers the models with Base.metadata so create_all() works.
from backend.modules.pacientes import models as pacientes_models
from backend.modules.servicios import models as servicios_models
from backend.modules.agenda import models as agenda_models
from backend.modules.cobranza import models as cobranza_models
from backend.modules.inventario import models as inventario_models
from backend.modules.staff import models as staff_models
import backend.models # Register legacy models

# --- CREATE TABLES ---
# Base.metadata.create_all(bind=engine)  # Comentado para agilizar el arranque en Aiven (las tablas ya deben existir)

app = FastAPI(title="DEPILARTE System - Backend Refactored")

# --- MIDDLEWARE ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- INCLUDE ROUTERS ---
from backend.modules.pacientes.router import router as pacientes_router
from backend.modules.agenda.router import router as agenda_router
from backend.modules.cobranza.router import router as cobranza_router
from backend.modules.dashboard.router import router as dashboard_router
from backend.modules.inventario.router import router as inventario_router
from backend.modules.servicios.router import router as servicios_router
from backend.modules.staff.router import router as staff_router

app.include_router(pacientes_router) # Internally prefixed: /api/pacientes
app.include_router(agenda_router, prefix="/api/agenda") # Needs prefix
app.include_router(cobranza_router) # Internally prefixed: /api/cobranza
app.include_router(dashboard_router) # Internally prefixed: /api/dashboard
app.include_router(inventario_router) # Internally prefixed: /api/inventario
app.include_router(servicios_router) # Internally prefixed: /api/servicios
app.include_router(staff_router) # Internally prefixed: /api/staff

# --- FIX TEMPORAL: Migracion Aiven ---
@app.get("/fix-tasa-bcv")
def fix_tasa_bcv(db=Depends(get_db)):
    try:
        db.execute(text("ALTER TABLE cobros ADD COLUMN tasa_bcv FLOAT;"))
        db.commit()
        return {"status": "ok", "message": "Columna tasa_bcv agregada con exito a Aiven"}
    except Exception as e:
        db.rollback()
        return {"status": "error", "message": str(e)}

# --- DEBUG ROUTE (temporal - diagnostico en Render) ---
@app.get("/debug-path")
def debug_path():
    import os
    current_dir = os.path.dirname(os.path.abspath(__file__))
    root_dir = os.path.dirname(current_dir)

    def list_dir_safe(path):
        result = []
        if os.path.exists(path):
            for r, dirs, files in os.walk(path):
                for f in files:
                    result.append(os.path.join(r, f).replace(root_dir, ""))
        return result

    static_path   = os.path.join(root_dir, "frontend", "static")
    frontend_path = os.path.join(root_dir, "frontend")

    return {
        "current_dir": current_dir,
        "root_dir": root_dir,
        "frontend_path": frontend_path,
        "frontend_exists": os.path.exists(frontend_path),
        "static_path": static_path,
        "static_exists": os.path.exists(static_path),
        "files_in_static": list_dir_safe(static_path),
        "files_in_frontend_root": [
            f for f in list_dir_safe(frontend_path)
            if not f.startswith("/frontend/static")
        ]
    }

# --- RUTAS PARA EL KILL SWITCH DEL BOT ---
class BotToggleRequest(BaseModel):
    bot_activo: bool

@app.get("/api/negocio/{negocio_id}/estado-bot")
def obtener_estado_bot(negocio_id: int, db: Session = Depends(get_db)):
    negocio = db.query(Negocio).filter(Negocio.id == negocio_id).first()
    if not negocio:
        raise HTTPException(status_code=404, detail="Negocio no encontrado")
    
    return {"bot_activo": negocio.bot_activo}

@app.put("/api/negocio/{negocio_id}/toggle-bot")
def toggle_estado_bot(negocio_id: int, payload: BotToggleRequest, db: Session = Depends(get_db)):
    negocio = db.query(Negocio).filter(Negocio.id == negocio_id).first()
    if not negocio:
        raise HTTPException(status_code=404, detail="Negocio no encontrado")
    
    negocio.bot_activo = payload.bot_activo
    db.commit()
    db.refresh(negocio)
    
    return {"status": "ok", "bot_activo": negocio.bot_activo}


@app.post("/api/bot/start")
def start_bot():
    """Endpoint que el Dashboard llama para ARRANCAR el proceso Node.js del chatbot.
    Limpia zombis, verifica rutas y devuelve un error real si algo falla."""
    # Resetear estado a STARTING antes de lanzar
    _save_bot_state({"status": "STARTING", "qr": None})

    ok, error_msg = _start_bot_process()
    if not ok:
        # Guardar estado de error para que el polling del front lo vea
        _save_bot_state({"status": "ERROR", "qr": None, "error": error_msg})
        raise HTTPException(
            status_code=500,
            detail=f"Error: No se pudo iniciar el proceso de Node.js. {error_msg}"
        )
    return {"status": "ok", "message": "Proceso Node.js iniciado correctamente.",
            "script": CHATBOT_SCRIPT}


@app.post("/api/bot/stop")
def stop_bot():
    """Endpoint que el Dashboard llama para DETENER el proceso Node.js."""
    _stop_bot_process()
    _kill_zombie_nodes()  # segunda pasada por si quedó algo
    _save_bot_state({"status": "OFFLINE", "qr": None})
    return {"status": "ok", "message": "Proceso Node.js detenido."}


@app.get("/api/bot/process-status")
def bot_process_status():
    """Diagnóstico: retorna si el proceso Node está vivo + ruta usada."""
    alive = _bot_process is not None and _bot_process.poll() is None
    return {
        "process_alive": alive,
        "chatbot_script_path": CHATBOT_SCRIPT,
        "chatbot_script_exists": os.path.isfile(CHATBOT_SCRIPT),
        "chatbot_dir": CHATBOT_DIR,
    }

@app.get("/fix-bot-activo")
def fix_bot_activo(db: Session = Depends(get_db)):
    try:
        db.execute(text("ALTER TABLE negocios ADD COLUMN bot_activo BOOLEAN DEFAULT TRUE;"))
        db.commit()
        return {"status": "ok", "message": "¡Columna bot_activo agregada con éxito!"}
    except Exception as e:
        db.rollback()
        return {"status": "error", "message": str(e)}

@app.get("/force-bot-off")
def force_bot_off(db: Session = Depends(get_db)):
    try:
        db.execute(text("UPDATE negocios SET bot_activo = FALSE;"))
        db.commit()
        return {"status": "ok", "message": "Bot maestro apagado a la fuerza exitosamente."}
    except Exception as e:
        db.rollback()
        return {"status": "error", "message": str(e)}

# --- ESTADO DEL BOT (Persistente ante reloads de Uvicorn) ---
# Usamos un archivo JSON simple para que el estado sobreviva reinicios de FastAPI.
import json

BOT_STATUS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "bot_state.json")

def _load_bot_state():
    try:
        if os.path.exists(BOT_STATUS_FILE):
            with open(BOT_STATUS_FILE, "r") as f:
                return json.load(f)
    except Exception:
        pass
    return {"status": "STARTING", "qr": None}

def _save_bot_state(state: dict):
    try:
        with open(BOT_STATUS_FILE, "w") as f:
            json.dump(state, f)
    except Exception:
        pass

from typing import Dict, Any

@app.post("/api/bot/webhook")
def bot_webhook(payload: Dict[str, Any]):
    # Extracción flexible a prueba de errores 422
    status_val = payload.get("status") or payload.get("state") or "UNKNOWN"
    qr_val = payload.get("qr")
    
    state = {"status": status_val, "qr": qr_val}
    _save_bot_state(state)
    return {"status": "received"}

@app.get("/api/bot/status")
def bot_status():
    return _load_bot_state()

# --- STATIC FILES & FRONTEND ROUTING ---
from fastapi.responses import FileResponse

# Obtener la ruta del directorio actual (backend)
current_dir = os.path.dirname(os.path.abspath(__file__))
# Subir un nivel y entrar a frontend
frontend_path = os.path.join(os.path.dirname(current_dir), "frontend")
# Subir un nivel y entrar a frontend/static
static_path = os.path.join(os.path.dirname(current_dir), "frontend", "static")

if os.path.exists(static_path):
    # 1. Montar /static apuntando a frontend/static (JS, CSS, imágenes, manifest)
    app.mount("/static", StaticFiles(directory=static_path), name="static")
else:
    print(f"WARNING: Static path not found at {static_path}")

if os.path.exists(frontend_path):
    # 2. Rutas HTML específicas
    @app.get("/")
    async def serve_login():
        return FileResponse(os.path.join(frontend_path, "login.html"))

    @app.get("/dashboard")
    async def serve_dashboard():
        from fastapi import Response
        # NO CACHE para asegurar que el frontend siempre traiga la versión más reciente
        # esto previene el problema donde el botón activar todavía tenía el código viejo
        headers = {
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
        }
        return FileResponse(os.path.join(frontend_path, "index.html"), headers=headers)

    # 3. Montar todo el resto del frontend (otros HTMLs, etc.)
    # html=False evita conflicto con la ruta "/" de login
    app.mount("/", StaticFiles(directory=frontend_path, html=False), name="frontend")
else:
    print(f"WARNING: Frontend path not found at {frontend_path}")


