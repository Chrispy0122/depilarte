Arquitectura del Chatbot de WhatsApp para el Spa
Objetivo: Integrar un bot conversacional de WhatsApp que consuma la API REST actual (alojada en Render) para responder FAQs, registrar leads (Registro Express) y agendar citas, SIN alterar el código fuente ni los modelos de datos existentes.

1. La Regla de Oro (Solo Lectura e Inserción vía API)
El bot es un cliente externo. Se va a comunicar con el backend exclusivamente a través de peticiones HTTP (GET y POST). Está estrictamente prohibido que el bot intente hacer queries directas a la base de datos (SQL) o que modifique los archivos de FastAPI/Render.

2. Flujo 1: FAQ y Atención al Cliente (Módulo de Servicios)
La Lógica: Cuando el cliente pregunte "¿Cuánto cuesta la depilación y cuánto tarda?", el bot (usando OpenAI, Dialogflow o un árbol de decisiones) debe detectar la intención.

La Acción API: El bot hace un GET /api/servicios/ para leer el catálogo actual, busca "Depilación" en el JSON, y le responde al cliente con el precio y la duración que están registrados en el sistema.

3. Flujo 2: Captación de Leads (Módulo de Pacientes - Registro Express)
La Lógica: Cuando un número escribe por primera vez, el bot debe verificar si existe.

La Acción API: El bot extrae el número de WhatsApp y hace un GET /api/pacientes/buscar?telefono={numero}.

El Registro Express: Si la API devuelve un 404 o un null (no existe), el bot le pide el nombre al usuario por chat. Luego, dispara un POST /api/pacientes/ enviando únicamente el nombre, teléfono y origen (WhatsApp). Como el backend ya tiene la historia médica configurada como opcional, la base de datos aceptará al paciente y devolverá el nuevo paciente_id.

4. Flujo 3: Agendamiento Automático (Módulo de Agenda)
La Lógica: El cliente dice "Quiero el martes a las 10 am para Axilas". El bot extrae la fecha, hora y servicio.

La Acción API (Validación): El bot hace un GET /api/citas/disponibilidad?fecha=YYYY-MM-DD. Revisa en el JSON si el bloque de las 10:00 am está libre.

La Acción API (Inserción): Si está libre, el bot arma el payload de la cita con el paciente_id (que buscó o creó en el Flujo 2), los servicios_ids solicitados y la fecha/hora. Dispara un POST /api/citas/.

El Resultado Visual: El sistema guarda la cita y, por arte de magia, aparece en la pantalla de la recepcionista física en color rojo (Pendiente) o verde (Confirmada), según cómo configuren el payload.