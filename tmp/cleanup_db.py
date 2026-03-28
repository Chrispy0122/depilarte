import sys
import os
from datetime import datetime, date

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from backend.database import SessionLocal

# Import ALL models connected by relationships to ensure SQLAlchemy mapper is happy
from backend.modules.agenda.models import Cita, Servicio as AgendaServicio
from backend.modules.pacientes.models import Cliente, HistoriaDepilacion, HistoriaLimpieza, PaqueteCliente
from backend.modules.servicios.models import PaqueteSpa
from backend.modules.staff.models import Empleado
from backend.modules.inventario.models import Producto, RecetaServicio, MovimientoInventario
from backend.modules.cobranza.models import Cobro, Pago, DetalleCobro

db = SessionLocal()

print("--- Ejecutando Limpieza de Joselyne Rodriguez ---")

try:
    # 1. Revert Inventory Mvts for Cobro 82
    movs = db.query(MovimientoInventario).filter(
        MovimientoInventario.id.in_([397, 398])
    ).all()
    
    for m in movs:
        # Revert stock_actual
        prod = db.query(Producto).filter(Producto.id == m.producto_id).first()
        if prod:
            # m.cantidad is negative, so subtracting a negative adds it to stock_actual
            prod.stock_actual -= m.cantidad
            print(f"Revertido inventario prod {prod.id}: devuelto {-m.cantidad}. Nuevo stock: {prod.stock_actual}")
        db.delete(m)

    # 2. Revert Wallet
    cliente = db.query(Cliente).filter(Cliente.id == 158).first()
    if cliente:
        cliente.saldo_wallet -= 2.0
        print(f"Wallet revertido Cliente 158: Nuevo Saldo {cliente.saldo_wallet}")

    # 3. Delete Pago 38
    pago = db.query(Pago).filter(Pago.id == 38).first()
    if pago:
        db.delete(pago)
        print("Pago 38 eliminado.")

    # 4. Delete DetalleCobro 96
    detalle = db.query(DetalleCobro).filter(DetalleCobro.id == 96).first()
    if detalle:
        db.delete(detalle)
        print("DetalleCobro 96 eliminado.")
        
    # 5. Delete Cobro 82
    cobro = db.query(Cobro).filter(Cobro.id == 82).first()
    if cobro:
        db.delete(cobro)
        print("Cobro 82 eliminado.")
        
    db.commit()
    print("Limpieza completada con éxito.")
    
except Exception as e:
    db.rollback()
    print(f"Error procesando la limpieza: {e}")

db.close()
