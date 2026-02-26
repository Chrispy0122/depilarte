# 📋 Manual de Usuario — Sistema de Gestión Depilarte

> **Desarrollado por SEÑU Software**  
> Versión 1.0 · 2026

---

## 👋 Bienvenida

Bienvenida al **Sistema de Gestión Depilarte**, tu herramienta digital para administrar todo el spa desde un solo lugar. Con este sistema podrás llevar el control de tus pacientes, citas, cobros, servicios e inventario de manera rápida y sencilla, ya sea desde tu computadora o desde tu teléfono celular.

Este manual está pensado para ti y tu equipo de trabajo. No necesitas ser técnico/a para usarlo — solo sigue los pasos y cualquier duda que tengas, aquí estará la respuesta.

---

## 🔐 Acceso al Sistema

### ¿Cómo iniciar sesión?

1. Abre tu navegador (Chrome o Edge recomendados) y entra a la dirección del sistema:  
   👉 **`https://sistema-depilarte.onrender.com`**

2. Verás la pantalla de inicio de sesión con dos campos:
   - **Usuario:** `depilarte`
   - **Contraseña:** `depilarte`

3. Haz clic en el botón verde **"Ingresar"**.

4. Serás redirigida automáticamente al **Panel de Inicio (Dashboard)**.

> 💡 **Desde el celular:** El sistema funciona perfectamente desde el navegador de tu teléfono. También puedes instalarlo como aplicación tocando "Agregar a pantalla de inicio" en tu navegador móvil.

> ⚠️ **Si la pantalla queda en blanco o da error:** Espera unos segundos y recarga la página con **F5** (en PC) o desliza hacia abajo para recargar (en celular). El servidor a veces tarda unos segundos en arrancar si estuvo inactivo.

---

## 🏠 Panel de Inicio (Inicio)

Al ingresar, verás el **Panel de Control** con un resumen del día:

- 📊 **KPIs del día:** Total de cobros, pacientes atendidos y citas programadas.
- 📅 **Seguimiento Semanal:** Una tabla con las citas de la semana actual y la próxima, divididas en confirmadas y pendientes.
- 📈 **Gráficas:** Visualización de ingresos y actividad del spa.

Usa el **menú lateral izquierdo** para navegar entre los módulos. En celular, toca el ícono ☰ (tres líneas) en la esquina superior izquierda para abrirlo.

---

## 👩 Módulo de Pacientes

### ¿Para qué sirve?
Aquí registras y administras toda la información de tus clientas: datos personales, historial de visitas, saldo en wallet y próxima cita estimada.

### 🔍 Cómo buscar una paciente
1. En la barra superior del módulo, escribe el **nombre** o el **N° de Historia** de la paciente en el campo **"Buscar por Nombre o N° de Historia..."**.
2. Los resultados aparecerán automáticamente mientras escribes.

### ➕ Cómo registrar una paciente nueva
1. Haz clic en el botón verde **"+ Nueva Paciente"** (esquina superior derecha).
2. Se abrirá un formulario. Completa los campos:
   - **Nombre** *(requerido)* — Ej: María
   - **Apellido** *(requerido)* — Ej: Pérez
   - **Cédula** *(requerido)* — Ej: V-12345678
   - **Teléfono** *(requerido)* — Ej: 0414 1234567
   - **N° de Historia** — Ej: HIST-001 *(código interno del spa)*
   - **Dirección** — Ej: Av. Principal, Edif. A
   - **Email** — cliente@email.com
   - **N° de hijos**, **agua diaria**, **horas de sueño**, **actividad física** *(datos clínicos opcionales)*
3. Haz clic en **"Guardar Historia"** para registrar a la paciente.

### 📋 Ver el historial de una paciente
1. Encuentra a la paciente usando el buscador.
2. Haz clic sobre su nombre o en el botón de ver detalles.
3. Verás su **historial de citas**, **saldo en wallet** y **próxima cita estimada**.

---

## 💆 Módulo de Servicios

### ¿Para qué sirve?
Aquí defines todos los tratamientos que ofrece el spa: su nombre, código, precio por sesión, precio de paquete (4 sesiones) y las comisiones del personal.

### 🔍 Cómo buscar un servicio
- Usa la barra **"Buscar por nombre o código..."** para filtrar rápidamente.
- También puedes filtrar por categoría usando los botones: **Todos / Depilación / Facial / Corporal**.

### ➕ Cómo agregar un servicio nuevo
1. Haz clic en el botón **"+ Nuevo Servicio"**.
2. Se abrirá un panel lateral (offcanvas) con el formulario. Completa:
   - **Nombre del tratamiento** — Ej: Cara Completa
   - **Código** — Ej: CAR
   - **Categoría** — Depilación / Facial / Corporal
   - **Precio Sesión ($)** y **Precio Paquete 4 Sesiones ($)**
   - **Comisión Recepcionista ($)** y **Comisión Especialista ($)**
3. Haz clic en **"Guardar"**.

### ✏️ Cómo editar un servicio existente
1. Busca el servicio en la tabla o en la vista de tarjetas.
2. Haz clic en el ícono de ✏️ lápiz o en el botón **"Editar"**.
3. Modifica los campos que necesites y haz clic en **"Guardar"**.

---

## 📅 Módulo de Agenda

### ¿Para qué sirve?
Aquí ves y gestionas todas las citas del spa en un calendario visual. Puedes agendar nuevas citas, ver las del día o de la semana, y cambiar el estado de cada cita.

### 📆 Cómo ver el calendario
- El calendario muestra las citas por **día, semana o mes** (usa los botones en la esquina superior del calendario para cambiar la vista).
- Cada bloque de color en el calendario representa una cita. Haz clic en ella para ver los detalles.

### ➕ Cómo agendar una cita nueva
1. Haz clic en cualquier espacio vacío del calendario en la fecha y hora deseada, **o** haz clic en el botón **"+ Nueva Cita"**.
2. Se abrirá un formulario. Completa:
   - **Paciente** — Selecciona de la lista desplegable.
   - **Servicio(s)** — Selecciona los tratamientos a realizar.
   - **Fecha y Hora de inicio / fin.**
   - **Estado** — Pendiente / Confirmada / Asistió / Pagada / Cancelada.
3. Haz clic en **"Guardar"**.

### 🔄 Estados de una cita
| Estado | Significado |
|---|---|
| **Pendiente** | Cita registrada, sin confirmar |
| **Confirmada** | La paciente confirmó su asistencia |
| **Asistió** | La paciente llegó al spa |
| **Pagada** | El cobro fue procesado ✅ |
| **Cancelada** | La cita fue cancelada |

> 💡 Solo las citas en estado **"Confirmada"** o **"Asistió"** aparecerán en el módulo de Cobranza para ser cobradas.

---

## 💰 Módulo de Cobranza

### ¿Para qué sirve?
Este es el corazón financiero del spa. Aquí registras los pagos de las pacientes, controlas el saldo en wallet y ves el resumen de la caja diaria.

### 📋 Panel Superior — Pacientes Confirmadas de Hoy
Al entrar al módulo, verás una tabla con todas las pacientes que tienen cita **confirmada para hoy**. Para cobrarle a una paciente:
1. Busca su nombre en la tabla.
2. Haz clic en el botón verde **"💰 Cobrar"** que aparece en su fila.

### 🧾 Pantalla de Cobro (Modal)
Al hacer clic en "Cobrar" se abre la pantalla de registro de pago:

**1. Selección de Servicio**
- Usa el menú desplegable **"Buscar Tratamiento"** para seleccionar el servicio.
- Elige el **Tipo de Venta:**
  - **Sesión Individual** — precio por sesión única.
  - **Paquete (4 Sesiones)** — precio especial de paquete.
  - **Promoción (Precio Libre)** — tú defines el monto.
- Haz clic en **"+ Agregar a la Lista"**. Puedes agregar múltiples servicios.

**2. Opciones de Pago**
- **Usar Saldo a Favor (Wallet):** Si la paciente tiene saldo acumulado, activa el interruptor para descontarlo automáticamente del total.
- **¿Abonar monto extra a Wallet?:** Marca la casilla si la paciente quiere recargar saldo para una próxima visita.
- **Método de Pago:**
  - 💵 **Efectivo ($)**
  - 📱 **Pago Móvil (Bs)**
  - 💸 **Zelle**
  - 💳 **Punto de Venta**
- **Ref. / Nro. Transacción:** Si el pago fue por transferencia, anota aquí el número de referencia.
- **Próxima Cita:** Selecciona la fecha aproximada para la próxima visita de la paciente.

**3. Total a Cobrar**
- Verás el **Total en dólares ($)** y su equivalente en **Bolívares (Bs)** calculado con la **Tasa BCV del día**.
- Haz clic en **"Confirmar y Procesar →"** para registrar el cobro.

### 💵 ¿Qué es la Tasa BCV?
La tasa BCV (Banco Central de Venezuela) es el valor oficial del dólar en bolívares para ese día. El sistema la obtiene **automáticamente** de internet cada vez que abres el módulo de Cobranza. Verás el valor actual en la esquina superior derecha de la pantalla, por ejemplo: `💵 BCV: 36.50`.

> ⚠️ **Importante para la contabilidad:** Cada cobro guarda la tasa BCV del momento exacto en que fue registrado. Esto significa que si cobras el 18 de febrero, el equivalente en Bs que aparecerá siempre será el de la tasa del 18 de febrero, no la tasa de hoy. Esto garantiza que tus reportes sean precisos y auditables.

### 📊 Caja Diaria
La pestaña **"Caja de Hoy"** muestra todos los cobros del día seleccionado:
- Usa el selector de **fecha** para ver la caja de cualquier día anterior.
- Cada fila muestra: hora, cliente, servicios, **Total ($)**, **Total (Bs)**, método de pago y referencia.
- El **Total del Día** aparece en la esquina superior derecha del panel.

### 📥 Exportar a Excel
Haz clic en el botón verde **"⬇ Exportar Excel"** para descargar el reporte de caja del día seleccionado. El archivo incluye:
- Todos los cobros del día con sus montos en **$** y en **Bs**.
- La tasa BCV histórica usada en cada cobro.
- Nombres de la recepcionista y especialista asignadas.
- Fila de **Total del Día** al final.

### 📑 Reportes y Nómina
La pestaña **"Reportes y Nómina"** te permite consultar las comisiones del personal para un rango de fechas:
1. Selecciona **Fecha Inicio** y **Fecha Fin**.
2. Haz clic en **"🔍 Consultar Nómina"**.
3. Verás una tabla con el total de comisiones por empleada, cantidad de zonas depiladas, limpiezas y masajes realizados.

---

## 📦 Módulo de Inventario

### ¿Para qué sirve?
Aquí controlas el stock de productos del spa: geles, ceras, cremas y cualquier insumo que uses en los tratamientos.

### 🔍 Cómo buscar un producto
- Usa la barra **"Buscar producto..."** para filtrar por nombre.

### ➕ Cómo agregar un producto nuevo
1. Haz clic en **"+ Nuevo Producto"**.
2. Completa el formulario:
   - **Nombre del producto** — Ej: Gel Conductor 500ml
   - **Unidad de medida** — Ej: ml, g, unidad
   - **Stock actual** y **Stock mínimo** (nivel de alerta)
   - **Proveedor** *(opcional)*
3. Haz clic en **"Guardar"**.

### 📥 Registrar una entrada de productos
Cuando recibes un nuevo pedido de insumos:
1. Busca el producto en la lista.
2. Haz clic en el botón **"+ Entrada"**.
3. Ingresa la **cantidad recibida** — Ej: 10.
4. Confirma. El stock se actualizará automáticamente.

### ⚠️ Alertas de Stock Bajo
Los productos que estén por debajo de su **stock mínimo** aparecerán resaltados en rojo o con una alerta. Esto te indica que es momento de hacer un nuevo pedido.

> 💡 El sistema también descuenta automáticamente los insumos del inventario cuando se registra un cobro, si el servicio tiene una **receta de consumo** configurada.

---

## 💡 Consejos de Uso

| Situación | Qué hacer |
|---|---|
| La página no carga datos | Presiona **F5** o recarga la página. El servicio puede tardar ~30 segundos en arrancar tras inactividad. |
| El equivalente en Bs está en 0 | La tasa BCV no pudo obtenerse (falta de internet). Recarga el módulo de Cobranza. |
| Un cobro no aparece en caja | Verifica que la fecha seleccionada en "Caja de Hoy" sea la correcta. |
| Error al guardar un paciente | Revisa que los campos marcados con * (requeridos) estén completos — especialmente Nombre, Apellido y Cédula. |
| La cita no aparece para cobrar | Verifica que la cita tenga estado **"Confirmada"** o **"Asistió"** en la Agenda. |
| Olvidé la contraseña | La contraseña actual es `depilarte`. Contacta a SEÑU Software para cambiarla. |

---

## 📞 Soporte Técnico

Si tienes algún problema que no puedas resolver con este manual, contacta a tu equipo de soporte:

**SEÑU Software**  
🌐 Desarrollador del Sistema Depilarte  

---

*Gracias por confiar en SEÑU Software para digitalizar Depilarte. ¡Éxito en cada sesión!* 💚
