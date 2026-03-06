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




// --- NEW PATIENT MODAL HANDLERS ---
// --- NEW PATIENT MODAL HANDLERS ---
if (btnNewPatient) {
    btnNewPatient.addEventListener('click', () => {
        modalNewPatient.classList.add('active');
        // Reset to Tab 1
        switchTab('tab-personal', modalNewPatient);
    });
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

            // Success
            dpToast('¡Historia Clínica guardada exitosamente!', 'success');
            modalNewPatient.classList.remove('active');
            formNewPatient.reset();
            switchTab('tab-personal', modalNewPatient); // Reset tabs
            fetchPatients(); // Reload list

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
window.openProfile = async function (id) {
    console.log("Intentando abrir perfil ID:", id);

    // Show Modal immediately with loading state
    profileModal.classList.add('active');
    // Always reset to Pestaña 1 (Datos del Perfil) when opening
    switchTab('tab-perfil', profileModal);

    // Set loading state in UI
    document.getElementById('lbl-nombre').textContent = "Cargando...";
    document.getElementById('tbl-historial-body').innerHTML = '<tr><td colspan="5" style="text-align:center;">Cargando datos del paciente...</td></tr>';

    try {
        // Fetch complete patient data (including history) from backend
        const response = await fetch(`${API_URL}/pacientes/${id}`);
        if (!response.ok) throw new Error("Error cargando ficha del paciente");
        const p = await response.json();

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

        // 7. Load Historias Clínicas sections (Limpieza + Depilación)
        await loadHistoriasClinicas(id, p.historia_clinica || null);

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


// ═══════════════════════════════════════════════════════════════════════════
// HISTORIA CLÍNICAS MODULE
// State tracked per open profile
// ═══════════════════════════════════════════════════════════════════════════
let _currentPacienteId = null;
let _historiaDepilacionExiste = false;
let _historiaLimpiezaData = null; // mirrors historia_clinica JSON on the cliente

// ── Helpers ──────────────────────────────────────────────────────────────

function _showBool(val) {
    return val ? '<span style="color:#16a34a; font-weight:700;">Sí</span>' : '<span style="color:#aaa;">No</span>';
}

function _badgesFromDepilacion(d) {
    const bools = ['alergias', 'diabetes', 'hipertension', 'ovario_poliquistico', 'cancer', 'biopolimeros', 'tatuajes'];
    const labels = {
        alergias: 'Alergias', diabetes: 'Diabetes', hipertension: 'Hipertensión',
        ovario_poliquistico: 'Ovario Poliq.', cancer: 'Cáncer', biopolimeros: '⚠️ Biopolím.',
        tatuajes: 'Tatuajes'
    };
    return bools
        .filter(k => d[k])
        .map(k => `<span style="background:#f3e8ff;color:#7e22ce;padding:2px 8px;border-radius:10px;font-size:0.78rem;font-weight:600;margin:2px;">${labels[k]}</span>`)
        .join('') || '<span style="color:#aaa;font-size:0.85rem;">Sin antecedentes marcados</span>';
}

// ── Render section states ────────────────────────────────────────────────

function _renderDepilacionSection(data) {
    const resumenDiv = document.getElementById('depilacion-resumen');
    const resumenContent = document.getElementById('depilacion-resumen-content');
    const emptyDiv = document.getElementById('depilacion-empty');
    const editBtn = document.getElementById('btn-edit-depilacion');

    if (!resumenDiv) return;

    if (data) {
        // Has data – show summary
        _historiaDepilacionExiste = true;
        resumenContent.innerHTML = `
            <div style="margin-bottom:8px;">${_badgesFromDepilacion(data)}</div>
            <div class="p-data-item" style="border-bottom:1px dashed #e9d5ff; padding-bottom:4px; margin-bottom:4px;">
                <span style="color:#64748b;">Tipo Piel:</span>
                <span style="font-weight:600;">${data.tipo_piel || '-'} ${data.aspecto_piel ? '/ ' + data.aspecto_piel : ''}</span>
            </div>
            <div class="p-data-item" style="border-bottom:1px dashed #e9d5ff; padding-bottom:4px; margin-bottom:4px;">
                <span style="color:#64748b;">Método Depilación:</span>
                <span style="font-weight:600;">${data.metodo_depilacion_utilizado || '-'}</span>
            </div>
            <div class="p-data-item">
                <span style="color:#64748b;">Anticonceptivo:</span>
                <span style="font-weight:600;">${data.metodo_anticonceptivo || '-'}</span>
            </div>
            ${data.medicamentos_ultimo_mes ? `<div style="margin-top:6px; font-size:0.8rem; color:#7e22ce;">💊 Medicamentos: ${data.medicamentos_ultimo_mes}</div>` : ''}
        `;
        resumenDiv.style.display = 'block';
        emptyDiv.style.display = 'none';
        if (editBtn) editBtn.style.display = 'inline-block';
    } else {
        // No data – show add button
        _historiaDepilacionExiste = false;
        resumenDiv.style.display = 'none';
        emptyDiv.style.display = 'block';
        if (editBtn) editBtn.style.display = 'none';
    }
}

function _renderLimpiezaSection(historiaClinica) {
    const resumenDiv = document.getElementById('limpieza-resumen');
    const resumenContent = document.getElementById('limpieza-resumen-content');
    const emptyDiv = document.getElementById('limpieza-empty');
    const editBtn = document.getElementById('btn-edit-limpieza');

    if (!resumenDiv) return;

    _historiaLimpiezaData = historiaClinica;

    const diag = historiaClinica && historiaClinica.diagnostico ? historiaClinica.diagnostico : null;
    const ant = historiaClinica && historiaClinica.antecedentes ? historiaClinica.antecedentes : null;

    if (diag || ant) {
        resumenContent.innerHTML = `
            <div class="p-data-item" style="border-bottom:1px dashed #bbf7d0; padding-bottom:4px; margin-bottom:4px;">
                <span style="color:#64748b;">Biotipo/Fototipo:</span>
                <span style="font-weight:600;">${diag?.biotipo || '-'} / ${diag?.fototipo || '-'}</span>
            </div>
            <div class="p-data-item" style="border-bottom:1px dashed #bbf7d0; padding-bottom:4px; margin-bottom:4px;">
                <span style="color:#64748b;">Alergias:</span>
                <span>${_showBool(ant?.alergias)}</span>
            </div>
            <div class="p-data-item" style="border-bottom:1px dashed #bbf7d0; padding-bottom:4px; margin-bottom:4px;">
                <span style="color:#64748b;">Biopolímeros:</span>
                <span style="${ant?.biopolimeros ? 'color:#ef4444; font-weight:700;' : ''}">${_showBool(ant?.biopolimeros)}</span>
            </div>
            ${diag?.observaciones ? `<div style="margin-top:6px; font-size:0.8rem; color:#15803d; font-style:italic;">📝 ${diag.observaciones}</div>` : ''}
        `;
        resumenDiv.style.display = 'block';
        emptyDiv.style.display = 'none';
        if (editBtn) editBtn.style.display = 'inline-block';
    } else {
        resumenDiv.style.display = 'none';
        emptyDiv.style.display = 'block';
        if (editBtn) editBtn.style.display = 'none';
    }
}

// ── Load (called from openProfile) ───────────────────────────────────────

async function loadHistoriasClinicas(pacienteId, historiaClinicaJSON) {
    _currentPacienteId = pacienteId;

    // Limpieza section (from JSON already loaded in openProfile)
    _renderLimpiezaSection(historiaClinicaJSON);

    // Depilacion section (fetch separate endpoint)
    try {
        const res = await fetch(`${API_URL}/pacientes/${pacienteId}/historia-depilacion`);
        if (res.status === 404) {
            _renderDepilacionSection(null);
        } else if (res.ok) {
            const data = await res.json();
            _renderDepilacionSection(data);
        } else {
            _renderDepilacionSection(null);
        }
    } catch (e) {
        console.warn('No se pudo cargar historia depilación:', e);
        _renderDepilacionSection(null);
    }
}

// ── Open Modal: Depilación ────────────────────────────────────────────────

window.openModalDepilacion = async function () {
    const modal = document.getElementById('modalHistoriaDepilacion');
    const form = document.getElementById('formHistoriaDepilacion');
    if (!modal || !form) return;
    form.reset();

    if (_historiaDepilacionExiste && _currentPacienteId) {
        try {
            const res = await fetch(`${API_URL}/pacientes/${_currentPacienteId}/historia-depilacion`);
            if (res.ok) {
                const d = await res.json();
                // Fill checkboxes
                const boolFields = [
                    'epilepsia', 'ovario_poliquistico', 'asma', 'gastricos', 'hipertension', 'hepaticos',
                    'alergias', 'hirsutismo', 'respiratorios', 'diabetes', 'artritis', 'cancer', 'analgesicos',
                    'antibioticos', 'bronceado', 'fuma', 'blanqueamientos_piel', 'botox', 'acne', 'alcohol',
                    'biopolimeros', 'plasma', 'dermatitis', 'tatuajes', 'vitaminas', 'hilos_tensores', 'acido_hialuronico'
                ];
                boolFields.forEach(f => {
                    const el = form.querySelector(`[name="dep_${f}"]`);
                    if (el) el.checked = !!d[f];
                });
                // Fill selects / text inputs
                const setVal = (name, val) => {
                    const el = form.querySelector(`[name="${name}"]`);
                    if (el && val) el.value = val;
                };
                setVal('dep_tipo_piel', d.tipo_piel);
                setVal('dep_aspecto_piel', d.aspecto_piel);
                setVal('dep_medicamentos_ultimo_mes', d.medicamentos_ultimo_mes);
                setVal('dep_metodo_anticonceptivo', d.metodo_anticonceptivo);
                setVal('dep_metodo_depilacion_utilizado', d.metodo_depilacion_utilizado);
                setVal('dep_otros', d.otros);
            }
        } catch (e) { console.warn('Pre-fill depilacion error:', e); }
    }

    modal.classList.add('active');
};

// ── Save form: Depilación ─────────────────────────────────────────────────

const formDep = document.getElementById('formHistoriaDepilacion');
if (formDep) {
    formDep.addEventListener('submit', async function (e) {
        e.preventDefault();
        if (!_currentPacienteId) return;

        const fd = new FormData(formDep);
        const getBool = name => fd.has(name);

        const payload = {
            epilepsia: getBool('dep_epilepsia'),
            ovario_poliquistico: getBool('dep_ovario_poliquistico'),
            asma: getBool('dep_asma'),
            gastricos: getBool('dep_gastricos'),
            hipertension: getBool('dep_hipertension'),
            hepaticos: getBool('dep_hepaticos'),
            alergias: getBool('dep_alergias'),
            hirsutismo: getBool('dep_hirsutismo'),
            respiratorios: getBool('dep_respiratorios'),
            diabetes: getBool('dep_diabetes'),
            artritis: getBool('dep_artritis'),
            cancer: getBool('dep_cancer'),
            analgesicos: getBool('dep_analgesicos'),
            antibioticos: getBool('dep_antibioticos'),
            tipo_piel: fd.get('dep_tipo_piel') || null,
            aspecto_piel: fd.get('dep_aspecto_piel') || null,
            bronceado: getBool('dep_bronceado'),
            fuma: getBool('dep_fuma'),
            blanqueamientos_piel: getBool('dep_blanqueamientos_piel'),
            botox: getBool('dep_botox'),
            acne: getBool('dep_acne'),
            alcohol: getBool('dep_alcohol'),
            biopolimeros: getBool('dep_biopolimeros'),
            plasma: getBool('dep_plasma'),
            dermatitis: getBool('dep_dermatitis'),
            tatuajes: getBool('dep_tatuajes'),
            vitaminas: getBool('dep_vitaminas'),
            hilos_tensores: getBool('dep_hilos_tensores'),
            acido_hialuronico: getBool('dep_acido_hialuronico'),
            medicamentos_ultimo_mes: fd.get('dep_medicamentos_ultimo_mes') || null,
            metodo_anticonceptivo: fd.get('dep_metodo_anticonceptivo') || null,
            metodo_depilacion_utilizado: fd.get('dep_metodo_depilacion_utilizado') || null,
            otros: fd.get('dep_otros') || null,
        };

        const method = _historiaDepilacionExiste ? 'PUT' : 'POST';

        try {
            const res = await fetch(`${API_URL}/pacientes/${_currentPacienteId}/historia-depilacion`, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || 'Error guardando');
            }
            const saved = await res.json();
            dpToast('✅ Historia de Depilación guardada', 'success');
            document.getElementById('modalHistoriaDepilacion').classList.remove('active');
            _renderDepilacionSection(saved);
        } catch (err) {
            dpToast('Error: ' + err.message, 'error');
        }
    });
}

// ── Open Modal: Limpieza ──────────────────────────────────────────────────

window.openModalLimpieza = function () {
    const modal = document.getElementById('modalHistoriaLimpieza');
    const form = document.getElementById('formHistoriaLimpieza');
    if (!modal || !form) return;
    form.reset();

    const d = _historiaLimpiezaData;
    if (d) {
        const diag = d.diagnostico || {};
        const ant = d.antecedentes || {};
        const pat = diag.patologias || {};

        const setVal = (sel, val) => {
            const el = form.querySelector(`[name="${sel}"]`);
            if (!el) return;
            if (el.type === 'checkbox') el.checked = !!val;
            else if (val) el.value = val;
        };

        setVal('lim_biotipo', diag.biotipo);
        setVal('lim_fototipo', diag.fototipo);
        setVal('lim_observaciones', diag.observaciones);

        // Antecedentes
        setVal('lim_diabetes', ant.diabetes);
        setVal('lim_hipertension', ant.hipertension);
        setVal('lim_alergias', ant.alergias);
        setVal('lim_ovarios', ant.ovarios_poliquisticos);
        setVal('lim_hormonas', ant.hormonas);
        setVal('lim_anticonceptivos', ant.anticonceptivos);
        setVal('lim_biopolimeros', ant.biopolimeros);
        setVal('lim_implantes', ant.implantes);
        setVal('lim_botox', ant.botox);
        setVal('lim_hialuronico', ant.hialuronico);

        // Patologías
        setVal('lim_pat_acne', pat.acne);
        setVal('lim_pat_melasma', pat.melasma);
        setVal('lim_pat_rosacea', pat.rosacea);
        setVal('lim_pat_cicatrices', pat.cicatrices);
    }

    modal.classList.add('active');
};

// ── Save form: Limpieza ───────────────────────────────────────────────────

const formLim = document.getElementById('formHistoriaLimpieza');
if (formLim) {
    formLim.addEventListener('submit', async function (e) {
        e.preventDefault();
        if (!_currentPacienteId) return;

        const fd = new FormData(formLim);
        const getBool = name => fd.has(name);

        const payload = {
            diagnostico: {
                biotipo: fd.get('lim_biotipo') || null,
                fototipo: fd.get('lim_fototipo') || null,
                observaciones: fd.get('lim_observaciones') || null,
                patologias: {
                    acne: getBool('lim_pat_acne'),
                    melasma: getBool('lim_pat_melasma'),
                    rosacea: getBool('lim_pat_rosacea'),
                    cicatrices: getBool('lim_pat_cicatrices'),
                }
            },
            antecedentes: {
                diabetes: getBool('lim_diabetes'),
                hipertension: getBool('lim_hipertension'),
                alergias: getBool('lim_alergias'),
                ovarios_poliquisticos: getBool('lim_ovarios'),
                hormonas: getBool('lim_hormonas'),
                anticonceptivos: getBool('lim_anticonceptivos'),
                biopolimeros: getBool('lim_biopolimeros'),
                implantes: getBool('lim_implantes'),
                botox: getBool('lim_botox'),
                hialuronico: getBool('lim_hialuronico'),
            }
        };

        try {
            const res = await fetch(`${API_URL}/pacientes/${_currentPacienteId}/historia-limpieza`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || 'Error guardando');
            }
            const saved = await res.json();
            dpToast('✅ Historia Facial guardada', 'success');
            document.getElementById('modalHistoriaLimpieza').classList.remove('active');
            _historiaLimpiezaData = saved.historia_clinica;
            _renderLimpiezaSection(saved.historia_clinica);
        } catch (err) {
            dpToast('Error: ' + err.message, 'error');
        }
    });
}

