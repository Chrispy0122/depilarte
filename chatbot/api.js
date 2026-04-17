const axios = require('axios');
require('dotenv').config();

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8000';
const NEGOCIO_ID   = process.env.NEGOCIO_ID_DEFAULT || '1';
const BOT_TOKEN    = process.env.BOT_API_TOKEN || `fake-token-bot-tenant-${NEGOCIO_ID}`;

// Instancia centralizada de Axios con cabeceras de autenticación multi-tenant.
// Para soportar un Bearer Token real en el futuro, sólo cambia BOT_API_TOKEN en .env.
const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${BOT_TOKEN}`,
        'X-Negocio-ID': NEGOCIO_ID
    }
});

// ─── Utilidad de Limpieza de Número ─────────────────────────────────────────
/**
 * Limpia el ID de WhatsApp manteniendo su formato internacional.
 *
 * Ejemplo:  +58 412 0500031@c.us  →  584120500031
 * NOTA: Esta función ya NO reemplaza el "58" por un "0" para asegurar el cruce
 * exacto con FastAPI en bases de datos que guardan el número internacional puro.
 */
function formatPhoneNumber(waId) {
    // 1. Eliminar sufijo de WhatsApp (@c.us, @s.whatsapp.net, etc.)
    let number = waId.split('@')[0];

    // 2. Limpiar símbolos no numéricos (+, espacios, guiones)
    number = number.replace(/[\+ \-]/g, '');

    return number;
}

/**
 * Obtiene el catálogo de servicios (Flujo 1)
 */
async function getServicios() {
    try {
        const response = await api.get('/api/servicios/');
        return response.data;
    } catch (error) {
        console.error('Error al obtener servicios:', error.message);
        return [];
    }
}

/**
 * Busca un paciente por teléfono (Flujo 2)
 */
async function buscarPaciente(waId) {
    // 1. Extraemos ÚNICAMENTE los últimos 10 dígitos del número.
    // Ejemplo: '584120500031@c.us' -> '4120500031'
    // Como FastAPI busca con '.like("%...%")', esto coincidirá tanto si 
    // está guardado como '0412...' o como '58412...'
    const telefonoLimpio = waId.replace(/\D/g, '').slice(-10);
    
    try {
        console.log("🔍 BUSCANDO PACIENTE EN:", API_BASE_URL + `/api/pacientes/buscar?telefono=${encodeURIComponent(telefonoLimpio)}`);
        const response = await api.get(`/api/pacientes/buscar?telefono=${encodeURIComponent(telefonoLimpio)}`);
        return response.data;
    } catch (error) {
        if (error.response && error.response.status === 404) {
            return null; // No encontrado
        }
        console.error("❌ ERROR AL BUSCAR PACIENTE:", error.response?.data || error.message);
        return null;
    }
}

/**
 * Crea un paciente (Registro Express) (Flujo 2)
 */
async function crearPaciente(nombre, waId) {
    // Normalizar el número antes de guardar en la BD
    const telefono = formatPhoneNumber(waId);
    try {
        const payload = {
            nombre_completo: nombre,
            telefono: telefono,
            origen: 'WhatsApp'
        };
        const response = await api.post('/api/pacientes/', payload);
        return response.data;
    } catch (error) {
        console.error('Error al crear paciente:', error.response?.data || error.message);
        return null;
    }
}

/**
 * Verifica disponibilidad de citas (Flujo 3)
 */
async function verificarDisponibilidad(fecha) {
    try {
        // Asume fecha formato YYYY-MM-DD
        const response = await api.get(`/api/citas/disponibilidad?fecha=${fecha}`);
        return response.data; // Podría devolver arreglo de horarios libres o estructura específica
    } catch (error) {
        console.error('Error al verificar disponibilidad:', error.message);
        return [];
    }
}

/**
 * Crea una cita (Flujo 3)
 *
 * DIAGNÓSTICO HABILITADO: Loguea el payload COMPLETO antes de enviar y el
 * error HTTP COMPLETO si FastAPI rechaza la solicitud.
 *
 * El bot NO confirma la cita hasta recibir 200 OK. Si hay error, retorna null
 * para que flujos.js muestre el mensaje de error correcto al usuario.
 */
async function crearCita(paciente_id, servicios_ids, fecha, hora) {
    const fechaHoraInicio = `${fecha}T${hora}:00`;
    const payload = {
        cliente_id: paciente_id,
        servicios_ids: servicios_ids,
        fecha_hora_inicio: fechaHoraInicio,
        negocio_id: parseInt(NEGOCIO_ID)
    };

    // ── DIAGNÓSTICO: payload completo antes del POST ──────────────────────────
    console.log('=========================================');
    console.log('📤 [crearCita] Enviando a FastAPI:');
    console.log(JSON.stringify(payload, null, 2));
    console.log(`🎯 Endpoint: POST ${API_BASE_URL}/api/agenda/`);
    console.log('=========================================');

    try {
        const response = await api.post('/api/agenda/', payload);
        console.log(`✅ [crearCita] Cita guardada. ID: ${response.data?.id}`);
        return response.data;
    } catch (error) {
        const status = error.response?.status;
        const detail = error.response?.data?.detail || error.message;

        // ── Log verboso: muestra exactamente qué rechazó FastAPI ─────────────
        console.error('=========================================');
        console.error(`❌ [crearCita] ERROR HTTP ${status}:`);
        console.error('  Detalle:', detail);
        console.error('  Payload enviado:', JSON.stringify(payload));
        console.error('=========================================');

        if (status === 409) {
            // Cita duplicada exacta — tratar como éxito silencioso
            console.log(`[ANTI-DUP] HTTP 409 (cita ya existe). Simulando éxito.`);
            return { fake: true, detail };
        }

        // 422 (campo inválido), 404 (servicio no existe), 400 (solapamiento)
        // → retornar null para que flujos.js muestre el error al usuario
        return null;
    }
}

/**
 * Consulta los turnos ocupados de una fecha (Flujo RAG de Disponibilidad)
 * Devuelve array de citas para una fecha dada.
 */
async function getCitasOcupadas(fecha) {
    try {
        const response = await api.get(`/api/agenda/?fecha=${fecha}`);
        return response.data || [];
    } catch (error) {
        console.error('Error al obtener citas ocupadas:', error.message);
        return []; // Si falla, asumimos todo disponible (mejor experiencia)
    }
}

/**
 * Consulta a Llama 3.1 vía Groq.
 * Recibe el historial de mensajes y un System Prompt pre-construido con datos RAG.
 * El caller (flujos.js) es responsable de inyectar el contexto dinámico.
 */
async function consultarGroq(historial, systemPrompt) {
    try {
        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
            console.error('Falta GROQ_API_KEY en .env');
            return null;
        }

        // Fallback: Si no hay variable, usa el 70B (versatile). Si ese falla, el usuario puede
        // cambiar en su .env GROQ_MODEL="llama3-8b-8192"
        const targetModel = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

        const data = {
            model: targetModel,
            messages: [
                { role: "system", content: systemPrompt },
                ...historial
            ],
            temperature: 0.5,
            max_tokens: 400
        };

        const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', data, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            }
        });

        return response.data.choices[0].message.content;
    } catch (error) {
        console.error('Error al consultar Groq:', error.response?.data || error.message);
        return null;
    }
}

module.exports = {
    formatPhoneNumber,
    getServicios,
    getCitasOcupadas,
    buscarPaciente,
    crearPaciente,
    verificarDisponibilidad,
    crearCita,
    consultarGroq
};
