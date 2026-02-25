from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
import sys

# Ensure backend directory is in path (sometimes needed for absolute imports if running from root)
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.database import engine, Base

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

# --- STATIC FILES & FRONTEND ROUTING ---
from fastapi.responses import FileResponse

# Resolve absolute path to frontend
frontend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../frontend"))

if os.path.exists(frontend_path):
    # 1. Custom Routes for cleaner URLs
    @app.get("/")
    async def serve_login():
        return FileResponse(os.path.join(frontend_path, "login.html"))

    @app.get("/dashboard")
    async def serve_dashboard():
        return FileResponse(os.path.join(frontend_path, "index.html"))

    # 2. Mount everything else (CSS, JS, other HTMLs) static
    # html=False prevents it from automatically serving index.html at "/", which conflicts with our login route
    app.mount("/", StaticFiles(directory=frontend_path, html=False), name="frontend")
else:
    print(f"WARNING: Frontend path not found at {frontend_path}")
