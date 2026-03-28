"""
fix_null_negocio_id.py
Asigna negocio_id = 1 a todos los registros legacy con NULL.
Ejecutar una sola vez desde la raiz del proyecto:
    python tmp/fix_null_negocio_id.py
"""
import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from sqlalchemy import text
from backend.database import engine

TABLAS = [
    'citas',
    'clientes',
    'cobros',
    'pagos',
    'productos_inventario',
    'movimientos_inventario',
    'paquetes_spa',
    'servicios',
    'empleados',
]

TARGET_NEGOCIO_ID = 1

print("=" * 55)
print("  Migracion: negocio_id NULL -> 1 (Depilarte)")
print("=" * 55)

total_actualizados = 0

with engine.connect() as conn:
    conn.execute(text("SET FOREIGN_KEY_CHECKS=0;"))

    for tabla in TABLAS:
        try:
            resultado = conn.execute(
                text(f"SELECT COUNT(*) FROM {tabla} WHERE negocio_id IS NULL")
            ).scalar()

            if resultado == 0:
                print(f"  OK  {tabla:<30} sin registros NULL")
                continue

            conn.execute(
                text(f"UPDATE {tabla} SET negocio_id = {TARGET_NEGOCIO_ID} WHERE negocio_id IS NULL")
            )
            conn.commit()
            total_actualizados += resultado
            print(f"  >>  {tabla:<30} {resultado} filas -> negocio_id={TARGET_NEGOCIO_ID}")

        except Exception as e:
            print(f"  --  {tabla:<30} omitida ({e})")

    conn.execute(text("SET FOREIGN_KEY_CHECKS=1;"))

print("=" * 55)
print(f"  Total filas actualizadas: {total_actualizados}")
print("  Migracion completada.")
print("=" * 55)
