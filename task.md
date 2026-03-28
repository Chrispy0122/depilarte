# Registro de Mejoras del Sistema

- `[x]` 1. **Inventario: Bug de la transacción al cobrar**  
  - **Problema:** El módulo de inventario realizaba `db.commit()` en cada movimiento individual (potes, cremas, etc.). Si el cobro principal fallaba a mitad de camino, los ítems de inventario ya quedaban descontados de forma irreversible la BD.
  - **Solución:** Se modificó `inventario/services.py` para reemplazar `db.commit()` + `db.refresh()` por `db.flush()` en `registrar_movimiento`. Los endpoints directos (entrada/ajuste) hacen su propio `commit()`.
  - **Archivos Modificados:** `backend/modules/inventario/services.py`, `backend/modules/inventario/router.py`.

- `[x]` 2. **Cobranza: Race condition y Asegurar el `negocio_id`**  
  - **Solución:** Se agregó `db.rollback()` antes de cada `raise HTTPException` en las validaciones de doble cobro. El endpoint legacy `/pagar` ahora también acepta `usuario_actual` via `Depends`.
  - **Archivos Modificados:** `backend/modules/cobranza/router.py`.

- `[x]` 3. **Servicios: Inyectar Tenant Correctamente**  
  - **Solución:** Se asigna `negocio_id = 1` al crear paquetes/servicios en `crear_paquete`.
  - **Archivos Modificados:** `backend/modules/servicios/router.py`.

- `[x]` 4. **Pacientes: Validaciones Anti-Duplicados**  
  - **Solución:** Los campos `cedula` y `numero_historia` ya tienen `unique=True` en `models.py`. Se mejoró el bloque `except IntegrityError` para inspeccionar `e.orig` y devolver mensajes 400 específicos (cédula vs historia).
  - **Archivos Modificados:** `backend/modules/pacientes/router.py`.

- `[x]` 5. **Subida de imagen para productos**  
  - **Solución:** Nuevo endpoint `POST /api/inventario/productos/{id}/imagen` con soporte `UploadFile`. Valida tipo MIME (JPEG/PNG/WEBP/GIF), guarda en `frontend/static/uploads/productos/`, elimina imagen anterior y actualiza `imagen_url` en la BD.
  - **Archivos Modificados:** `backend/modules/inventario/router.py`, `backend/main.py`.

- `[x]` 6. **Exportación Excel en Render**  
  - **Solución:** Se agregaron `openpyxl` y `python-multipart` a `requirements.txt` (esta última necesaria para que FastAPI acepte `UploadFile`).
  - **Archivos Modificados:** `requirements.txt`.
