const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const flujos = require('./flujos');
const api = require('./api');
const axios = require('axios');
const path = require('path');

// ─── ARRANQUE: CONFIRMACIÓN DE RUTA Y VERSIÓN ────────────────────────────
// v2.0 — Motor de Estados Secuenciales (Anti-Alucinación)
// Estos logs confirman que el proceso arrancó y está en el lugar correcto.
console.log(`⏳ [NOVUS v2.0 - Estado Secuencial] Iniciando chatbot desde: ${__dirname}`);
console.log(`⏳ [NOVUS] Arrancado a las: ${new Date().toLocaleString('es-VE', { timeZone: 'America/Caracas' })}`);
console.log(`⏳ [NOVUS] Node.js version: ${process.version}`);
console.log(`⏳ [NOVUS] index.js path: ${__filename}`);

// Instancia de axios con timeout configurado para todas las llamadas al backend
const backendAxios = axios.create({
    baseURL: 'http://localhost:8000',
    timeout: 3000  // 3 segundos máximo — evita que el Kill Switch bloquee el procesamiento
});

// Inicializar cliente con persistencia de sesión local
const client = new Client({
    authStrategy: new LocalAuth({ dataPath: path.join(__dirname, '.wwebjs_auth') }),
    authTimeoutMs: 0,

    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            // User-Agent real de Chrome para evitar que Meta detecte headless y fuerce un reload
            '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
        ],
    }
    // webVersionCache eliminado: la versión remota fija estaba obsoleta y causaba
    // que WA forzara un reload destruyendo el contexto de Puppeteer.
    // Sin este campo, whatsapp-web.js usa la versión que WA sirve por defecto.
});

client.on('qr', (qr) => {
    console.log('Enviando código QR al Dashboard via Webhook...');
    backendAxios.post('/api/bot/webhook', { status: 'AWAITING_QR', qr: qr }).catch(()=>null);
});

client.on('authenticated', () => {
    console.log('✅ ¡Sesión autenticada correctamente!');
    backendAxios.post('/api/bot/webhook', { status: 'AUTHENTICATED', qr: null }).catch(()=>null);
});

client.on('auth_failure', msg => {
    console.error('❌ Hubo un fallo en la autenticación', msg);
    backendAxios.post('/api/bot/webhook', { status: 'AUTH_FAILURE', qr: null }).catch(()=>null);
});

client.on('disconnected', (reason) => {
    console.error('❌ WhatsApp Desconectado:', reason);
    backendAxios.post('/api/bot/webhook', { status: 'DISCONNECTED', qr: null }).catch(()=>null);
});

let botReadyTimestamp = 0;

client.on('ready', () => {
    botReadyTimestamp = Math.floor(Date.now() / 1000);
    console.log('✅ Motor NOVUS activo - Esperando señal de activación del Dashboard');
    backendAxios.post('/api/bot/webhook', { status: 'CONNECTED', qr: null }).catch(()=>null);
});

const mensajesProcesados = new Set();

// Escuchar mensajes entrantes
client.on('message', async (msg) => {
    // 1. Ignorar estados de WhatsApp (statuses)
    if (msg.from === 'status@broadcast' || msg.isStatus) return;

    // 2. Ignorar mensajes propios (enviados por el bot o desde el propio teléfono)
    if (msg.fromMe) return;

    // 3. Ignorar mensajes antiguos (historial sincronizado al arrancar)
    // Solo procesamos mensajes nuevos que lleguen después de que el bot esté listo
    if (msg.timestamp < botReadyTimestamp) return;

    // ── CACHE ANTI-DUPLICADOS (Idempotencia en memoria) ──
    if (msg.id && msg.id._serialized) {
        const msgId = msg.id._serialized;
        if (mensajesProcesados.has(msgId)) {
            console.log(`[ANTI-DUP] Mensaje bloqueado (ya procesado): ${msgId}`);
            return;
        }
        mensajesProcesados.add(msgId);
        setTimeout(() => mensajesProcesados.delete(msgId), 30000); // 30s de memoria
    }

    // ─── KILL SWITCH CHECK (con timeout para no bloquear) ────────────────────
    try {
        const res = await backendAxios.get('/api/negocio/1/estado-bot');
        const isActivo = res.data?.bot_activo === true;
        
        console.log(`Revisando estado del bot... [${isActivo ? 'ACTIVO' : 'INACTIVO'}]`);

        if (!isActivo) {
            console.log(`⏸️ Bot en modo reposo absoluto. Ignorando mensaje de: ${msg.from}`);
            return; // Se aborta el procesamiento del mensaje
        }
    } catch (err) {
        // Timeout o API inalcanzable — será conservador y NO responder
        console.error(`⚠️ Kill Switch inalcanzable (${err.code || err.message}), ignorando mensaje por seguridad.`);
        return;
    }
    // ────────────────────────────────────────────────────────────────────────

    console.log(`[MENSAJE RECIBIDO] 
De: ${msg.from} | Texto: 
${msg.body}`);

    // Ignorar mensajes de grupos
    const chat = await msg.getChat();
    if (chat.isGroup) return;

    // Extraer número de teléfono
    let telefono = msg.from.replace('@c.us', '');
    if (telefono.length > 15) {
        telefono = telefono.split('@')[0];
    }

    // Verificar si el remitente está en la base de datos (paciente registrado)
    // Pasamos msg.from directamente; formatPhoneNumber() en api.js se encarga
    // de strip y conversión de formato (ej. 584120500031@c.us → 04120500031).
    const paciente = await api.buscarPaciente(msg.from);
    if (!paciente || !paciente.id) {
        console.log(`Mensaje de ${msg.from} ignorado por no ser un paciente registrado en el sistema.`);
        // msg.reply('Lo siento, el bot solo está disponible para pacientes registrados de este Spa.'); // Opcional: avisarle.
        return;
    }

    try {
        await flujos.procesarMensaje(client, msg);
    } catch (error) {
        console.error('Error procesando mensaje:', error);
        msg.reply('Lo siento, en este momento estoy teniendo problemas técnicos. Por favor, intenta de nuevo más tarde.');
    }
});

// El .catch captura fallos de inicio sin lanzar un UnhandledPromiseRejection
// que mataría el proceso de Node.js.
client.initialize().catch(err => {
    console.error('❌ Error crítico al inicializar el cliente:', err);
});
