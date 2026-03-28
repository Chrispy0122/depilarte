import sys
import os
from datetime import datetime, date

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from backend.database import SessionLocal
from backend.modules.inventario.models import MovimientoInventario

db = SessionLocal()

print("--- Inspecting Inventory for Cobro 82 and 83 ---")
movs = db.query(MovimientoInventario).filter(
    MovimientoInventario.referencia.like("%Cobro #82%") | 
    MovimientoInventario.referencia.like("%Cobro #83%")
).all()

for m in movs:
    print(f"Mov ID: {m.id} | Ref: {m.referencia} | Qty: {m.cantidad} | Prod ID: {m.producto_id}")

db.close()
