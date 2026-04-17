import httpx

async def obtener_tasa_bcv() -> float:
    url = "https://ve.dolarapi.com/v1/dolares/oficial"
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url, timeout=5.0)
            response.raise_for_status()
            data = response.json()
            return float(data.get("promedio", 0.0))
    except Exception as e:
        print(f"Error obteniendo tasa BCV: {e}")
        return 0.0
