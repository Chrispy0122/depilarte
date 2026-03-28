from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
import sys

# Ensure backend directory is in path (sometimes needed for absolute imports if running from root)
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from backend.database import engine, Base, get_db

# --- IMPORT MODELS FOR SQLALCHEMY (MANDATORY) ---
# This registers the models with Base.metadata so create_all() works.
from backend.modules.pacientes import models as pacientes_models
from backend.modules.agenda import models as agenda_models
from backend.modules.cobranza import models as cobranza_models
from backend.modules.inventario import models as inventario_models
from backend.modules.staff import models as staff_models
import backend.models # Register legacy models

# --- CREATE TABLES ---
Base.metadata.create_all(bind=engine)

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

# --- STATIC FILES & FRONTEND ROUTING ---
from fastapi.responses import FileResponse

# Ruta raíz del proyecto (un nivel arriba de backend/)
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_DIR = os.path.join(ROOT_DIR, "frontend")

# ── 1. Montar carpetas de assets del frontend ─────────────────────────────────
# Cada subcarpeta se monta en su propia ruta URL para no interferir con la API

js_path  = os.path.join(FRONTEND_DIR, "JS")
css_path = os.path.join(FRONTEND_DIR, "css")
img_path = os.path.join(FRONTEND_DIR, "img")
static_path = os.path.join(FRONTEND_DIR, "static")

# Asegurar directorio de uploads para imágenes de productos
uploads_path = os.path.join(static_path, "uploads", "productos")
os.makedirs(uploads_path, exist_ok=True)

if os.path.exists(js_path):
    app.mount("/JS",     StaticFiles(directory=js_path),     name="js")
else:
    print(f"WARNING: JS path not found at {js_path}")

if os.path.exists(css_path):
    app.mount("/css",    StaticFiles(directory=css_path),    name="css")
else:
    print(f"WARNING: CSS path not found at {css_path}")

if os.path.exists(img_path):
    app.mount("/img",    StaticFiles(directory=img_path),    name="img")
else:
    print(f"WARNING: IMG path not found at {img_path}")

if os.path.exists(static_path):
    app.mount("/static", StaticFiles(directory=static_path), name="static")
else:
    print(f"WARNING: Static path not found at {static_path}")

# ── 2. Rutas HTML explícitas ──────────────────────────────────────────────────
# Cada página tiene su propia ruta GET.
# Se registran AMBAS formas: /agenda y /agenda.html
# porque el menú del frontend usa hrefs relativos con extensión.

def _html(filename: str) -> FileResponse:
    return FileResponse(os.path.join(FRONTEND_DIR, filename))

@app.get("/")
async def serve_login():
    return _html("login.html")

@app.get("/login.html")
async def serve_login_html():
    return _html("login.html")

@app.get("/dashboard")
async def serve_dashboard():
    return _html("index.html")

@app.get("/index.html")
async def serve_dashboard_html():
    return _html("index.html")

@app.get("/agenda")
async def serve_agenda():
    return _html("agenda.html")

@app.get("/agenda.html")
async def serve_agenda_html():
    return _html("agenda.html")

@app.get("/cobranza")
async def serve_cobranza():
    return _html("cobranza.html")

@app.get("/cobranza.html")
async def serve_cobranza_html():
    return _html("cobranza.html")

@app.get("/pacientes")
async def serve_pacientes():
    return _html("pacientes.html")

@app.get("/pacientes.html")
async def serve_pacientes_html():
    return _html("pacientes.html")

@app.get("/inventario")
async def serve_inventario():
    return _html("inventario.html")

@app.get("/inventario.html")
async def serve_inventario_html():
    return _html("inventario.html")

@app.get("/servicios")
async def serve_servicios():
    return _html("servicios.html")

@app.get("/servicios.html")
async def serve_servicios_html():
    return _html("servicios.html")

@app.get("/cabina")
async def serve_cabina():
    return _html("cabina.html")

@app.get("/cabina.html")
async def serve_cabina_html():
    return _html("cabina.html")

@app.get("/personal")
async def serve_personal():
    return _html("personal.html")

@app.get("/personal.html")
async def serve_personal_html():
    return _html("personal.html")


