"""
Script para poblar la base de datos con productos de inventario iniciales
"""
import sys
import os
from datetime import date, timedelta
import random

# Ensure backend directory is in path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.database import SessionLocal, engine
from backend.modules.inventario import models as inventario_models
import backend.modules.agenda.models as agenda_models # Fix for relationship mapping
import backend.modules.pacientes.models as pacientes_models # Fix for relationship mapping
import backend.modules.cobranza.models as cobranza_models # Fix for relationship mapping
import backend.models # Legacy models (Presupuesto, etc.)

def seed_inventario():
    db = SessionLocal()
    
    # Lista de productos basada en la imagen del usuario
    productos_data = [
        # --- DESECHABLES / CONSUMIBLES ---
        {"nombre": "Discos de Algodón", "categoria": "Desechables", "unidad": "unidades", "stock": 500, "min": 50, "costo": 0.05},
        {"nombre": "Toallín", "categoria": "Desechables", "unidad": "rollos", "stock": 20, "min": 5, "costo": 1.50},
        {"nombre": "Toallas Húmedas", "categoria": "Desechables", "unidad": "paquetes", "stock": 30, "min": 5, "costo": 2.00},
        {"nombre": "Paleta Baja lengua", "categoria": "Desechables", "unidad": "unidades", "stock": 1000, "min": 100, "costo": 0.02},
        {"nombre": "Guantes", "categoria": "Desechables", "unidad": "pares", "stock": 200, "min": 50, "costo": 0.10},
        {"nombre": "Tapa Bocas", "categoria": "Desechables", "unidad": "unidades", "stock": 150, "min": 30, "costo": 0.15},
        {"nombre": "Papel Sanitario", "categoria": "Desechables", "unidad": "rollos", "stock": 48, "min": 12, "costo": 0.50},
        
        # --- PRODUCTOS DE CABINA (Para Recetas) ---
        {"nombre": "Aloe Gel", "categoria": "Cabina", "unidad": "ml", "stock": 3000, "min": 500, "costo": 0.02},
        {"nombre": "Gel Conductor", "categoria": "Cabina", "unidad": "ml", "stock": 5000, "min": 1000, "costo": 0.01}, # "Gel" en la lista
        {"nombre": "Gel Anti Bacterial", "categoria": "Cabina", "unidad": "ml", "stock": 2000, "min": 200, "costo": 0.015},
        {"nombre": "Agua Destilada", "categoria": "Cabina", "unidad": "ml", "stock": 10000, "min": 2000, "costo": 0.005},
        {"nombre": "Gerdex", "categoria": "Cabina", "unidad": "ml", "stock": 3000, "min": 500, "costo": 0.03},
        {"nombre": "Cera", "categoria": "Cabina", "unidad": "g", "stock": 2000, "min": 500, "costo": 0.05},
        {"nombre": "Protector Solar", "categoria": "Cabina", "unidad": "ml", "stock": 1000, "min": 200, "costo": 0.10},
        {"nombre": "Aceite de planta 15/40", "categoria": "Mantenimiento", "unidad": "ml", "stock": 1000, "min": 100, "costo": 0.08},
        {"nombre": "Gasolina", "categoria": "Mantenimiento", "unidad": "litros", "stock": 20, "min": 5, "costo": 0.50},

        # --- EQUIPAMIENTO / REUTILIZABLES ---
        {"nombre": "Lentes Depilacion", "categoria": "Equipamiento", "unidad": "unidades", "stock": 5, "min": 5, "costo": 15.00},
        {"nombre": "Antifas Grande", "categoria": "Equipamiento", "unidad": "unidades", "stock": 10, "min": 10, "costo": 5.00},
        {"nombre": "Antifas Pequeño", "categoria": "Equipamiento", "unidad": "unidades", "stock": 10, "min": 10, "costo": 4.00},
        {"nombre": "Recipientes cabina", "categoria": "Equipamiento", "unidad": "unidades", "stock": 20, "min": 20, "costo": 1.00},
        
        # --- LENCERÍA ---
        {"nombre": "Uniformes", "categoria": "Lenceria", "unidad": "unidades", "stock": 10, "min": 0, "costo": 20.00},
        {"nombre": "Fundas Camillas", "categoria": "Lenceria", "unidad": "unidades", "stock": 15, "min": 5, "costo": 3.00},
        {"nombre": "Almohada", "categoria": "Lenceria", "unidad": "unidades", "stock": 5, "min": 2, "costo": 8.00},
        {"nombre": "Funda de Almohada", "categoria": "Lenceria", "unidad": "unidades", "stock": 10, "min": 5, "costo": 2.00},
        {"nombre": "Toallas", "categoria": "Lenceria", "unidad": "unidades", "stock": 30, "min": 10, "costo": 5.00},
        {"nombre": "Mantas", "categoria": "Lenceria", "unidad": "unidades", "stock": 10, "min": 5, "costo": 10.00},
        {"nombre": "Batas", "categoria": "Lenceria", "unidad": "unidades", "stock": 15, "min": 5, "costo": 12.00},

        # --- LIMPIEZA ---
        {"nombre": "Detergente", "categoria": "Limpieza", "unidad": "kg", "stock": 10, "min": 2, "costo": 2.50},
        {"nombre": "Cloro", "categoria": "Limpieza", "unidad": "litros", "stock": 20, "min": 5, "costo": 1.00},
        {"nombre": "Coleto", "categoria": "Limpieza", "unidad": "unidades", "stock": 5, "min": 2, "costo": 3.00},
        {"nombre": "Jabon para Manos", "categoria": "Limpieza", "unidad": "litros", "stock": 10, "min": 2, "costo": 4.00},
        {"nombre": "Jabon para Platos", "categoria": "Limpieza", "unidad": "litros", "stock": 5, "min": 1, "costo": 3.00},
        {"nombre": "Spray Madera", "categoria": "Limpieza", "unidad": "unidades", "stock": 5, "min": 1, "costo": 5.00},
        {"nombre": "Ambientador", "categoria": "Limpieza", "unidad": "unidades", "stock": 10, "min": 3, "costo": 4.00},
        {"nombre": "Papeleras", "categoria": "Limpieza", "unidad": "unidades", "stock": 8, "min": 8, "costo": 6.00},
        {"nombre": "Bolsas", "categoria": "Limpieza", "unidad": "paquetes", "stock": 20, "min": 5, "costo": 2.00},

        # --- OFICINA / CAFETERÍA ---
        {"nombre": "Café", "categoria": "Oficina", "unidad": "kg", "stock": 5, "min": 1, "costo": 8.00},
        {"nombre": "Azucar", "categoria": "Oficina", "unidad": "kg", "stock": 5, "min": 1, "costo": 1.50},
        {"nombre": "Boligrafos", "categoria": "Oficina", "unidad": "unidades", "stock": 50, "min": 10, "costo": 0.50},
        {"nombre": "Block de Notas", "categoria": "Oficina", "unidad": "unidades", "stock": 20, "min": 5, "costo": 1.00},
        {"nombre": "Hojas de Historia 1", "categoria": "Papeleria", "unidad": "unidades", "stock": 500, "min": 100, "costo": 0.05},
        {"nombre": "Hojas de Historia 2", "categoria": "Papeleria", "unidad": "unidades", "stock": 500, "min": 100, "costo": 0.05},
        {"nombre": "Funda de Historias", "categoria": "Papeleria", "unidad": "unidades", "stock": 200, "min": 50, "costo": 0.10},
        {"nombre": "Carpeta de Historia", "categoria": "Papeleria", "unidad": "unidades", "stock": 100, "min": 20, "costo": 0.50},
    ]

    print("Sembrando inventario...")

    count = 0
    for p_data in productos_data:
        # Verificar si existe
        exists = db.query(inventario_models.Producto).filter_by(nombre=p_data["nombre"]).first()
        if not exists:
            # Crear producto
            prod = inventario_models.Producto(
                nombre=p_data["nombre"],
                descripcion=f"Producto de {p_data['categoria']}",
                tipo="uso_interno", # Por defecto casi todo es uso interno en la lista
                categoria=p_data["categoria"],
                unidad_medida=p_data["unidad"],
                stock_actual=p_data["stock"],
                stock_minimo=p_data["min"],
                stock_maximo=p_data["stock"] * 3,
                costo_unitario=p_data["costo"],
                # Caducidad aleatoria para demos (entre 30 y 365 dias)
                fecha_caducidad=date.today() + timedelta(days=random.randint(20, 365)) if p_data["categoria"] in ["Cabina", "Oficina"] else None 
            )
            db.add(prod)
            db.commit()
            
            # Registrar movimiento inicial
            mov = inventario_models.MovimientoInventario(
                producto_id=prod.id,
                tipo="entrada",
                cantidad=p_data["stock"],
                stock_anterior=0,
                stock_nuevo=p_data["stock"],
                referencia="Inventario Inicial",
                notas="Carga inicial del sistema"
            )
            db.add(mov)
            db.commit()
            
            count += 1
            print(f"Creado: {prod.nombre}")
        else:
            print(f"Ya existe: {p_data['nombre']}")
            
    print(f"\nProceso completado. {count} productos creados.")
    db.close()

if __name__ == "__main__":
    seed_inventario()
