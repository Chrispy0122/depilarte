const api = require('./api');
const chrono = require('chrono-node');

// ─── Filtro de Seguridad: Prompt Injection / Jailbreak ───────────────────────
const PATRONES_INYECCION = [
    /ignora(r)?\s*(las\s*)?(instrucciones|reglas|todo)/i,
    /olvida(r)?\s*(todo|las\s*instrucciones|tus\s*reglas)/i,
    /system\s*prompt/i,
    /developer\s*mode/i,
    /modo\s*(desarrollador|dios|admin)/i,
    /\bDAN\b/,
    /actu[aá]\s*(como|de)\s+(?!recepcionista|nova|asistente)/i,
    /bypass/i,
    /jailbreak/i,
    /sin\s*(restricciones|filtros|l[ií]mites)/i,
    /revela(r)?\s*(el\s*)?(prompt|instrucciones|sistema)/i,
    /eres\s+(ahora|en\s*realidad)\s+(?!nova|la\s*recepcionista)/i,
    /pretende\s*(que\s*)?(eres|ser)/i,
];

function detectarInyeccion(mensajeUsuario) {
    return PATRONES_INYECCION.some(patron => patron.test(mensajeUsuario));
}

// ─── ALMACENAMIENTO DE SESIONES ───────────────────────────────────────────────
// Cada sesión tiene un estado que fluye en secuencia obligatoria:
//
//   IDLE → (usuario menciona día) → WAIT_HORA → (usuario elige hora) → CONFIRMAR → IDLE
//
// El bot NO puede mencionar horas sin pasar primero por la captura del día.
const sesiones = {};

/**
 * Obtiene o inicializa la sesión de un usuario.
 * La sesión contiene:
 *   - estado: 'IDLE' | 'WAIT_NAME' | 'WAIT_DIA' | 'WAIT_HORA' | 'CONFIRMAR'
 *   - historial: array de mensajes para el LLM (máx 10 turnos)
 *   - datosReserva: { fecha, hora, horasDisponibles[], servicioId, servicioNombre }
 *   - pacienteId, nombreConfirmado
 */
function getSesion(telefono) {
    if (!sesiones[telefono]) {
        sesiones[telefono] = {
            estado: 'IDLE',
            historial: [],
            datosReserva: {},
            pacienteId: null,
            nombreConfirmado: false
        };
    }
    return sesiones[telefono];
}

/**
 * Resetea los datos de reserva de una sesión pero mantiene al paciente identificado.
 */
function limpiarReserva(sesion) {
    sesion.estado = 'IDLE';
    sesion.datosReserva = {};
}

/**
 * Resetea completamente la sesión de un usuario.
 */
function limpiarSesion(telefono) {
    if (sesiones[telefono]) {
        sesiones[telefono].estado = 'IDLE';
        sesiones[telefono].datosReserva = {};
    }
}

// ─── Utilidades de Fecha/Hora ────────────────────────────────────────────────

/**
 * Retorna la fecha y hora actuales en zona horaria de Caracas como string legible.
 * Se llama en CADA mensaje → Hard Reset de contexto temporal.
 */
function getFechaActualCaracas() {
    return new Intl.DateTimeFormat('es-VE', {
        timeZone: 'America/Caracas',
        year: 'numeric', month: 'long', day: 'numeric',
        weekday: 'long',
        hour: '2-digit', minute: '2-digit', hour12: false
    }).format(new Date());
}

/**
 * Normaliza texto: quita tildes y pasa a minúsculas.
 * Esto permite que chrono-node y los regex detecten días escritos con
 * tilde ("Miércoles", "Sábado") o en mayúscula ("El Lunes").
 */
function normalizeText(texto) {
    return texto
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, ''); // Elimina diacríticos (tildes, diéresis)
}

/**
 * Intenta extraer una fecha del texto del usuario usando chrono-node.
 *
 * ESTRATEGIA DE 3 NIVELES (orden de prioridad):
 * 1. Texto original — chrono.es maneja español con tildes de forma nativa
 *    ("El Miércoles", "mañana", "el próximo viernes")
 * 2. Texto normalizado (sin tildes) — fallback si el usuario escribió sin acento
 *    ("el miercoles", "sabado")
 * 3. Regex puro — detecta el nombre del día y lo reparsea solo, evitando
 *    que el ruido del texto ("a qué hora", "disponible") confunda a chrono.
 *
 * IMPORTANTE: isCertain('day') garantiza que no confundimos una hora sola
 * ("13:30") como fecha — ese era el bug del bucle anterior.
 */
const REGEX_DIA_NOMBRE = /\b(hoy|ma[n\xf1]ana|lunes|martes|mi[e\xe9]rcoles|jueves|viernes|s[a\xe1]bado|domingo)\b/i;

function extraerFecha(texto) {
    // ── Estrategia 1: texto original (chrono.es maneja tildes nativamente) ───
    let parses = chrono.es.parse(texto, new Date(), { forwardDate: true });
    if (parses.length > 0 && parses[0].start.isCertain('day')) {
        return parses[0].start.date();
    }

    // ── Estrategia 2: texto normalizado sin tildes (usuario escribe sin acento) —
    const textoNorm = normalizeText(texto);
    parses = chrono.es.parse(textoNorm, new Date(), { forwardDate: true });
    if (parses.length > 0 && parses[0].start.isCertain('day')) {
        return parses[0].start.date();
    }

    // ── Estrategia 3: regex de nombre de día + re-parseo limpio ───────────────
    // Si el texto completo confunde a chrono (ej. "El miércoles a qué hora"),
    // extraemos solo el nombre del día y lo parseamos aislado.
    const matchNorm = textoNorm.match(REGEX_DIA_NOMBRE);
    if (matchNorm) {
        parses = chrono.es.parse(matchNorm[0], new Date(), { forwardDate: true });
        if (parses.length > 0) {
            console.log(`[extraerFecha] Estrategia 3 activa: "${texto}" → día "${matchNorm[0]}" → ${parses[0].start.date()}`);
            return parses[0].start.date();
        }
    }

    return null;
}

/**
 * Intenta extraer una hora del texto del usuario usando chrono-node.
 * Retorna un string 'HH:MM' o null.
 * Corrige automáticamente la ambigüedad AM/PM (ej: "a la 1" → 13:00).
 *
 * Usa dual-parse: original primero (chrono.es con tildes), luego normalizado.
 */
function extraerHora(texto) {
    // ── Intento 1: texto original ───────────────────────────────────────────
    let parses = chrono.es.parse(texto, new Date(), { forwardDate: true });
    if (parses.length > 0 && parses[0].start.isCertain('hour')) {
        let hora = parses[0].start.get('hour');
        if (hora < 8) hora += 12;
        const min = String(parses[0].start.get('minute') || 0).padStart(2, '0');
        return `${String(hora).padStart(2, '0')}:${min}`;
    }

    // ── Intento 2: texto normalizado (sin tildes) ───────────────────────────
    const textoNorm = normalizeText(texto);
    parses = chrono.es.parse(textoNorm, new Date(), { forwardDate: true });
    if (parses.length > 0 && parses[0].start.isCertain('hour')) {
        let hora = parses[0].start.get('hour');
        if (hora < 8) hora += 12;
        const min = String(parses[0].start.get('minute') || 0).padStart(2, '0');
        return `${String(hora).padStart(2, '0')}:${min}`;
    }

    return null;
}

/**
 * Formatea una fecha Date a string 'YYYY-MM-DD'.
 */
function formatFecha(dateObj) {
    const yyyy = dateObj.getFullYear();
    const mm   = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dd   = String(dateObj.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

/**
 * Convierte 'YYYY-MM-DD' a texto legible en español (ej: "lunes 7 de abril de 2026").
 */
function formatFechaLegible(fechaStr) {
    // Parsear como UTC para evitar desplazamientos de zona horaria al formatear
    const [y, m, d] = fechaStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    return new Intl.DateTimeFormat('es-VE', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    }).format(dateObj);
}

// ─── Motor de Disponibilidad ─────────────────────────────────────────────────

/**
 * Calcula los slots de 30 minutos disponibles entre 08:00 y 18:00
 * cruzando contra las citas ocupadas reales de la BD.
 * 
 * ANTI-ALUCINACIÓN: Esta función genera la ÚNICA fuente de verdad de horas.
 * El LLM NUNCA recibe la lista completa de citas — solo recibe el resultado
 * de esta función como un string de texto plano.
 * 
 * @param {Array} citasOcupadas - Array de citas con fecha_hora_inicio y fecha_hora_fin
 * @returns {string[]} Array de strings 'HH:MM' con horas disponibles
 */
function calcularHorasDisponibles(citasOcupadas) {
    const slots = [];
    // 08:00 (480 min) hasta 17:30 (1050 min) en pasos de 30 min
    for (let m = 480; m <= 1050; m += 30) {
        slots.push({
            str: `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`,
            startMin: m,
            endMin: m + 30
        });
    }

    const rangosOcupados = [];
    if (citasOcupadas && citasOcupadas.length > 0) {
        citasOcupadas.forEach(c => {
            if (c.fecha_hora_inicio && c.fecha_hora_fin) {
                try {
                    const parseMin = (iso) => {
                        const tp = iso.split('T')[1] || iso.substring(11, 16);
                        const [h, min] = tp.split(':');
                        return parseInt(h) * 60 + parseInt(min);
                    };
                    rangosOcupados.push({
                        startMin: parseMin(c.fecha_hora_inicio),
                        endMin:   parseMin(c.fecha_hora_fin)
                    });
                } catch (e) {}
            }
        });
    }

    return slots
        .filter(slot => !rangosOcupados.some(r => slot.startMin < r.endMin && slot.endMin > r.startMin))
        .map(slot => slot.str);
}

/**
 * Verifica si una hora dada (string 'HH:MM') está en la lista de horas disponibles.
 */
function horaEsDisponible(hora, horasDisponibles) {
    return horasDisponibles.includes(hora);
}

// ─── Construcción de Prompts ─────────────────────────────────────────────────

/**
 * Construye el catálogo de servicios como string para el prompt.
 *
 * ARQUITECTURA ANTI-LEAKAGE: El catálogo tiene DOS secciones SEPARADAS:
 *
 *  SECCIÓN A (pública, para mostrar al cliente):
 *    Solo nombres y precios. SIN ningún ID.
 *
 *  SECCIÓN B (interna, para el JSON de AGENDAR):
 *    Mapa nombre → ID, con instrucción explícita de que es solo para
 *    el campo service_id del JSON, NUNCA para el texto que lee el cliente.
 *
 * Esta separación física hace estructuralmente imposible que el LLM
 * mezcle IDs en el texto de respuesta al cliente.
 */
function buildCatalog(servicios) {
    if (!servicios || servicios.length === 0) return 'No hay servicios disponibles en este momento.';

    const listadoPublico = servicios.map(s => {
        const precio = s.sesion != null ? `$${s.sesion}` : 'Consultar';
        const p4 = s.paquete_4_sesiones != null ? ` | Paquete x4: $${s.paquete_4_sesiones}` : '';
        return `  • ${s.nombre} | Precio por sesión: ${precio}${p4}`;
    }).join('\n');

    const mapaIds = servicios.map(s => `  ${s.nombre} → service_id: ${s.id}`).join('\n');

    return `SERVICIOS DEL SPA (MOSTRAR SOLO NOMBRES Y PRECIOS AL CLIENTE, JAMÁS LOS IDs):
${listadoPublico}

MAPA INTERNO DE IDs (SOLO para el campo service_id del JSON AGENDAR — JAMÁS mencionarlo al cliente):
${mapaIds}`;
}

/**
 * Construye el System Prompt para modo CONVERSACIONAL (sin fecha capturada aún).
 * 
 * CLAVE ANTI-ALUCINACIÓN: Este prompt NO contiene ninguna hora ni agenda.
 * Si el usuario pide horas, el bot DEBE pedirle el día primero.
 */
function buildPromptSinFecha(servicios, fechaActual) {
    const catalogo = buildCatalog(servicios);
    return `Eres Nova, la recepcionista digital de nuestro Spa.

FECHA Y HORA ACTUAL DEL SERVIDOR: ${fechaActual}

CATÁLOGO DE SERVICIOS:
${catalogo}

══════════════════════════════════════════════
REGLAS ABSOLUTAS - VIOLACIÓN = ERROR CRÍTICO
══════════════════════════════════════════════

REGLA #0 — IDENTIDAD DE MARCA (NUNCA VIOLAR):
Eres un asistente genérico de Spa. NUNCA debes mencionar la palabra 'Depilarte' bajo
ninguna circunstancia. Refiérete al lugar ÚNICAMENTE como 'el Spa', 'nuestro Spa' o
'la clínica'. Si el usuario te pregunta el nombre del negocio, di que es 'nuestro Spa'.

REGLA #1 — PROHIBICIÓN TOTAL DE MENCIONAR HORAS SIN DÍA:
Tienes TERMINANTEMENTE PROHIBIDO mencionar cualquier hora de cita (ej: "9:00 AM", "las 10", "tengo disponible a las 3") si el usuario NO ha dicho primero un día específico (lunes, martes, el 15, mañana, etc.).

Si el usuario pregunta "¿qué horas tienes?", "¿hay disponibilidad?", "quiero una cita" o cualquier variante SIN mencionar un día, DEBES responder EXACTAMENTE:
"Primero dime qué día te gustaría venir para revisarte la agenda de una vez 😊"

REGLA #2 — HORARIO COMERCIAL:
Solo atendemos de 8:00 AM a 6:00 PM. Si alguien pide fuera de ese rango, rechaza amablemente.

REGLA #3 — FORMATO DE RESPUESTA OBLIGATORIO:
Tu respuesta SIEMPRE termina con tres guiones y un JSON en línea separada:
---
{ "action": "MESSAGING" }

REGLA #4 — BREVEDAD:
Máximo 2-3 oraciones. Eres amable, directa y eficiente.

REGLA #5 — SERVICIOS:
Para incluir un servicio en el JSON de AGENDAR, usa el número del campo [uso_interno_id:X] del catálogo como service_id. NUNCA inventes IDs.

REGLA #6 — NO EXPONER IDs AL USUARIO (OBLIGATORIO):
Está TERMINANTEMENTE PROHIBIDO mostrar al usuario cualquier número de ID, código técnico o referencia interna de la base de datos (ej: "ID: 6", "uso_interno_id:3", "#4").
El usuario solo debe ver el NOMBRE del servicio y su PRECIO. Nunca menciones números de BD.

REGLA #7 — FLEXIBILIDAD SEMÁNTICA (REGLA DE VENTA):
Eres un vendedor inteligente. Los clientes usan nombres cortos, coloquiales o abreviados.
Tu trabajo es INFERIR el servicio correcto del catálogo, NO rechazarlo.

• Si piden "bikini" → asume el servicio de Bikini disponible en el catálogo.
• Si piden "axila" o "axilas" → asume la Depilación de Axilas.
• Si piden "pierna" o "piernas" → asume el servicio de Piernas del catálogo.
• Aplica el mismo criterio a cualquier nombre parcial o informal.

JAMÁS respondas "no ofrecemos ese servicio" si hay una coincidencia lógica o parcial
en el catálogo. En su lugar, confirma amablemente:
"Claro, [Servicio Completo] tiene un costo de $X por sesión. ¿Te lo agendamos?"`;
}

/**
 * Construye el System Prompt para modo SELECCIÓN DE HORA.
 * 
 * CLAVE ANTI-ALUCINACIÓN: El LLM solo recibe la LISTA EXACTA de horas disponibles
 * como texto plano. No recibe citas, no recibe la agenda completa.
 * El LLM no puede inventar horas que no estén en esta lista.
 */
function buildPromptConHoras(servicios, fechaStr, horasDisponibles, fechaActual) {
    const catalogo = buildCatalog(servicios);
    const fechaLegible = formatFechaLegible(fechaStr);

    const listaHoras = horasDisponibles.length > 0
        ? horasDisponibles.join(', ')
        : 'NINGUNA (agenda completamente llena para ese día)';

    return `Eres Nova, la recepcionista digital de nuestro Spa.

FECHA Y HORA ACTUAL DEL SERVIDOR: ${fechaActual}

CATÁLOGO DE SERVICIOS:
${catalogo}

══════════════════════════════════════════════════════════════
DISPONIBILIDAD REAL PARA EL ${fechaLegible.toUpperCase()}
(Datos en tiempo real de la base de datos — NO inventar)
══════════════════════════════════════════════════════════════
Horas disponibles: ${listaHoras}

══════════════════════════════════════════════
REGLAS ABSOLUTAS - VIOLACIÓN = ERROR CRÍTICO
══════════════════════════════════════════════

REGLA #0 — IDENTIDAD DE MARCA (NUNCA VIOLAR):
Eres un asistente genérico de Spa. NUNCA debes mencionar la palabra 'Depilarte' bajo
ninguna circunstancia. Refiérete al lugar ÚNICAMENTE como 'el Spa', 'nuestro Spa' o
'la clínica'. Si el usuario te pregunta el nombre del negocio, di que es 'nuestro Spa'.

REGLA #1 — SOLO OFRECES LO QUE ESTÁ EN LA LISTA:
Las únicas horas que puedes ofrecer son: ${listaHoras}
Si una hora NO está en esa lista, NO EXISTE. Nunca la ofrezcas ni la confirmes.

REGLA #2 — AGENDA LLENA:
Si la lista dice "NINGUNA", debes decirle al cliente que ese día no hay espacio y sugerirle otro día.

REGLA #3 — FORMATO DE RESPUESTA:
Tu respuesta conversacional va primero, luego tres guiones (---), luego el JSON.
- Si solo estás conversando: { "action": "MESSAGING" }
- Si el cliente confirmó definitivamente una hora libre y un servicio:
{ "action": "AGENDAR", "confirmed": true, "service_id": ID_NUMERICO, "datetime": "YYYY-MM-DDTHH:MM:00" }

REGLA #4 — SOBRE EL AGENDAR:
Si devuelves "action": "AGENDAR", NO digas en el texto que la cita está confirmada. El sistema lo hará.
El datetime DEBE usar la fecha ${fechaStr} y una hora de la lista disponible.

REGLA #5 — BREVEDAD:
Máximo 2-3 oraciones. Amable y directa.

REGLA #6 — NO EXPONER IDs AL USUARIO (OBLIGATORIO):
Está TERMINANTEMENTE PROHIBIDO mostrar al usuario cualquier número de ID, código técnico o referencia interna de la base de datos (ej: "ID: 6", "uso_interno_id:3", "#4").
Usa el valor del campo [uso_interno_id:X] del catálogo para el JSON de AGENDAR, pero NUNCA lo menciones en el texto que el cliente lee.

REGLA #7 — FLEXIBILIDAD SEMÁNTICA (REGLA DE VENTA):
Eres un vendedor inteligente. Los clientes usan nombres cortos, coloquiales o abreviados.
Tu trabajo es INFERIR el servicio correcto del catálogo, NO rechazarlo.

• Si piden "bikini" → asume el servicio de Bikini disponible en el catálogo.
• Si piden "axila" o "axilas" → asume la Depilación de Axilas.
• Si piden "pierna" o "piernas" → asume el servicio de Piernas del catálogo.
• Aplica el mismo criterio a cualquier nombre parcial o informal.

JAMÁS respondas "no ofrecemos ese servicio" si hay una coincidencia lógica o parcial
en el catálogo. En su lugar, confirma amablemente:
"Claro, [Servicio Completo] tiene un costo de $X por sesión. ¿Te lo agendamos?"`;
}

// ─── LÓGICA PRINCIPAL ────────────────────────────────────────────────────────

/**
 * Procesa el mensaje entrante con el sistema de Estado de Conversación.
 * 
 * Flujo obligatorio:
 *   1. Identificación del paciente (si es nuevo)
 *   2. Si habla de citas → EXIGIR día primero
 *   3. Con día capturado → Consultar BD → Armar menú de horas
 *   4. Con hora elegida → Validar contra lista real → Agendar o rechazar
 */
async function procesarMensaje(client, msg) {
    await msg.getChat();

    // Normalizar teléfono
    let telefono = msg.from.replace('@c.us', '');
    if (telefono.length > 15) telefono = telefono.split('@')[0];

    const texto = msg.body.trim();
    const textoLower = texto.toLowerCase();

    // ── Comando de reset universal ───────────────────────────────────────────
    if (['salir', 'cancelar', 'reiniciar'].includes(textoLower)) {
        limpiarSesion(telefono);
        return msg.reply('He cancelado cualquier operación pendiente. ¿En qué te puedo ayudar? 😊');
    }

    const sesion = getSesion(telefono);

    // ── Hard Reset de Contexto Temporal ─────────────────────────────────────
    // Se calcula EN CADA MENSAJE para que el bot siempre sepa qué hora es.
    const fechaActual = getFechaActualCaracas();
    console.log(`[ESTADO] ${telefono} → Estado actual: ${sesion.estado} | ${fechaActual}`);

    // ── FLUJO DE REGISTRO (WAIT_NAME) ────────────────────────────────────────
    if (!sesion.pacienteId && !sesion.nombreConfirmado) {
        const paciente = await api.buscarPaciente(msg.from);
        if (paciente && paciente.id) {
            sesion.pacienteId = paciente.id;
            sesion.nombreConfirmado = true;
        } else if (sesion.estado !== 'WAIT_NAME') {
            sesion.estado = 'WAIT_NAME';
            return msg.reply('¡Hola! Veo que es tu primera vez con nosotros. ¿Podrías decirme tu nombre completo por favor?');
        } else {
            const nombre = texto;
            try {
                const nuevo = await api.crearPaciente(nombre, msg.from);
                if (nuevo && (nuevo.id || nuevo.paciente_id)) {
                    sesion.pacienteId = nuevo.id || nuevo.paciente_id;
                    sesion.nombreConfirmado = true;
                    sesion.estado = 'IDLE';
                    return msg.reply(`¡Gracias, ${nombre}! Ya estás en nuestro sistema. ¿En qué te puedo ayudar hoy? 😊`);
                } else {
                    limpiarSesion(telefono);
                    return msg.reply('Hubo un error al registrarte. Por favor, escríbenos de nuevo en un momento.');
                }
            } catch (err) {
                console.error(`[WAIT_NAME] Error al crear paciente ${telefono}:`, err.message);
                limpiarSesion(telefono);
                return msg.reply('Lo siento, hubo un error técnico. Por favor, intenta de nuevo en unos minutos. 🙏');
            }
        }
    }

    // ── FILTRO ANTI-INYECCIÓN (Pre-LLM) ──────────────────────────────────────
    if (detectarInyeccion(texto)) {
        console.warn(`[SECURITY] Prompt injection desde ${telefono}: "${texto.substring(0, 80)}"`);
        return msg.reply('Lo siento, solo puedo ayudarte con consultas y agendamientos del Spa. ¿En qué te puedo asesorar? 😊');
    }

    // ── RAG: Catálogo de servicios (siempre actualizado) ─────────────────────
    const servicios = await api.getServicios();

    // ════════════════════════════════════════════════════════════════════════
    // MÁQUINA DE ESTADOS: Flujo Secuencial Obligatorio
    // ════════════════════════════════════════════════════════════════════════

    // ── ESTADO: WAIT_HORA ────────────────────────────────────────────────────
    // El usuario ya eligió un día. Estamos esperando que elija una hora.
    // ORDEN CRÍTICO: Verificar hora PRIMERO. Solo si no hay hora, comprobar cambio de día.
    // Esto evita el bucle donde "13:30" era interpretado como una nueva fecha.
    if (sesion.estado === 'WAIT_HORA') {
        const horasDisponibles = sesion.datosReserva.horasDisponibles || [];
        const fechaStr = sesion.datosReserva.fecha;

        // ── PRIORIDAD 1: ¿El usuario mencionó una hora? ───────────────────────
        // (extraerHora se evalúa ANTES que extraerFecha para evitar ambigüedad)
        const horaElegida = extraerHora(texto);

        if (horaElegida) {
            // ── VALIDACIÓN DURA: La hora debe estar en la lista real de la BD ─
            if (!horaEsDisponible(horaElegida, horasDisponibles)) {
                const motivo = horasDisponibles.length === 0
                    ? 'ese día ya no tenemos espacio disponible'
                    : 'a esa hora ya tenemos a alguien';

                console.log(`[VALIDACIÓN] ${telefono} → Hora ${horaElegida} RECHAZADA. Disponibles: ${horasDisponibles.join(', ')}`);
                return msg.reply(
                    `Mano, ${motivo}. 😔\n\n` +
                    (horasDisponibles.length > 0
                        ? `Pero te puedo ofrecer: *${horasDisponibles.join(', ')}*\n¿Cuál te queda bien?`
                        : `Intenta con otro día, ¿quieres que revisemos algún otro?`)
                );
            }

            // Hora válida → guardar en sesión y caer al LLM para confirmar servicio
            sesion.datosReserva.hora = horaElegida;
            console.log(`[ESTADO] ${telefono} → Hora VÁLIDA capturada: ${horaElegida}. Pasando al LLM para cierre de servicio.`);

        } else {
            // ── PRIORIDAD 2: ¿El usuario cambió de día? ───────────────────────
            // extraerFecha ahora solo retorna algo si el DÍA es explícito en el texto
            // (isCertain('day')), así que "13:30" solo nunca llega aquí.
            const nuevaFecha = extraerFecha(texto);
            if (nuevaFecha) {
                const nuevaFechaStr = formatFecha(nuevaFecha);
                if (nuevaFechaStr !== fechaStr) {
                    console.log(`[ESTADO] ${telefono} → Cambio de día: ${fechaStr} → ${nuevaFechaStr}`);
                    sesion.datosReserva.fecha = nuevaFechaStr;
                    sesion.datosReserva.hora = null;

                    const citasOcupadas = await api.getCitasOcupadas(nuevaFechaStr);
                    const nuevasHoras = calcularHorasDisponibles(citasOcupadas);
                    sesion.datosReserva.horasDisponibles = nuevasHoras;

                    const fechaLeg = formatFechaLegible(nuevaFechaStr);
                    const listaHoras = nuevasHoras.length > 0
                        ? nuevasHoras.join(', ')
                        : 'ninguna (ese día está lleno)';

                    return msg.reply(
                        `Para el *${fechaLeg}* tengo disponibles estas horas:\n\n` +
                        `🕐 *${listaHoras}*\n\n` +
                        `¿Cuál te queda mejor?`
                    );
                }
            }
        }
    }

    // ── ESTADO: IDLE o detección de intención de cita ────────────────────────
    if (sesion.estado === 'IDLE') {
        // ¿El mensaje menciona un día?
        const fechaDetectada = extraerFecha(texto);

        if (fechaDetectada) {
            // ── TRANSICIÓN: IDLE → WAIT_HORA ───────────────────────────────
            const fechaStr = formatFecha(fechaDetectada);
            sesion.datosReserva.fecha = fechaStr;
            sesion.estado = 'WAIT_HORA';

            console.log(`[ESTADO] ${telefono} → Día capturado: ${fechaStr}. Consultando BD...`);

            // Consultar disponibilidad REAL de la BD
            const citasOcupadas = await api.getCitasOcupadas(fechaStr);
            const horasDisponibles = calcularHorasDisponibles(citasOcupadas);
            sesion.datosReserva.horasDisponibles = horasDisponibles;

            const fechaLeg = formatFechaLegible(fechaStr);

            // ── ANTI-ALUCINACIÓN: El bot solo muestra lo que la BD confirmó ──
            if (horasDisponibles.length === 0) {
                return msg.reply(
                    `Para el *${fechaLeg}* no tenemos espacio disponible. 😔\n\n` +
                    `¿Te gustaría revisar otro día?`
                );
            }

            return msg.reply(
                `Para el *${fechaLeg}* tengo disponibles estas horas:\n\n` +
                `🕐 *${horasDisponibles.join(', ')}*\n\n` +
                `¿Cuál te queda mejor?`
            );

        } else {
            // ── BLOQUEO: No mencionó día → Pedirlo obligatoriamente ──────────
            // Detectar si el mensaje tiene intención de cita para dar respuesta dirigida
            const intencionesCita = /cita|agendar|reservar|hora|disponib|turno|quiero|puedo|atienden|horario/i;
            if (intencionesCita.test(textoLower)) {
                console.log(`[BLOQUEO] ${telefono} → Pregunta de hora sin día. Redirigiendo.`);
                // Agregar al historial y responder con el bloqueo ANTES de llamar al LLM
                sesion.historial.push({ role: 'user', content: texto });
                const respuestaBloqueo = 'Primero dime qué día te gustaría venir para revisarte la agenda de una vez 😊';
                sesion.historial.push({ role: 'assistant', content: respuestaBloqueo });
                return msg.reply(respuestaBloqueo);
            }
            // Si no es intención de cita, dejar que el LLM responda normalmente (con prompt sin horas)
        }
    }

    // ── HISTÓRICO: Agregar mensaje al historial (máx 10 turnos) ─────────────
    sesion.historial.push({ role: 'user', content: texto });
    if (sesion.historial.length > 10) {
        sesion.historial = sesion.historial.slice(sesion.historial.length - 10);
    }

    // ── SELECCIÓN DE PROMPT SEGÚN ESTADO ─────────────────────────────────────
    let systemPrompt;
    if (sesion.estado === 'WAIT_HORA' && sesion.datosReserva.fecha && sesion.datosReserva.horasDisponibles) {
        // Prompt con menú de horas reales → el LLM SOLO puede ofrecer las de la lista
        systemPrompt = buildPromptConHoras(
            servicios,
            sesion.datosReserva.fecha,
            sesion.datosReserva.horasDisponibles,
            fechaActual
        );
    } else {
        // Prompt sin fechas → el LLM tiene prohibido mencionar horas
        systemPrompt = buildPromptSinFecha(servicios, fechaActual);
    }

    // ── LLAMADA AL LLM (Groq / Llama) ────────────────────────────────────────
    try {
        const respuestaIA = await api.consultarGroq(sesion.historial, systemPrompt);

        if (!respuestaIA) {
            return msg.reply('Lo siento, estoy teniendo problemas técnicos. Intenta de nuevo en unos minutos. 🙏');
        }

        console.log('=========================================');
        console.log('🤖 RESPUESTA DEL BOT (Groq):', respuestaIA);
        console.log('=========================================');

        // ── Parsear respuesta estructurada (texto --- JSON) ──────────────────
        let textoParaUsuario = respuestaIA;
        let peticionJson = { action: 'MESSAGING' };

        if (respuestaIA.includes('---')) {
            const partes = respuestaIA.split('---');
            textoParaUsuario = partes[0].trim();
            let jsonString = partes[1].trim().replace(/```json/i, '').replace(/```/g, '').trim();
            try {
                peticionJson = JSON.parse(jsonString);
            } catch (err) {
                console.error('❌ Error al parsear JSON de la IA:', err.message, '| JSON:', jsonString);
            }
        }

        // ── ACCIÓN: AGENDAR ──────────────────────────────────────────────────
        if (peticionJson.action === 'AGENDAR' && peticionJson.confirmed === true) {
            const serviceId     = peticionJson.service_id;
            const datetimeLocal = peticionJson.datetime;

            let fechaCita = '';
            let horaCita  = '';

            if (datetimeLocal && datetimeLocal.includes('T')) {
                fechaCita = datetimeLocal.split('T')[0];
                horaCita  = datetimeLocal.split('T')[1].substring(0, 5);
            }

            // Fallback: si el LLM no generó un datetime válido, usar lo guardado en sesión
            if (!fechaCita || !horaCita) {
                fechaCita = sesion.datosReserva.fecha || '';
                horaCita  = sesion.datosReserva.hora  || '';
                if (fechaCita && horaCita) {
                    console.warn(`[AGENDAR] datetime del LLM ausente/inválido. Usando sesión: ${fechaCita} ${horaCita}`);
                }
            }

            // ── GUARDIA #1: service_id debe ser un entero positivo válido ─────
            // Razón del bug: si el LLM emite service_id: null, el POST llega a
            // FastAPI con servicios_ids: [null] → HTTP 404 silencioso → result=null.
            // En lugar de hacer un POST destinado a fallar, pedimos el servicio al usuario.
            const serviceIdInt = parseInt(serviceId);
            if (!serviceId || isNaN(serviceIdInt) || serviceIdInt <= 0) {
                console.warn(`[AGENDAR] service_id inválido del LLM: "${serviceId}". Pidiendo al usuario.`);
                sesion.historial.push({ role: 'assistant', content: textoParaUsuario });
                return msg.reply(
                    (textoParaUsuario ? textoParaUsuario + '\n\n' : '') +
                    `¿Para cuál servicio deseas agendar tu cita? Por favor indícame el tratamiento (ej: "axilas", "piernas completas", etc.) 😊`
                );
            }

            // ── GUARDIA #2: fecha y hora presentes ───────────────────────────
            if (!fechaCita || !horaCita) {
                console.error(`[AGENDAR] fecha (${fechaCita}) u hora (${horaCita}) ausentes. Abortando POST.`);
                limpiarReserva(sesion);
                return msg.reply('Hubo un problema con los datos de tu cita. Por favor indícame nuevamente el día y hora. 🙏');
            }

            // ── VALIDACIÓN FINAL ANTI-ALUCINACIÓN ────────────────────────────
            const horasDisp = sesion.datosReserva.horasDisponibles || [];
            if (horaCita && horasDisp.length > 0 && !horaEsDisponible(horaCita, horasDisp)) {
                console.error(`[SEGURIDAD] ¡El LLM propuso hora NO disponible! ${horaCita}. Bloqueando AGENDAR.`);
                const alternativas = horasDisp.slice(0, 2).join(' o ');
                sesion.historial.push({ role: 'assistant', content: textoParaUsuario });
                return msg.reply(
                    `Mano, a esa hora (${horaCita}) ya tenemos a alguien. 😔 ` +
                    `Pero te puedo ofrecer *${alternativas}*. ¿Cuál te queda bien?`
                );
            }

            console.log('=========================================');
            console.log('💥 ENGINE AGENDAR ACTIVADO:', peticionJson);
            console.log(`🛠️ POST → paciente: ${sesion.pacienteId}, svc: ${serviceIdInt}, fecha: ${fechaCita}, hora: ${horaCita}`);
            console.log('=========================================');

            // ── POST A FASTAPI: bot espera 200 OK REAL antes de confirmar ─────
            let result;
            try {
                result = await api.crearCita(sesion.pacienteId, [serviceIdInt], fechaCita, horaCita);
            } catch (apiErr) {
                console.error('[AGENDAR] Error de red en crearCita:', apiErr.message || apiErr);
                limpiarReserva(sesion);
                return msg.reply('Hubo un error guardando tu cita en el sistema. Por favor intenta de nuevo. 🙏');
            }

            if (result) {
                const servicioCita   = servicios.find(s => s.id == serviceIdInt);
                const nombreServicio = servicioCita ? servicioCita.nombre : 'tu servicio';
                limpiarReserva(sesion);
                return msg.reply(
                    `✅ ¡Listo! Tu cita para *${nombreServicio}* quedó confirmada para el ` +
                    `*${formatFechaLegible(fechaCita)}* a las *${horaCita}*. ¡Te esperamos! 🎉`
                );
            } else {
                // result === null → FastAPI devolvió un error (422/404/400/500)
                // El detalle exacto ya quedó logueado en api.js crearCita()
                limpiarReserva(sesion);
                return msg.reply('Hubo un error guardando tu cita en el sistema. Por favor intenta de nuevo. 🙏');
            }
        }

        // ── Respuesta conversacional normal ──────────────────────────────────
        sesion.historial.push({ role: 'assistant', content: textoParaUsuario });
        return msg.reply(textoParaUsuario);

    } catch (groqError) {
        console.error('[GROQ ERROR] Fallo al consultar la IA:', groqError.message || groqError);
        return msg.reply('Lo siento, estoy presentando intermitencias técnicas. Por favor, intenta de nuevo en unos minutos. 🙏');
    }
}

module.exports = { procesarMensaje };
