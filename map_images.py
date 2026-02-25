import os
from sqlalchemy.orm import Session
from backend.database import SessionLocal
from backend.modules.inventario.models import Producto
from fuzzywuzzy import process

def map_images():
    db: Session = SessionLocal()
    
    # 1. Get all images in frontend/img
    img_dir = r"c:\Users\Windows\Documents\Depilarte\frontend\img"
    images = [f for f in os.listdir(img_dir) if f.endswith(('.png', '.jpg', '.jpeg'))]
    
    print(f"Found {len(images)} images in {img_dir}")
    
    # 2. Get all products
    products = db.query(Producto).all()
    print(f"Found {len(products)} products in DB")
    
    # 3. Map
    updates = 0
    for p in products:
        # Normalize product name for matching
        p_name_norm = p.nombre.lower().replace(' ', '_').replace('ñ', 'n').replace('á', 'a').replace('é', 'e').replace('í', 'i').replace('ó', 'o').replace('ú', 'u')
        
        # Exactish match attempt
        match = None
        
        # Try finding a file that contains the product name
        for img in images:
            img_name = img.lower()
            if p_name_norm in img_name:
                match = img
                break
        
        # If no containment, try fuzzy
        if not match:
             # Simple exact matches first
             pass

        # Manual overrides/heuristics based on list
        if p.nombre == "Discos de Algodón" and "discos_de_algodon.png" in images:
            match = "discos_de_algodon.png"
        elif p.nombre == "Agua Destilada" and "agua_destilada.png" in images:
            match = "agua_destilada.png"
            
        # Generalize: "name.png" matches "Name"
        # Let's try to match by similarity
        if not match:
            # Create a dict of image_name_no_ext -> image_full_name
            img_map = {i.split('.')[0].lower().replace('_', ' '): i for i in images}
            
            # Find best match in keys
            best, score = process.extractOne(p.nombre.lower(), img_map.keys())
            if score > 85: # High confidence
                match = img_map[best]
                
        if match:
            # Update DB
            # Path relative to frontend root? usually just "img/filename.png" if served statically
            # The previous code used emojis, now we use paths.
            p.imagen_url = f"img/{match}"
            updates += 1
            print(f"MATCH: '{p.nombre}' -> '{match}'")
        else:
            print(f"NO MATCH: '{p.nombre}'")
            
    db.commit()
    print(f"\nTotal updates: {updates}")
    db.close()

if __name__ == "__main__":
    try:
        map_images()
    except Exception as e:
        print(f"Error: {e}")
