import sys
import os
from datetime import datetime, date

# Add the project root to the path so we can import from backend
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from backend.database import SessionLocal
from backend.modules.cobranza.models import Cobro, Pago, DetalleCobro
from backend.modules.pacientes.models import Cliente
from backend.modules.agenda.models import Cita
from backend.modules.inventario.models import MovimientoInventario
from backend.modules.servicios.models import PaqueteSpa
from backend.modules.staff.models import Empleado

db = SessionLocal()

print("--- Inspecting Joselyne Rodriguez ---")
cliente = db.query(Cliente).filter(Cliente.nombre_completo.like("%Joselyne Rodriguez%")).first()

if not cliente:
    print("Cliente no encontrado!")
else:
    print(f"Cliente ID: {cliente.id}")
    print(f"Saldo Wallet Actual: {cliente.saldo_wallet}")
    
    start_of_day = datetime.combine(date.today(), datetime.min.time())
    
    # Check Cobros
    cobros = db.query(Cobro).filter(Cobro.cliente_id == cliente.id, Cobro.fecha >= start_of_day).all()
    print(f"\n--- Cobros Hoy: {len(cobros)} ---")
    for c in cobros:
        print(f"Cobro ID: {c.id} | Fecha: {c.fecha} | Total Venta: {c.monto_total_venta} | Abonado a Wallet: {c.monto_abonado} | Total In: {c.total} ")
        for det in c.detalles:
            print(f"   Detalle ID: {det.id} | Servicio: {det.servicio_nombre} | Aplicado: {det.precio_aplicado}")
            
    # Check Citas
    citas = db.query(Cita).filter(Cita.cliente_id == cliente.id, Cita.fecha_hora_inicio >= start_of_day).all()
    print(f"\n--- Citas Hoy: {len(citas)} ---")
    for cita in citas:
        print(f"Cita ID: {cita.id} | Estado: {cita.estado} | Fecha: {cita.fecha_hora_inicio}")
        for pago in cita.pagos:
            print(f"   Pago ID: {pago.id} | Monto: {pago.monto} | Metodo: {pago.metodo}")

db.close()
