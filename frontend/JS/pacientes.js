// --- CONSTANTS ---
const API_URL = "/api";

// --- DOM ELEMENTS ---
const patientGrid = document.getElementById('patientGrid');
const searchInput = document.getElementById('searchInput');
const filterBtns = document.querySelectorAll('.filter-chip');

// Variables
let patientsDB = [];

// Helper Age
function calculateAge(dob) {
    if (!dob) return "";
    const birthDate = new Date(dob);
    const difference = Date.now() - birthDate.getTime();
    const ageDate = new Date(difference);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
}

// Modal Elements
const profileModal = document.getElementById('profileModal');
const closeProfileBtn = document.getElementById('closeProfileBtn');

// New Patient Modal Elements
const modalNewPatient = document.getElementById('modalNewPatient');
const btnNewPatient = document.getElementById('btnNewPatient');
const btnCancelNew = document.getElementById('btnCancelNew');
const formNewPatient = document.getElementById('formNewPatient');

// (History Modal removed – historial now lives inside the profile tab)

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    fetchPatients();
    setupSearch();

    // Profile Modal Close
    if (closeProfileBtn) {
        closeProfileBtn.addEventListener('click', () => {
            profileModal.classList.remove('active');
        });
    }

    // --- MOBILE SIDEBAR LOGIC ---
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebarOverlay');

    if (menuToggle && sidebar && overlay) {
        function toggleMenu() {
            sidebar.classList.toggle('active');
            overlay.classList.toggle('active');
        }
        menuToggle.addEventListener('click', toggleMenu);
        overlay.addEventListener('click', toggleMenu);
    }

    // --- EVENT DELEGATION FOR DYNAMIC BUTTONS ---
    // Fix for "Ver Perfil" button not working on dynamically created cards
    document.addEventListener('click', async function (e) {
        const btn = e.target.closest('.btn-ver-perfil');
        if (btn) {
            e.preventDefault();
            const clienteId = btn.getAttribute('data-id');
            console.log("Abriendo perfil del cliente (Delegado):", clienteId);
            await loadClientProfile(clienteId);
        }
    });

});

// Alias requested by user
window.loadClientProfile = async function (id) {
    await window.openProfile(id);
};




// ═══════════════════════════════════════════════════════════════════════════
// REGISTRAR PACIENTE — FLUJO BIFURCADO (Limpieza vs Depilación)
// ═══════════════════════════════════════════════════════════════════════════

// Paso 1: clic en "Registrar Paciente" → mostrar selector, NO abrir el form
if (btnNewPatient) {
    btnNewPatient.addEventListener('click', () => {
        document.getElementById('modalTipoHistoria').classList.add('active');
    });
}

// Paso 2a & 2b: delegación sobre document para los botones del selector
// (El modal HTML está después del <script>, así que getElementById retorna null en tiempo de ejecución.
//  Event delegation resuelve eso correctamente.)
document.addEventListener('click', function (e) {
    const btn = e.target.closest('#btnTipoLimpieza, #btnTipoDepilacion');
    if (!btn) return;
    document.getElementById('modalTipoHistoria').classList.remove('active');
    abrirFormNuevoPaciente(btn.id === 'btnTipoLimpieza' ? 'limpieza' : 'depilacion');
});

/**
 * Abre el modalNewPatient configurado para el tipo elegido.
 * tipo: 'limpieza' | 'depilacion'
 */
function abrirFormNuevoPaciente(tipo) {
    // 1. Registrar tipo
    const inputTipo = document.getElementById('inputTipoHistoria');
    if (inputTipo) inputTipo.value = tipo;

    // 2. Configurar título y botón guardar
    const header = modalNewPatient.querySelector('.modal-header h2');
    const btnGuarda = document.getElementById('btnGuardarNuevoPaciente');
    const btnSalud = modalNewPatient.querySelector('[data-tab="tab-salud"]');
    const btnFacial = modalNewPatient.querySelector('[data-tab="tab-facial"]');
    const btnDepTab = document.getElementById('btn-tab-depform');

    if (tipo === 'limpieza') {
        if (header) header.textContent = '🌿 Historia Clínica — Limpieza Facial';
        if (btnGuarda) btnGuarda.style.background = 'linear-gradient(135deg,#15803d,#16a34a)';
        // Mostrar tabs de limpieza, ocultar pestaña depilación
        if (btnSalud) btnSalud.style.display = '';
        if (btnFacial) btnFacial.style.display = '';
        if (btnDepTab) btnDepTab.style.display = 'none';

    } else {
        if (header) header.textContent = '💜 Historia Clínica — Depilación Corporal';
        if (btnGuarda) btnGuarda.style.background = 'linear-gradient(135deg,#7e22ce,#9333ea)';
        // Ocultar tabs de limpieza, mostrar pestaña depilación
        if (btnSalud) btnSalud.style.display = 'none';
        if (btnFacial) btnFacial.style.display = 'none';
        if (btnDepTab) btnDepTab.style.display = '';
    }

    // 3. Abrir modal reseteado — siempre empezar en Datos Personales
    modalNewPatient.classList.add('active');
    switchTab('tab-personal', modalNewPatient);
}

if (btnCancelNew) {
    btnCancelNew.addEventListener('click', () => {
        modalNewPatient.classList.remove('active');
    });
}


// Tab Switching Logic
// switchTab is now context-aware: pass a container element to scope
// the tab switch to only that modal (avoids hiding panes from other modals).
function switchTab(tabId, context) {
    const ctx = context || document.body;

    // 1. Find the tab-bar that owns the target button (scope within ctx)
    const activeBtn = ctx.querySelector(`.tab-item[data-tab="${tabId}"]`);
    if (!activeBtn) return;
    const tabBar = activeBtn.closest('.profile-tabs-bar');

    // 2. Deactivate all buttons in this bar
    if (tabBar) {
        tabBar.querySelectorAll('.tab-item').forEach(b => b.classList.remove('active'));
    }

    // 3. Find the ancestor that contains both the bar and the panes
    //    Walk up from the bar to its parent wrapper, then hide all sibling panes
    const wrapper = tabBar ? tabBar.parentElement : ctx;
    wrapper.querySelectorAll('.tab-pane').forEach(p => p.style.display = 'none');

    // 4. Activate target button and pane
    activeBtn.classList.add('active');
    const activePane = document.getElementById(tabId);
    if (activePane) activePane.style.display = 'block';
}

// Register tabs for NEW PATIENT modal
const newPatientModal = document.getElementById('modalNewPatient');
if (newPatientModal) {
    newPatientModal.querySelectorAll('.profile-tabs-bar .tab-item').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-tab');
            if (targetId) switchTab(targetId, newPatientModal);
        });
    });
}

// Register tabs for PROFILE MODAL
const profileModalEl = document.getElementById('profileModal');
if (profileModalEl) {
    profileModalEl.querySelectorAll('.profile-tabs-bar .tab-item').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-tab');
            if (targetId) switchTab(targetId, profileModalEl);
        });
    });
}

// Close on click outside
window.onclick = function (event) {
    if (event.target == modalNewPatient) modalNewPatient.classList.remove('active');
}

// Handle Form Submit
if (formNewPatient) {
    formNewPatient.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Collect Data
        const formData = new FormData(formNewPatient);
        const nombre = formData.get('nombre').trim();
        const apellido = formData.get('apellido').trim();

        // Build Historia Clinica JSON
        const historiaClinica = {
            personal: {
                fecha_nacimiento: formData.get('fecha_nacimiento'),
                sexo: formData.get('sexo'),
                estado_civil: formData.get('estado_civil'),
                direccion: formData.get('direccion'),
                profesion: formData.get('profesion'),
                referido_por: formData.get('referido_por'),
                hijos: formData.get('hijos')
            },
            estilo_vida: {
                fuma: formData.get('fuma') === 'on',
                alcohol: formData.get('alcohol') === 'on',
                comida_chatarra: formData.get('comida_chatarra') === 'on',
                agua_diaria: formData.get('agua_diaria'),
                horas_sueno: formData.get('horas_sueno'),
                actividad_fisica: formData.get('actividad_fisica')
            },
            antecedentes: {
                diabetes: formData.get('ant_diabetes') === 'on',
                hipertension: formData.get('ant_hipertension') === 'on',
                alergias: formData.get('ant_alergias') === 'on',
                ovarios_poliquisticos: formData.get('ant_ovarios') === 'on',
                hormonas: formData.get('ant_hormonas') === 'on',
                anticonceptivos: formData.get('ant_anticonceptivos') === 'on',
                biopolimeros: formData.get('ant_biopolimeros') === 'on',
                implantes: formData.get('ant_implantes') === 'on',
                botox: formData.get('ant_botox') === 'on',
                hialuronico: formData.get('ant_hialuronico') === 'on'
            },
            diagnostico: {
                biotipo: formData.get('biotipo'),
                fototipo: formData.get('fototipo'),
                observaciones: formData.get('observaciones'),
                patologias: {
                    acne: formData.get('pat_acne') === 'on',
                    melasma: formData.get('pat_melasma') === 'on',
                    rosacea: formData.get('pat_rosacea') === 'on',
                    cicatrices: formData.get('pat_cicatrices') === 'on'
                }
            }
        };

        const payload = {
            nombre_completo: `${nombre} ${apellido}`.trim(),
            cedula: formData.get('cedula').trim(),
            numero_historia: formData.get('historia').trim(),
            telefono: formData.get('telefono').trim(),
            email: formData.get('email') ? formData.get('email').trim() : null,
            historia_clinica: historiaClinica,
            saldo_wallet: 0.0
        };

        const tipoHistoria = formData.get('tipo_historia') || 'limpieza';

        try {
            const response = await fetch(`${API_URL}/pacientes/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.detail || 'Error al guardar paciente');
            }

            const nuevoPaciente = await response.json();

            // Si el tipo elegido es "depilacion", crear historia clínica con los datos del formulario
            if (tipoHistoria === 'depilacion' && nuevoPaciente.id) {
                const gc = (name) => !!formNewPatient.querySelector(`[name="${name}"]`)?.checked;
                const gt = (name) => formNewPatient.querySelector(`[name="${name}"]`)?.value || null;

                const depPayload = {
                    // Antecedentes
                    epilepsia: gc('new-dep-epilepsia'),
                    ovario_poliquistico: gc('new-dep-ovario_poliquistico'),
                    asma: gc('new-dep-asma'),
                    gastricos: gc('new-dep-gastricos'),
                    hipertension: gc('new-dep-hipertension'),
                    hepaticos: gc('new-dep-hepaticos'),
                    alergias: gc('new-dep-alergias'),
                    hirsutismo: gc('new-dep-hirsutismo'),
                    respiratorios: gc('new-dep-respiratorios'),
                    diabetes: gc('new-dep-diabetes'),
                    artritis: gc('new-dep-artritis'),
                    cancer: gc('new-dep-cancer'),
                    analgesicos: gc('new-dep-analgesicos'),
                    antibioticos: gc('new-dep-antibioticos'),
                    // Dermatológicos
                    tipo_piel: gt('new-dep-tipo_piel'),
                    aspecto_piel: gt('new-dep-aspecto_piel'),
                    bronceado: gc('new-dep-bronceado'),
                    acne: gc('new-dep-acne'),
                    fuma: gc('new-dep-fuma'),
                    alcohol: gc('new-dep-alcohol'),
                    blanqueamientos_piel: gc('new-dep-blanqueamientos_piel'),
                    biopolimeros: gc('new-dep-biopolimeros'),
                    botox: gc('new-dep-botox'),
                    plasma: gc('new-dep-plasma'),
                    dermatitis: gc('new-dep-dermatitis'),
                    tatuajes: gc('new-dep-tatuajes'),
                    vitaminas: gc('new-dep-vitaminas'),
                    hilos_tensores: gc('new-dep-hilos_tensores'),
                    acido_hialuronico: gc('new-dep-acido_hialuronico'),
                    // Observaciones
                    medicamentos_ultimo_mes: gt('new-dep-medicamentos'),
                    metodo_anticonceptivo: gt('new-dep-metodo_anticonceptivo'),
                    metodo_depilacion_utilizado: gt('new-dep-metodo_depilacion'),
                    otros: gt('new-dep-otros'),
                };

                try {
                    const depRes = await fetch(`${API_URL}/pacientes/${nuevoPaciente.id}/historia-depilacion`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(depPayload)
                    });
                    if (!depRes.ok) console.warn('Historia depilación: error al guardar detalles');
                } catch (depErr) {
                    console.warn('Historia depilación no guardada:', depErr);
                }
                dpToast('💜 Paciente registrada con Historia de Depilación completa', 'success');
            } else {
                dpToast('🌿 Paciente registrada con Historia de Limpieza Facial', 'success');
            }

            modalNewPatient.classList.remove('active');
            formNewPatient.reset();
            // Restaurar visibilidad de todas las tabs y ocultar depform
            const btnSalud = modalNewPatient.querySelector('[data-tab="tab-salud"]');
            const btnFacial = modalNewPatient.querySelector('[data-tab="tab-facial"]');
            const btnDepT = document.getElementById('btn-tab-depform');
            if (btnSalud) btnSalud.style.display = '';
            if (btnFacial) btnFacial.style.display = '';
            if (btnDepT) btnDepT.style.display = 'none';
            switchTab('tab-personal', modalNewPatient);
            fetchPatients();

        } catch (error) {
            console.error("Registration Error:", error);
            dpToast(`Hubo un error: ${error.message}`, 'error');
        }
    });
}



async function fetchPatients() {
    console.log("Starting fetchPatients...");
    try {
        const response = await fetch(`${API_URL}/pacientes/`);
        console.log("Fetch response status:", response.status);
        if (!response.ok) throw new Error('Error fetching patients');
        let data = await response.json();
        console.log("Data received from API:", data);

        if (!Array.isArray(data)) {
            console.warn("API did not return an array. Attempting to extract data property...", data);
            if (data.results && Array.isArray(data.results)) {
                data = data.results;
            } else if (data.data && Array.isArray(data.data)) {
                data = data.data;
            } else {
                throw new Error("Formato de datos inválido recibido del servidor.");
            }
        }

        console.log(`Cargando ${data.length} pacientes...`);

        // Map Backend -> Frontend
        patientsDB = data.map(p => {
            try {
                return {
                    id: p.id,
                    name: p.nombre_completo || "Sin Nombre",
                    // avatar: removed
                    historyId: p.numero_historia || "???",
                    // Calculate Age
                    age: calculateAge(p.historia_clinica?.personal?.fecha_nacimiento),
                    phone: p.telefono || "",
                    email: p.email || "",
                    tags: [],
                    historia_clinica: p.historia_clinica || {},
                    walletBalance: p.saldo_wallet || 0.0,
                    frecuencia_visitas: p.frecuencia_visitas || 21,
                    nextVisit: p.fecha_proxima_estimada,
                    history: []
                };
            } catch (e) {
                console.error("Error mapping patient:", p, e);
                return null;
            }
        }).filter(x => x !== null); // Filter out failed mappings

        renderDirectory(patientsDB);

    } catch (error) {
        console.error("Error:", error);
        patientGrid.innerHTML = "Error cargando pacientes";
    }
}

// --- RENDER DIRECTORY (GRID RESTORED) ---
// Helper: Generar Link WhatsApp
function generarLinkWhatsapp(telefono) {
    if (!telefono) return '';
    let num = telefono.replace(/\D/g, ''); // Eliminar no-dígitos
    if (num.startsWith('0')) {
        num = '58' + num.substring(1);
    } else if (!num.startsWith('58')) {
        // Regla 2: "Si el número limpio empieza por 0... elimina 0 y agrega 58".
        // Para seguridad, si tiene 10 dígitos y empieza por 4, suele ser Venezuela sin código país.
        if (num.length === 10 && num.startsWith('4')) {
            num = '58' + num;
        }
    }
    return `https://wa.me/${num}`;
}

// --- RENDER DIRECTORY (GRID RESTORED) ---
function renderDirectory(data) {
    patientGrid.innerHTML = '';

    console.log("Rendering directory with items:", data.length);
    if (!data || data.length === 0) {
        patientGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #aaa;">No se encontraron pacientes (0 registros).</p>';
        return;
    }

    // Safely render each card
    data.forEach(p => {
        try {
            const div = document.createElement('div');
            div.className = 'patient-card-dir';

            const waLink = generarLinkWhatsapp(p.phone);

            div.innerHTML = `
                <!-- Avatar Removed -->
                <div class="dir-info">
                    <h4>${p.name || 'Sin Nombre'}</h4>
                    <div class="dir-meta">
                        <span style="font-weight: 600; color: #555;">#${p.historyId || '???'}</span>
                        <span style="display:flex; align-items:center; gap:6px;">
                            <i class="fa-solid fa-phone"></i> ${p.phone || 'N/A'}
                            ${waLink ? `<a href="${waLink}" target="_blank" title="Enviar WhatsApp" style="color: #25D366; font-size: 1.1rem; margin-left: 4px; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'">
                                <i class="fab fa-whatsapp"></i>
                            </a>` : ''}
                        </span>
                    </div>
                
                    <div style="margin-top:10px;">
                    <button class="btn-view-profile btn-ver-perfil" data-id="${p.id}" style="width:100%;">
                        Ver Perfil
                    </button>
                    </div>
                </div>
            `;
            patientGrid.appendChild(div);
        } catch (err) {
            console.error("Error renderizando paciente:", p, err);
        }
    });
}

// --- SEARCH & FILTER LOGIC ---
function setupSearch() {
    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        filterAndRender(term, getActiveFilter());
    });

    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            filterAndRender(searchInput.value.toLowerCase(), btn.getAttribute('data-filter'));
        });
    });
}

function getActiveFilter() {
    const activeBtn = document.querySelector('.filter-chip.active');
    return activeBtn ? activeBtn.getAttribute('data-filter') : 'all';
}

function filterAndRender(term, filterType) {
    const filtered = patientsDB.filter(p => {
        const phoneSafe = p.phone ? String(p.phone) : "";
        const idSafe = p.historyId ? String(p.historyId).toLowerCase() : "";

        const matchText = p.name.toLowerCase().includes(term) || idSafe.includes(term) || phoneSafe.includes(term);
        let matchFilter = true;

        if (filterType === 'deuda') matchFilter = false; // logic placeholder
        if (filterType === 'abono') matchFilter = p.walletBalance > 0;

        return matchText && matchFilter;
    });
    // CHART LOGIC
    updateWalletChart(filtered, filterType);

    renderDirectory(filtered);
}

// --- CHART LOGIC ---
let walletChartInstance = null;

function updateWalletChart(players, filterType) {
    const container = document.getElementById('walletSummaryContainer');
    const totalAmountEl = document.getElementById('totalWalletAmount');
    const countEl = document.getElementById('walletCount');
    const canvas = document.getElementById('walletChart');

    if (filterType !== 'abono') {
        container.style.display = 'none';
        return;
    }

    // Prepare Data
    // 1. Total
    const total = players.reduce((sum, p) => sum + (p.walletBalance || 0), 0);

    // 2. Counts for Pie Chart (e.g. Ranges)
    // Low: < $50, Mid: $50-$200, High: > $200
    let low = 0, mid = 0, high = 0;
    players.forEach(p => {
        const bal = p.walletBalance || 0;
        if (bal < 50) low++;
        else if (bal < 200) mid++;
        else high++;
    });

    // Update UI
    container.style.display = 'flex';
    totalAmountEl.textContent = `$${total.toFixed(2)}`;
    countEl.textContent = players.length;

    // Render Chart
    if (walletChartInstance) {
        walletChartInstance.destroy();
    }

    const ctx = canvas.getContext('2d');
    walletChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Menos de $50', '$50 - $200', 'Más de $200'],
            datasets: [{
                data: [low, mid, high],
                backgroundColor: [
                    '#94a3b8', // Grey
                    '#3b82f6', // Blue
                    '#10b981'  // Green
                ],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        boxWidth: 12,
                        font: { size: 10 }
                    }
                }
            },
            cutout: '70%'
        }
    });
}

// openHistory removed – historial is now inside the profile modal tab (tab-historial)

// --- PROFILE MODAL LOGIC (RESTORED & ENHANCED) ---
// --- PROFILE MODAL LOGIC (RESTORED & ENHANCED) ---
// ── EDITAR DATOS BÁSICOS: module-level state ──────────────────────────────────
let _currentPacienteId = null;
let _currentPacienteData = null;

window.openProfile = async function (id) {
    console.log("Intentando abrir perfil ID:", id);

    // Show Modal immediately with loading state
    profileModal.classList.add('active');
    // Always reset to Pestaña 1 (Datos del Perfil) when opening
    switchTab('tab-limpieza', profileModal);

    // Set loading state in UI
    document.getElementById('lbl-nombre').textContent = "Cargando...";
    document.getElementById('tbl-historial-body').innerHTML = '<tr><td colspan="5" style="text-align:center;">Cargando datos del paciente...</td></tr>';

    try {
        // Fetch complete patient data (including history) from backend
        const response = await fetch(`${API_URL}/pacientes/${id}`);
        if (!response.ok) throw new Error("Error cargando ficha del paciente");
        const p = await response.json();

        // Store current patient globally so the edit-modal can access it
        _currentPacienteData = p;
        _currentPacienteId = id;

        console.log("Datos del paciente recibidos:", p);

        // 1. Populate Header
        // Robust Name Display: Try atomic props first (if backend added them), then composite, then fallback
        const nombreReal = p.nombre || '';
        const apellidoReal = p.apellido || '';
        const historia = p.numero_historia || 'S/N';
        let tituloFinal = `${nombreReal} ${apellidoReal}`.trim();

        if (!tituloFinal) {
            tituloFinal = p.nombre_completo || 'Sin Nombre';
        }

        // Requested Format: "Nombre Apellido - Hist: 100"
        tituloFinal = `${tituloFinal} - Hist: ${historia}`;

        // Helper to safely set text
        const setText = (id, text) => {
            const el = document.getElementById(id);
            if (el) el.textContent = text;
        };

        setText('lbl-nombre', tituloFinal);
        setText('lbl-cedula', p.cedula || 'V-00.000.000');
        setText('lbl-historia', p.numero_historia);
        setText('lbl-telefono', p.telefono || 'N/A');
        setText('lbl-email', p.email || 'N/A');

        // 2. Extra Personal Data from JSON
        const personal = p.historia_clinica && p.historia_clinica.personal ? p.historia_clinica.personal : {};
        setText('lbl-direccion', personal.direccion || 'No registrada');

        // Calculate Age if needed or display from data
        let ageStr = '';
        if (personal.fecha_nacimiento) {
            const ag = calculateAge(personal.fecha_nacimiento);
            ageStr = ` (${ag} años)`;
        }
        setText('lbl-nacimiento', (personal.fecha_nacimiento || '--/--/----') + ageStr);

        // Sexo y Civil
        const sexo = personal.sexo === 'F' ? 'Femenino' : (personal.sexo === 'M' ? 'Masculino' : '-');
        setText('lbl-sexo-civil', `${sexo} | ${personal.estado_civil || '-'}`);

        setText('lbl-profesion', personal.profesion || '-');
        setText('lbl-referido', personal.referido_por || '-');
        setText('lbl-hijos', personal.hijos || '0');

        // 3. Lifestyle
        const estilo = p.historia_clinica && p.historia_clinica.estilo_vida ? p.historia_clinica.estilo_vida : {};
        setText('lbl-fuma', estilo.fuma ? 'Sí' : 'No');
        setText('lbl-alcohol', estilo.alcohol ? 'Sí' : 'No');
        setText('lbl-chatarra', estilo.comida_chatarra ? 'Sí' : 'No');
        setText('lbl-agua', estilo.agua_diaria || '-');
        setText('lbl-sueno', estilo.horas_sueno ? `${estilo.horas_sueno}h` : '-');
        setText('lbl-actividad', estilo.actividad_fisica || '-');

        // 4. Antecedents
        const ant = p.historia_clinica && p.historia_clinica.antecedentes ? p.historia_clinica.antecedentes : {};
        setText('lbl-diabetes', ant.diabetes ? 'Sí' : 'No');
        setText('lbl-hipertension', ant.hipertension ? 'Sí' : 'No');
        setText('lbl-alergias', ant.alergias ? 'Sí' : 'No');
        setText('lbl-ovarios', ant.ovarios_poliquisticos ? 'Sí' : 'No');
        setText('lbl-hormonas', ant.hormonas ? 'Sí' : 'No');
        setText('lbl-anticonceptivos', ant.anticonceptivos ? 'Sí' : 'No');

        // Alerta Estéticos
        const bioEl = document.getElementById('lbl-biopolimeros');
        if (bioEl) {
            bioEl.textContent = ant.biopolimeros ? 'SÍ (Riesgo)' : 'No';
            bioEl.style.color = ant.biopolimeros ? '#EF4444' : '#333';
        }

        setText('lbl-implantes', ant.implantes ? 'Sí' : 'No');
        setText('lbl-botox', ant.botox ? 'Sí' : 'No');
        setText('lbl-hialuronico', ant.hialuronico ? 'Sí' : 'No');

        // 5. Diagnosis
        const diag = p.historia_clinica && p.historia_clinica.diagnostico ? p.historia_clinica.diagnostico : {};
        setText('lbl-biotipo', diag.biotipo || '-');
        setText('lbl-fototipo', diag.fototipo || '-');
        setText('lbl-observaciones', diag.observaciones || 'Sin observaciones.');

        // Patologías Badges
        const patParams = diag.patologias || {};
        const patContainer = document.getElementById('lbl-patologias');
        if (patContainer) {
            patContainer.innerHTML = '';

            const activePats = [];
            if (patParams.acne) activePats.push('Acné Activo');
            if (patParams.melasma) activePats.push('Melasma');
            if (patParams.rosacea) activePats.push('Rosácea');
            if (patParams.cicatrices) activePats.push('Cicatrices');

            if (activePats.length === 0) {
                patContainer.innerHTML = '<span style="color:#888; font-size:0.9rem;">Ninguna visible</span>';
            } else {
                activePats.forEach(pt => {
                    const span = document.createElement('span');
                    span.textContent = pt;
                    span.style.cssText = 'background:#fee2e2; color:#991b1b; padding:4px 10px; border-radius:12px; font-size:0.85rem; font-weight:600;';
                    patContainer.appendChild(span);
                });
            }
        }

        const walletEl = document.getElementById('lbl-wallet');
        if (walletEl) {
            walletEl.textContent = `$${(p.saldo_wallet || 0).toFixed(2)}`;
            // Style wallet if positive
            if (p.saldo_wallet > 0) {
                walletEl.style.color = '#16a34a'; // Green
            } else {
                walletEl.style.color = '#333';
            }
        }

        // 6. Historial Citas (Loaded from backend property)
        const tbody = document.getElementById('tbl-historial-body');
        tbody.innerHTML = '';

        const historial = p.historial_citas || [];

        if (historial.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 20px; color: #777;">Sin historial previo.</td></tr>';
        } else {
            historial.forEach(item => {
                const tr = document.createElement('tr');

                // Map the new rich logic for services and sale types
                let serviciosRows = "<span class='text-muted'>Servicio General</span>";

                if (item.servicios_detalle && item.servicios_detalle.length > 0) {
                    serviciosRows = `<div style="display: flex; flex-direction: column; gap: 8px;">` + item.servicios_detalle.map(s => {
                        let tipoVentaStr = s.tipo_venta ? String(s.tipo_venta).toLowerCase() : "sesión";

                        // Pastel aesthetic mappings
                        let badgeBg = "#E0F2FE"; // Light Blue
                        let badgeColor = "#0284C7";
                        let saleLabel = "Individual";

                        if (tipoVentaStr === 'package' || tipoVentaStr === 'paquete') {
                            badgeBg = "#DCFCE7"; // Light Green
                            badgeColor = "#16A34A";
                            saleLabel = "Paquete";
                        } else if (tipoVentaStr === 'promotion' || tipoVentaStr === 'promocion' || tipoVentaStr === 'promo') {
                            badgeBg = "#FEF3C7"; // Light Yellow
                            badgeColor = "#D97706";
                            saleLabel = "Promoción";
                        }

                        return `
                            <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px dashed #eee; padding-bottom: 5px;">
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <div style="width: 6px; height: 6px; border-radius: 50%; background-color: var(--primary);"></div>
                                    <strong style="color: #333; font-size: 0.95rem;">${s.nombre}</strong>
                                </div>
                                <span style="background-color: ${badgeBg}; color: ${badgeColor}; padding: 4px 10px; border-radius: 12px; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                                    ${saleLabel}
                                </span>
                            </div>
                        `;
                    }).join('') + `</div>`;
                } else if (item.motivo) {
                    serviciosRows = `<strong style="color: #333; font-size: 0.95rem;"><i class="fa-solid fa-list-check" style="color: var(--primary); margin-right: 5px;"></i> ${item.motivo}</strong>`;
                }

                // Format Date nicely
                let dateObj = new Date(item.fecha);
                let dateStr = dateObj.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });

                tr.style.cssText = "transition: background 0.2s; cursor: default;";
                // Add hover effect by assigning class via JS not easily possible if not in CSS, so doing minimal styling inline
                tr.addEventListener('mouseover', () => tr.style.background = '#f8fafc');
                tr.addEventListener('mouseout', () => tr.style.background = 'transparent');

                tr.innerHTML = `
                    <td style="vertical-align: middle; width: 120px;">
                        <div style="background: #FAFAFA; border: 1px solid #E5E7EB; border-radius: 8px; padding: 8px 10px; display: inline-block; text-align: center;">
                            <i class="fa-regular fa-calendar" style="color: #9CA3AF; display: block; margin-bottom: 3px;"></i>
                            <span style="font-weight: 600; color: #4B5563; font-size: 0.9rem;">${dateStr}</span>
                        </div>
                    </td>
                    <td style="font-weight: 400; vertical-align: middle; padding: 15px 20px;">
                        ${serviciosRows}
                    </td>
                    <td style="vertical-align: middle; text-align: right; width: 120px;">
                        <div style="font-weight: 800; font-size: 1.15rem; color: #10B981;">
                            $${item.monto_total.toFixed(2)}
                        </div>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }

        // ── Historia Depilación: load after main profile data ──
        await depilacionLoad(id);
        // ── Historia Limpieza: load after main profile data ──
        await limpiezaLoad(id);

    } catch (e) {
        console.error("Error cargando perfil:", e);
        // Fallback or Toast
        dpToast("Error cargando perfil: " + e.message, 'error');
        document.getElementById('lbl-nombre').textContent = "Error: " + e.message;

        const tbody = document.getElementById('tbl-historial-body');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:red;">
                <i class="fa-solid fa-triangle-exclamation"></i> No se pudo cargar la información.
            </td></tr>`;
        }
    }
};


// ═══════════════════════════════════════════════════════════════════════════════
// HISTORIA DEPILACIÓN MODULE
// ═══════════════════════════════════════════════════════════════════════════════

let _depPacienteId = null;    // ID del paciente activo en el perfil
let _depExiste = false;   // true → ya tiene historia (usar PUT), false → usar POST

// ── Badge helpers ─────────────────────────────────────────────────────────────

const DEP_ANTECEDENTES = {
    epilepsia: 'Epilepsia', ovario_poliquistico: 'Ovario Poliquístico', asma: 'Asma',
    gastricos: 'Gástricos', hipertension: 'Hipertensión', hepaticos: 'Hepáticos',
    alergias: 'Alergias', hirsutismo: 'Hirsutismo', respiratorios: 'Respiratorios',
    diabetes: 'Diabetes', artritis: 'Artritis', cancer: 'Cáncer',
    analgesicos: 'Analgésicos', antibioticos: 'Antibióticos'
};
const DEP_DERMATO = {
    bronceado: 'Bronceado', acne: 'Acné', fuma: 'Fuma', alcohol: 'Alcohol',
    blanqueamientos_piel: 'Blanqueamientos', biopolimeros: '⚠️ Biopolímeros',
    botox: 'Botox', plasma: 'Plasma', dermatitis: 'Dermatitis', tatuajes: 'Tatuajes',
    vitaminas: 'Vitaminas', hilos_tensores: 'Hilos Tensores', acido_hialuronico: 'Ác. Hialurónico'
};

function _buildBadges(data, map, container) {
    const el = document.getElementById(container);
    if (!el) return;
    const active = Object.keys(map).filter(k => data[k]);
    if (active.length === 0) {
        el.innerHTML = '<span style="color:#aaa;font-size:0.85rem;">Ninguno registrado</span>';
        return;
    }
    el.innerHTML = active.map(k => {
        const isWarn = k === 'biopolimeros';
        return `<span style="background:${isWarn ? '#fee2e2' : '#ede9fe'};color:${isWarn ? '#dc2626' : '#7e22ce'};padding:3px 10px;border-radius:20px;font-size:0.8rem;font-weight:600;">${map[k]}</span>`;
    }).join('');
}

function _setVal(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val || '-';
}

// ── Render summary view ───────────────────────────────────────────────────────

function depilacionRender(data) {
    document.getElementById('dep-cargando').style.display = 'none';

    if (!data) {
        document.getElementById('dep-vacio').style.display = 'block';
        document.getElementById('dep-resumen').style.display = 'none';
        _depExiste = false;
        return;
    }

    _depExiste = true;
    document.getElementById('dep-vacio').style.display = 'none';
    document.getElementById('dep-resumen').style.display = 'block';

    _buildBadges(data, DEP_ANTECEDENTES, 'dep-antecedentes-badges');
    _buildBadges(data, DEP_DERMATO, 'dep-dermato-badges');

    _setVal('dep-tipo-piel', data.tipo_piel);
    _setVal('dep-aspecto-piel', data.aspecto_piel);
    _setVal('dep-medicamentos', data.medicamentos_ultimo_mes);
    _setVal('dep-anticonceptivo', data.metodo_anticonceptivo);
    _setVal('dep-metodo', data.metodo_depilacion_utilizado);
    _setVal('dep-otros', data.otros);
}

// ── Load (called by openProfile) ──────────────────────────────────────────────

async function depilacionLoad(pacienteId) {
    _depPacienteId = pacienteId;

    // Reset states
    document.getElementById('dep-cargando').style.display = 'block';
    document.getElementById('dep-vacio').style.display = 'none';
    document.getElementById('dep-resumen').style.display = 'none';

    try {
        const res = await fetch(`${API_URL}/pacientes/${pacienteId}/historia-depilacion`);
        if (res.status === 404) {
            depilacionRender(null);
        } else if (res.ok) {
            depilacionRender(await res.json());
        } else {
            depilacionRender(null);
        }
    } catch (err) {
        console.warn('Error cargando historia depilación:', err);
        depilacionRender(null);
    }
}

// ── Open modal (shared for Agregar + Editar) ──────────────────────────────────

async function depilacionAbrirModal() {
    const modal = document.getElementById('modalHistoriaDepilacion');
    const form = document.getElementById('formHistoriaDepilacion');
    if (!modal || !form) return;
    form.reset();

    document.getElementById('dep-modal-titulo').textContent =
        _depExiste ? '✏️ Editar Historia de Depilación' : '➕ Nueva Historia de Depilación';

    if (_depExiste && _depPacienteId) {
        try {
            const res = await fetch(`${API_URL}/pacientes/${_depPacienteId}/historia-depilacion`);
            if (res.ok) {
                const d = await res.json();
                // Fill checkboxes (name matches field name exactly)
                Object.keys({ ...DEP_ANTECEDENTES, ...DEP_DERMATO }).forEach(key => {
                    const el = form.querySelector(`[name="${key}"]`);
                    if (el && el.type === 'checkbox') el.checked = !!d[key];
                });
                // Fill selects
                const setSelect = (name, val) => {
                    const el = form.querySelector(`[name="${name}"]`);
                    if (el && val) el.value = val;
                };
                setSelect('tipo_piel', d.tipo_piel);
                setSelect('aspecto_piel', d.aspecto_piel);
                // Fill text inputs
                ['medicamentos_ultimo_mes', 'metodo_anticonceptivo',
                    'metodo_depilacion_utilizado', 'otros'].forEach(f => {
                        const el = form.querySelector(`[name="${f}"]`);
                        if (el && d[f]) el.value = d[f];
                    });
            }
        } catch (err) { console.warn('Pre-fill error:', err); }
    }

    modal.classList.add('active');
}

// Button listeners (using event delegation because they may not exist at parse time)
document.addEventListener('click', function (e) {
    if (e.target && e.target.id === 'btn-dep-agregar') depilacionAbrirModal();
    if (e.target && e.target.id === 'btn-dep-editar') depilacionAbrirModal();
});

// ── Form submit (POST or PUT) ─────────────────────────────────────────────────

// Delegar el evento submit sobre document ya que el form de depilación puede no existir al cargar el script
document.addEventListener('submit', async function (e) {
    if (e.target && e.target.id === 'formHistoriaDepilacion') {
        e.preventDefault();
        if (!_depPacienteId) return;

        const formDep = e.target;
        const fd = new FormData(formDep);
        // Checkboxes: unchecked items won't appear in FormData, so we check differently
        const getCheck = name => !!formDep.querySelector(`[name="${name}"]`)?.checked;

        const payload = {
            // Antecedentes
            epilepsia: getCheck('epilepsia'),
            ovario_poliquistico: getCheck('ovario_poliquistico'),
            asma: getCheck('asma'),
            gastricos: getCheck('gastricos'),
            hipertension: getCheck('hipertension'),
            hepaticos: getCheck('hepaticos'),
            alergias: getCheck('alergias'),
            hirsutismo: getCheck('hirsutismo'),
            respiratorios: getCheck('respiratorios'),
            diabetes: getCheck('diabetes'),
            artritis: getCheck('artritis'),
            cancer: getCheck('cancer'),
            analgesicos: getCheck('analgesicos'),
            antibioticos: getCheck('antibioticos'),
            // Dermatológicos
            tipo_piel: fd.get('tipo_piel') || null,
            aspecto_piel: fd.get('aspecto_piel') || null,
            bronceado: getCheck('bronceado'),
            acne: getCheck('acne'),
            fuma: getCheck('fuma'),
            alcohol: getCheck('alcohol'),
            blanqueamientos_piel: getCheck('blanqueamientos_piel'),
            biopolimeros: getCheck('biopolimeros'),
            botox: getCheck('botox'),
            plasma: getCheck('plasma'),
            dermatitis: getCheck('dermatitis'),
            tatuajes: getCheck('tatuajes'),
            vitaminas: getCheck('vitaminas'),
            hilos_tensores: getCheck('hilos_tensores'),
            acido_hialuronico: getCheck('acido_hialuronico'),
            // Observaciones
            medicamentos_ultimo_mes: fd.get('medicamentos_ultimo_mes') || null,
            metodo_anticonceptivo: fd.get('metodo_anticonceptivo') || null,
            metodo_depilacion_utilizado: fd.get('metodo_depilacion_utilizado') || null,
            otros: fd.get('otros') || null,
        };

        const method = _depExiste ? 'PUT' : 'POST';

        try {
            const res = await fetch(`${API_URL}/pacientes/${_depPacienteId}/historia-depilacion`, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error((await res.json()).detail || 'Error al guardar');
            const saved = await res.json();
            dpToast('✅ Historia de Depilación guardada', 'success');
            document.getElementById('modalHistoriaDepilacion').classList.remove('active');
            depilacionRender(saved);
        } catch (err) {
            dpToast('Error: ' + err.message, 'error');
        }
    }
});


// ═══════════════════════════════════════════════════════════════════════════════
// HISTORIA LIMPIEZA MODULE
// ═══════════════════════════════════════════════════════════════════════════════

let _limpPacienteId = null; // ID del paciente activo en el perfil
let _limpExiste = false;    // true → ya tiene historia (usar PUT), false → usar POST

// ── Antecedentes badge map ──────────────────────────────────────────────────────────────────────
const LIMP_ANTECEDENTES = {
    diabetes: 'Diabetes (Fam)', hipertension: 'Hipertensión (Fam)', alergias: 'Alergias',
    ovarios_poliquisticos: 'Ovarios Poliq.', hormonas: 'Prob. Hormonales',
    anticonceptivos: 'Anticonceptivos', biopolimeros: '⚠️ Biopolímeros',
    implantes: 'Implantes', botox: 'Botox', acido_hialuronico: 'Ác. Hialurónico'
};
const LIMP_PATOLOGIAS = {
    pat_acne: 'Acné Activo', pat_melasma: 'Melasma',
    pat_rosacea: 'Rosácea', pat_cicatrices: 'Cicatrices'
};

function _limpBuildBadges(data, map, containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const active = Object.keys(map).filter(k => data[k]);
    if (active.length === 0) {
        el.innerHTML = '<span style="color:#aaa;font-size:0.85rem;">Ninguno registrado</span>';
        return;
    }
    el.innerHTML = active.map(k => {
        const isWarn = k === 'biopolimeros';
        return `<span style="background:${isWarn ? '#fee2e2' : '#dcfce7'};color:${isWarn ? '#dc2626' : '#15803d'};padding:3px 10px;border-radius:20px;font-size:0.8rem;font-weight:600;">${map[k]}</span>`;
    }).join('');
}

function _limpSetVal(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val || '-';
}

// ── Render summary view ────────────────────────────────────────────────────────────────────────────
function limpiezaRender(data) {
    document.getElementById('limp-cargando').style.display = 'none';

    if (!data) {
        document.getElementById('limp-vacio').style.display = 'block';
        document.getElementById('limp-resumen').style.display = 'none';
        _limpExiste = false;
        return;
    }

    _limpExiste = true;
    document.getElementById('limp-vacio').style.display = 'none';
    document.getElementById('limp-resumen').style.display = 'block';

    // Estilo de vida
    _limpSetVal('limp-fuma', data.fuma ? 'Sí' : 'No');
    _limpSetVal('limp-alcohol', data.alcohol ? 'Sí' : 'No');
    _limpSetVal('limp-chatarra', data.comida_chatarra ? 'Sí' : 'No');
    _limpSetVal('limp-agua', data.agua_diaria);
    _limpSetVal('limp-sueno', data.horas_sueno ? `${data.horas_sueno}h` : '-');
    _limpSetVal('limp-actividad', data.actividad_fisica);

    // Antecedentes badges
    _limpBuildBadges(data, LIMP_ANTECEDENTES, 'limp-antecedentes-badges');

    // Diagnóstico
    _limpSetVal('limp-biotipo', data.biotipo_cutaneo);
    _limpSetVal('limp-fototipo', data.fototipo);
    _limpBuildBadges(data, LIMP_PATOLOGIAS, 'limp-patologias-badges');
    _limpSetVal('limp-observaciones', data.observaciones);
}

// ── Load (called by openProfile) ────────────────────────────────────────────────────────────────────────────
async function limpiezaLoad(pacienteId) {
    _limpPacienteId = pacienteId;

    // Reset states
    document.getElementById('limp-cargando').style.display = 'block';
    document.getElementById('limp-vacio').style.display = 'none';
    document.getElementById('limp-resumen').style.display = 'none';

    try {
        const res = await fetch(`${API_URL}/pacientes/${pacienteId}/historia-limpieza`);
        if (res.status === 404) {
            limpiezaRender(null);
        } else if (res.ok) {
            limpiezaRender(await res.json());
        } else {
            limpiezaRender(null);
        }
    } catch (err) {
        console.warn('Error cargando historia limpieza:', err);
        limpiezaRender(null);
    }
}

// ── Open modal (shared for Agregar + Editar) ────────────────────────────────────────────────────────
async function limpiezaAbrirModal() {
    const modal = document.getElementById('modalHistoriaLimpieza');
    const form = document.getElementById('formHistoriaLimpieza');
    if (!modal || !form) return;
    form.reset();

    document.getElementById('limp-modal-titulo').textContent =
        _limpExiste ? '✏️ Editar Historia de Limpieza Facial' : '➕ Nueva Historia de Limpieza Facial';

    if (_limpExiste && _limpPacienteId) {
        try {
            const res = await fetch(`${API_URL}/pacientes/${_limpPacienteId}/historia-limpieza`);
            if (res.ok) {
                const d = await res.json();

                // Pre-fill checkboxes
                const LIMP_ALL = {
                    ...LIMP_ANTECEDENTES, ...LIMP_PATOLOGIAS,
                    fuma: 'Fuma', alcohol: 'Alcohol', comida_chatarra: 'Comida Chatarra'
                };
                Object.keys(LIMP_ALL).forEach(key => {
                    const el = form.querySelector(`[name="limp-${key}"]`);
                    if (el && el.type === 'checkbox') el.checked = !!d[key];
                });

                // Pre-fill selects
                const setSelect = (name, val) => {
                    const el = form.querySelector(`[name="limp-${name}"]`);
                    if (el && val) el.value = val;
                };
                setSelect('biotipo_cutaneo', d.biotipo_cutaneo);
                setSelect('fototipo', d.fototipo);

                // Pre-fill text inputs
                ['agua_diaria', 'horas_sueno', 'actividad_fisica', 'observaciones'].forEach(f => {
                    const el = form.querySelector(`[name="limp-${f}"]`);
                    if (el && d[f]) el.value = d[f];
                });
            }
        } catch (err) { console.warn('Pre-fill limp error:', err); }
    }

    modal.classList.add('active');
}

// Button listeners (event delegation)
document.addEventListener('click', function (e) {
    if (e.target && e.target.id === 'btn-limp-agregar') limpiezaAbrirModal();
    if (e.target && e.target.id === 'btn-limp-editar') limpiezaAbrirModal();
});

// ── Form submit (POST or PUT) ────────────────────────────────────────────────────────────────────────────
document.addEventListener('submit', async function (e) {
    if (e.target && e.target.id === 'formHistoriaLimpieza') {
        e.preventDefault();
        if (!_limpPacienteId) return;

        const formLimp = e.target;
        const getCheck = name => !!formLimp.querySelector(`[name="limp-${name}"]`)?.checked;
        const getVal = name => formLimp.querySelector(`[name="limp-${name}"]`)?.value || null;

        const payload = {
            // Estilo de vida
            fuma: getCheck('fuma'),
            alcohol: getCheck('alcohol'),
            comida_chatarra: getCheck('comida_chatarra'),
            agua_diaria: getVal('agua_diaria'),
            horas_sueno: getVal('horas_sueno'),
            actividad_fisica: getVal('actividad_fisica'),
            // Antecedentes
            diabetes: getCheck('diabetes'),
            hipertension: getCheck('hipertension'),
            alergias: getCheck('alergias'),
            ovarios_poliquisticos: getCheck('ovarios_poliquisticos'),
            hormonas: getCheck('hormonas'),
            anticonceptivos: getCheck('anticonceptivos'),
            biopolimeros: getCheck('biopolimeros'),
            implantes: getCheck('implantes'),
            botox: getCheck('botox'),
            acido_hialuronico: getCheck('acido_hialuronico'),
            // Diagnóstico facial
            biotipo_cutaneo: getVal('biotipo_cutaneo'),
            fototipo: getVal('fototipo'),
            pat_acne: getCheck('pat_acne'),
            pat_melasma: getCheck('pat_melasma'),
            pat_rosacea: getCheck('pat_rosacea'),
            pat_cicatrices: getCheck('pat_cicatrices'),
            observaciones: getVal('observaciones'),
        };

        const method = _limpExiste ? 'PUT' : 'POST';

        try {
            const res = await fetch(`${API_URL}/pacientes/${_limpPacienteId}/historia-limpieza`, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error((await res.json()).detail || 'Error al guardar');
            const saved = await res.json();
            dpToast('✅ Historia de Limpieza guardada', 'success');
            document.getElementById('modalHistoriaLimpieza').classList.remove('active');
            limpiezaRender(saved);
        } catch (err) {
            dpToast('Error: ' + err.message, 'error');
        }
    }
});


// ═══════════════════════════════════════════════════════════════════════════════
// EDITAR DATOS BÁSICOS DEL PACIENTE
// ═══════════════════════════════════════════════════════════════════════════════

function editarDatosBasicosAbrir() {
    const p = _currentPacienteData;
    if (!p) return;

    const personal = (p.historia_clinica && p.historia_clinica.personal) ? p.historia_clinica.personal : {};

    // Pre-fill top-level fields
    document.getElementById('edit-nombre_completo').value = p.nombre_completo || '';
    document.getElementById('edit-cedula').value = p.cedula || '';
    document.getElementById('edit-telefono').value = p.telefono || '';
    document.getElementById('edit-email').value = p.email || '';

    // Pre-fill personal sub-fields
    document.getElementById('edit-direccion').value = personal.direccion || '';
    document.getElementById('edit-fecha_nacimiento').value = personal.fecha_nacimiento || '';

    const sexoEl = document.getElementById('edit-sexo');
    if (sexoEl) sexoEl.value = personal.sexo || 'F';

    const civilEl = document.getElementById('edit-estado_civil');
    if (civilEl) civilEl.value = personal.estado_civil || 'Soltero';

    document.getElementById('modalEditarPacienteBase').classList.add('active');
}

// Click delegation for the edit button (lives inside the profile modal DOM)
document.addEventListener('click', function (e) {
    if (e.target && e.target.id === 'btn-editar-datos-basicos') editarDatosBasicosAbrir();
});

// Form submit — PUT /api/pacientes/{id}
document.addEventListener('submit', async function (e) {
    if (e.target && e.target.id === 'formEditarPacienteBase') {
        e.preventDefault();
        if (!_currentPacienteId || !_currentPacienteData) return;

        // Build payload: top-level + personal inside historia_clinica
        const personal = Object.assign(
            {},
            (_currentPacienteData.historia_clinica && _currentPacienteData.historia_clinica.personal)
                ? _currentPacienteData.historia_clinica.personal
                : {},
            {
                direccion: document.getElementById('edit-direccion').value || null,
                fecha_nacimiento: document.getElementById('edit-fecha_nacimiento').value || null,
                sexo: document.getElementById('edit-sexo').value || null,
                estado_civil: document.getElementById('edit-estado_civil').value || null,
            }
        );

        const nuevaHistoria = Object.assign(
            {},
            _currentPacienteData.historia_clinica || {},
            { personal }
        );

        const payload = {
            nombre_completo: document.getElementById('edit-nombre_completo').value,
            cedula: document.getElementById('edit-cedula').value,
            telefono: document.getElementById('edit-telefono').value || null,
            email: document.getElementById('edit-email').value || null,
            historia_clinica: nuevaHistoria,
        };

        try {
            const res = await fetch(`${API_URL}/pacientes/${_currentPacienteId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || 'Error al guardar');
            }

            const saved = await res.json();

            // Update module state
            _currentPacienteData = Object.assign({}, _currentPacienteData, saved, { historia_clinica: nuevaHistoria });

            // Update DOM labels without reloading
            const historia = saved.numero_historia || _currentPacienteData.numero_historia;
            const nombre = (saved.nombre_completo || '').trim() || 'Paciente';
            document.getElementById('lbl-nombre').textContent = `${nombre} - Hist: ${historia}`;
            document.getElementById('lbl-cedula').textContent = saved.cedula || '';
            document.getElementById('lbl-telefono').textContent = saved.telefono || 'N/A';
            document.getElementById('lbl-email').textContent = saved.email || 'N/A';

            // Personal fields
            document.getElementById('lbl-direccion').textContent = personal.direccion || 'No registrada';
            let ageStr = '';
            if (personal.fecha_nacimiento) {
                const ag = calculateAge(personal.fecha_nacimiento);
                ageStr = ` (${ag} años)`;
            }
            document.getElementById('lbl-nacimiento').textContent = (personal.fecha_nacimiento || '--/--/----') + ageStr;
            const sexoLabel = personal.sexo === 'F' ? 'Femenino' : (personal.sexo === 'M' ? 'Masculino' : '-');
            document.getElementById('lbl-sexo-civil').textContent = `${sexoLabel} | ${personal.estado_civil || '-'}`;

            // Update the patient card in the main table too (if it exists)
            const cardNombre = document.querySelector(`[data-id="${_currentPacienteId}"] .patient-name`);
            if (cardNombre) cardNombre.textContent = nombre;

            document.getElementById('modalEditarPacienteBase').classList.remove('active');
            dpToast('✅ Datos del paciente actualizados', 'success');

        } catch (err) {
            dpToast('Error: ' + err.message, 'error');
        }
    }
});


// ═══════════════════════════════════════════════════════════════════════════════
// PAQUETES (CUPONERA) & WALLET MODULE
// ═══════════════════════════════════════════════════════════════════════════════

let _paquetesActivos = [];

/** Carga los paquetes activos del paciente y renderiza el bloque de inventario. */
async function paquetesLoad(pacienteId) {
    try {
        const res = await fetch(`${API_URL}/pacientes/${pacienteId}/paquetes`);
        if (!res.ok) { _paquetesActivos = []; paquetesRender([]); return; }
        _paquetesActivos = await res.json();
        paquetesRender(_paquetesActivos);
    } catch {
        _paquetesActivos = [];
        paquetesRender([]);
    }
}

function paquetesRender(lista) {
    const wrapper = document.getElementById('paq-inventario');
    const listEl = document.getElementById('paq-list');
    if (!wrapper || !listEl) return;

    if (!lista || lista.length === 0) {
        wrapper.style.display = 'none';
        return;
    }

    wrapper.style.display = 'block';
    listEl.innerHTML = lista.map(p => `
        <div style="display:flex; align-items:center; justify-content:space-between;
                    background:#f0fdf4; border:1px solid #bbf7d0; border-radius:10px;
                    padding:10px 14px; margin-bottom:8px;">
            <div>
                <div style="font-weight:700; color:#166534; font-size:0.95rem;">${p.nombre_paquete}</div>
                <div style="font-size:0.82rem; color:#4b5563; margin-top:2px;">
                    💲${p.precio_por_sesion.toFixed(2)} / sesión
                </div>
            </div>
            <div style="text-align:right;">
                <div style="background:#15803d; color:#fff; border-radius:20px; padding:3px 12px; font-weight:700; font-size:0.9rem;">
                    ${p.sesiones_restantes} <span style="font-weight:400; font-size:0.78rem;">/ ${p.total_sesiones}</span>
                </div>
                <div style="font-size:0.75rem; color:#9ca3af; margin-top:2px;">sesiones restantes</div>
            </div>
        </div>
    `).join('');
}

// ── Conectar paquetesLoad() al openProfile ──────────────────────────────────
// Override: save the original openProfile and chain paquetesLoad after it.
(function () {
    const _origOpenProfile = window.openProfile;
    window.openProfile = async function (id) {
        await _origOpenProfile(id);
        await paquetesLoad(id);
    };
})();

// ── Click delegation ─────────────────────────────────────────────────────────
document.addEventListener('click', function (e) {
    if (e.target && e.target.id === 'btn-vender-paquete') {
        document.getElementById('modalVenderPaquete').classList.add('active');
    }
    if (e.target && e.target.id === 'btn-abonar-wallet') {
        document.getElementById('wallet-monto').value = '';
        document.getElementById('modalAbonarWallet').classList.add('active');
    }
});

// ── FORM: Vender Paquete ─────────────────────────────────────────────────────
document.addEventListener('submit', async function (e) {
    if (e.target && e.target.id === 'formVenderPaquete') {
        e.preventDefault();
        if (!_currentPacienteId) return;

        const payload = {
            nombre_paquete: document.getElementById('paq-nombre').value,
            total_sesiones: parseInt(document.getElementById('paq-total').value),
            precio_por_sesion: parseFloat(document.getElementById('paq-precio').value),
        };

        try {
            const res = await fetch(`${API_URL}/pacientes/${_currentPacienteId}/paquetes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) { const err = await res.json(); throw new Error(err.detail || 'Error'); }

            document.getElementById('modalVenderPaquete').classList.remove('active');
            e.target.reset();
            await paquetesLoad(_currentPacienteId);
            dpToast('✅ Paquete vendido y registrado', 'success');
        } catch (err) {
            dpToast('Error: ' + err.message, 'error');
        }
    }
});

// ── FORM: Abonar Wallet ──────────────────────────────────────────────────────
document.addEventListener('submit', async function (e) {
    if (e.target && e.target.id === 'formAbonarWallet') {
        e.preventDefault();
        if (!_currentPacienteId) return;

        const monto = parseFloat(document.getElementById('wallet-monto').value);
        if (!monto || monto <= 0) { dpToast('Ingresa un monto válido', 'warning'); return; }

        try {
            const res = await fetch(`${API_URL}/pacientes/${_currentPacienteId}/wallet/abonar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ monto })
            });
            if (!res.ok) { const err = await res.json(); throw new Error(err.detail || 'Error'); }
            const data = await res.json();

            // Update wallet display live
            const nuevoSaldo = data.saldo_wallet;
            document.getElementById('lbl-wallet').textContent = `$${nuevoSaldo.toFixed(2)}`;
            if (_currentPacienteData) _currentPacienteData.saldo_wallet = nuevoSaldo;

            document.getElementById('modalAbonarWallet').classList.remove('active');
            dpToast(`✅ $${monto.toFixed(2)} abonados al wallet`, 'success');
        } catch (err) {
            dpToast('Error: ' + err.message, 'error');
        }
    }
});
