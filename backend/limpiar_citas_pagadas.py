"""
Script para limpiar citas duplicadas y marcar como PAGADA las que ya fueron cobradas
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from backend.database import SQLALCHEMY_DATABASE_URL

def limpiar_citas_pagadas():
    engine = create_engine(SQLALCHEMY_DATABASE_URL)
    
    with engine.connect() as connection:
        # Actualizar todas las citas que tienen pagos asociados a estado PAGADA
        result = connection.execute(text("""
            UPDATE citas 
            SET estado = 'pagada'
            WHERE id IN (
                SELECT DISTINCT cita_id 
                FROM pagos
            )
            AND estado != 'pagada'
        """))
        
        connection.commit()
        
        count = result.rowcount
        print(f"\nTotal de citas actualizadas: {count}")
        print("Las citas ya no apareceran duplicadas en la lista de pendientes.")

if __name__ == "__main__":
    print("Limpiando citas pagadas...\n")
    limpiar_citas_pagadas()
