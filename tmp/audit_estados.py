"""
audit_estados.py -- Audita estados y negocio_id de citas esta semana via SQL puro.
Ejecutar: python tmp/audit_estados.py
"""
import sys, os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from sqlalchemy import text
from backend.database import engine
from datetime import datetime, timedelta

today = datetime.now()
dow = today.weekday()
monday = (today - timedelta(days=dow)).replace(hour=0, minute=0, second=0, microsecond=0)
sunday = (monday + timedelta(days=6)).replace(hour=23, minute=59, second=59)

print(f"Semana: {monday.date()} (lunes) a {sunday.date()} (domingo)")
print()

with engine.connect() as conn:
    # Total sin filtro
    total = conn.execute(text(
        "SELECT COUNT(*) FROM citas WHERE fecha_hora_inicio >= :ini AND fecha_hora_inicio <= :fin"
    ), {"ini": monday, "fin": sunday}).scalar()
    print(f"Total citas esta semana (sin filtro): {total}")
    print()

    # Distribucion de estados
    rows = conn.execute(text(
        "SELECT estado, COUNT(*) as n FROM citas "
        "WHERE fecha_hora_inicio >= :ini AND fecha_hora_inicio <= :fin "
        "GROUP BY estado ORDER BY n DESC"
    ), {"ini": monday, "fin": sunday}).fetchall()

    print("Distribucion exacta de estados (tal como estan en la DB):")
    for row in rows:
        print(f"  {row[1]:>3}x  estado = {repr(row[0])}")

    print()

    # Distribucion de negocio_id
    rows2 = conn.execute(text(
        "SELECT negocio_id, COUNT(*) as n FROM citas "
        "WHERE fecha_hora_inicio >= :ini AND fecha_hora_inicio <= :fin "
        "GROUP BY negocio_id ORDER BY n DESC"
    ), {"ini": monday, "fin": sunday}).fetchall()

    print("Distribucion de negocio_id:")
    for row in rows2:
        print(f"  {row[1]:>3}x  negocio_id = {row[0]}")

    print()

    # Muestra de 5 citas raw para ver datos reales
    sample = conn.execute(text(
        "SELECT id, estado, negocio_id, fecha_hora_inicio FROM citas "
        "WHERE fecha_hora_inicio >= :ini AND fecha_hora_inicio <= :fin "
        "LIMIT 10"
    ), {"ini": monday, "fin": sunday}).fetchall()

    print("Muestra de hasta 10 citas esta semana:")
    for row in sample:
        print(f"  id={row[0]}  estado={repr(row[1])}  negocio_id={row[2]}  fecha={row[3]}")
