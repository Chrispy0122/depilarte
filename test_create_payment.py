import requests
import json

url = "http://localhost:8000/api/cobranza/"
payload = {
    "cliente_id": 1,
    "items": [
        {
            "servicio_id": 1,
            "tipo_venta": "sesion",
            "precio_aplicado": 123.45,
            "recepcionista_id": None,
            "especialista_id": None
        }
    ],
    "metodo_pago": "efectivo",
    "referencia": "test_script"
}

try:
    response = requests.post(url, json=payload)
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text}")
except Exception as e:
    print(f"Error: {e}")
