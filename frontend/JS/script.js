/* --- CHART.JS CONFIGURATION --- */
const API_URL = "/api";

document.addEventListener('DOMContentLoaded', () => {
    // 1. STATE
    let currentOffset = 0;
    let confirmedChart = null;
    let pendingChart = null;

    // 2. DOM ELEMENTS
    const listContainer = document.getElementById('patientList');
    const labelWeek = document.getElementById('currentWeekLabel');
    const btnPrev = document.getElementById('btnPrevWeek');
    const btnNext = document.getElementById('btnNextWeek');

    // 3. INITIALIZE CHARTS
    function initCharts() {
        const ctxConfirmed = document.getElementById('confirmedChart').getContext('2d');
        confirmedChart = new Chart(ctxConfirmed, {
            type: 'doughnut',
            data: {
                labels: ['Confirmadas', 'Restantes'],
                datasets: [{
                    data: [0, 1],
                    backgroundColor: ['#4ade80', 'rgba(255, 255, 255, 0.3)'], // Light green / white translucent
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: { legend: { display: false }, tooltip: { enabled: true } }
            }
        });

        const ctxPending = document.getElementById('pendingChart').getContext('2d');
        pendingChart = new Chart(ctxPending, {
            type: 'doughnut',
            data: {
                labels: ['Por Agendar', 'Agendados'],
                datasets: [{
                    data: [0, 1],
                    backgroundColor: ['#38bdf8', 'rgba(255, 255, 255, 0.3)'], // Light blue / white translucent
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: { legend: { display: false }, tooltip: { enabled: true } }
            }
        });
    }

    initCharts();

    // FORCE STYLES - keep green card bg; confirmed card uses CSS variable
    function forceCardStyles() {
        const card2 = document.getElementById('card-por-agendar');
        if (card2) card2.style.backgroundColor = '#bbf7d0'; // Green
    }
    forceCardStyles();

    function updateHeaderDate() {
        const dateEl = document.getElementById('currentDate');
        if (!dateEl) return;

        const now = new Date();
        // Format: "Lunes, 2 de Febrero"
        const options = { weekday: 'long', day: 'numeric', month: 'long' };
        const dateStr = now.toLocaleDateString('es-ES', options);
        // Capitalize first letter
        const dateFormatted = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);

        dateEl.textContent = `Resumen de Hoy, ${dateFormatted}`;
    }
    updateHeaderDate();

    // 3.2 TENANT INJECTION
    function injectTenantName() {
        const nombreNegocio = localStorage.getItem('nombre_negocio');
        if (nombreNegocio) {
            const headerContainer = document.querySelector('.header-left') || document.querySelector('.header');
            if (headerContainer) {
                // Find or create badge
                let badge = document.getElementById('tenant-name-display');
                if (!badge) {
                    badge = document.createElement('span');
                    badge.id = 'tenant-name-display';
                    badge.style.marginLeft = '12px';
                    badge.style.padding = '4px 8px';
                    badge.style.fontSize = '0.5em';
                    badge.style.backgroundColor = '#E1EFFE';
                    badge.style.color = '#1E40AF';
                    badge.style.borderRadius = '12px';
                    badge.style.fontWeight = 'bold';
                    badge.style.verticalAlign = 'middle';
                    badge.style.textTransform = 'uppercase';
                    badge.style.border = '1px solid #BFDBFE';
                    
                    const h1 = headerContainer.querySelector('h1');
                    if (h1) {
                        h1.appendChild(badge);
                    }
                }
                badge.innerHTML = `<i class="fa-solid fa-building" style="margin-right:4px;"></i>${nombreNegocio}`;
            }
        }
    }
    injectTenantName();

    // 4. FETCH DASHBOARD (SINGLE SOURCE OF TRUTH)
    async function fetchDashboardData() {
        try {
            // Update Label Loading
            if (labelWeek) labelWeek.textContent = "Cargando...";

            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/dashboard/resumen?offset_semanas=${currentOffset}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (!response.ok) throw new Error('Error fetching Dashboard');
            const data = await response.json();

            // A. UPDATE KPIS & CHARTS
            updateKPIs(data.kpis);

            // B. UPDATE LIST (RETENTION TABLE)
            renderRetentionTable(data.citas_semana, data.semana_inicio);

            // C. UPDATE WEEK LABEL
            updateWeekLabel(data.semana_inicio, data.semana_fin);

        } catch (error) {
            console.error("Dashboard Error:", error);
            if (listContainer) listContainer.innerHTML = '<div style="padding:20px; text-align:center; color:red">Error cargando datos. <br/><small>' + error.message + '</small></div>';
        }
    }

    function updateKPIs(kpis) {
        // DOM Elements
        const confirmedEl = document.querySelector('.card.chart-card:nth-child(1) .stat-value');
        const pendingEl = document.querySelector('.card.chart-card:nth-child(2) .stat-value');

        if (confirmedEl) confirmedEl.textContent = kpis.confirmadas;
        if (pendingEl) pendingEl.textContent = kpis.por_agendar; // Show "Actions Needed"

        // Charts
        const total = kpis.total_citas;
        const confirmed = kpis.confirmadas;
        const porAgendar = kpis.por_agendar; // Use specific "To Call" metric

        if (confirmedChart) {
            confirmedChart.data.datasets[0].data = [confirmed, Math.max(0, total - confirmed)];
            confirmedChart.update();
        }

        // Chart 2: "Por Agendar" vs Rest (Agendadas + Confirmadas)
        if (pendingChart) {
            // We want the red slice to be those who have NO appointment.
            // Gray slice = everyone else (processed)
            pendingChart.data.datasets[0].data = [porAgendar, Math.max(0, total - porAgendar)];
            pendingChart.update();
        }
        // Show ratio of "To Call" vs "Others"
        // The 'pending' variable is not defined in this scope. Assuming it should be 'porAgendar' or a similar KPI.
        // For now, commenting out or correcting based on context.
        // If 'pending' refers to kpis.por_agendar, then the line below is redundant with the one above.
        // If it refers to a different KPI, it needs to be defined.
        // As per the instruction, just adding the brace. The line below will cause an error.
        // pendingChart.data.datasets[0].data = [pending, Math.max(0, total - pending)];
        // pendingChart.update();
    }

    function renderRetentionTable(clients, weekStartStr) {
        if (!listContainer) return;
        listContainer.innerHTML = '';

        if (!clients || clients.length === 0) {
            listContainer.innerHTML = `<div style="padding:20px; text-align:center; color:#888">No hay clientes para retorno esta semana.</div>`;
            return;
        }

        // BUILD TABLE
        // Using inline styles for simplicity given we can't edit CSS easily right now
        const table = document.createElement('table');
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';
        table.style.marginTop = '10px';

        // THEAD
        const thead = document.createElement('thead');
        thead.innerHTML = `
            <tr style="text-align:left; color:#000000; font-size:0.85rem; border-bottom: 2px solid #F3F4F6;">
                <th style="padding:12px;">Fecha Estimada</th>
                <th style="padding:12px;">Paciente</th>
                <th style="padding:12px;">Teléfono</th>
                <th style="padding:12px; text-align:center;">Acción / Estado</th>
            </tr>
        `;
        table.appendChild(thead);

        // TBODY
        const tbody = document.createElement('tbody');

        clients.forEach(client => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid #F9FAFB';

            // 1. Fecha Estimada (Format: Lunes, 12 Ene)
            const dateObj = new Date(client.fecha_hora_inicio); // Using this field as it holds the 'Display Date'
            const dateStr = dateObj.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' });
            // Capitalize first letter
            let dateFormatted = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);

            // BACKLOG DETECTION
            if (weekStartStr) {
                const weekStart = new Date(weekStartStr);
                // Comparison: dateObj (Client Date) vs weekStart (Monday 00:00)
                if (dateObj < weekStart) {
                    dateFormatted = `
                        <div style="color:#d97706; font-weight:bold; display:flex; align-items:center; gap:4px;">
                            <i class="fa-solid fa-triangle-exclamation"></i>
                            ${dateFormatted}
                        </div>
                        <div style="color:#d97706; font-size:0.75rem; margin-top:2px;">
                            (Atrasado)
                        </div>
                    `;
                }
            }

            // 2. Action Logic
            let actionHtml = '';

            if (client.estado_accion === 'Por Agendar') {
                // BUTTON URGENT
                actionHtml = `
                    <button class="btn-agendar" 
                            style="background-color: #EF4444; color: white; border: none; padding: 6px 12px; 
                                   border-radius: 6px; cursor: pointer; font-size: 0.85rem; font-weight: 500;
                                   box-shadow: 0 2px 4px rgba(239, 68, 68, 0.2); transition: all 0.2s;"
                            data-id="${client.cliente_id}"
                            data-name="${client.cliente_nombre}">
                        <i class="fa-regular fa-calendar-plus" style="margin-right:4px;"></i> Agendar
                    </button>
                `;
            } else if (client.estado_accion === 'Confirmado') {
                // BADGE GREEN
                actionHtml = `
                    <span style="display:inline-block; padding: 4px 10px; background-color: #DEF7EC; color: #000000; 
                                 border-radius: 20px; font-size: 0.8rem; font-weight: 600;">
                        Confirmado
                    </span>
                `;
            } else if (client.estado_accion === 'Agendado') {
                // BADGE YELLOW
                actionHtml = `
                    <span style="display:inline-block; padding: 4px 10px; background-color: #FEF3C7; color: #000000; 
                                 border-radius: 20px; font-size: 0.8rem; font-weight: 600;">
                        Agendado
                    </span>
                `;
            } else if (client.estado_accion === 'Atendido') {
                // BADGE GRAY/BLUE
                actionHtml = `
                    <span style="display:inline-block; padding: 4px 10px; background-color: #E1EFFE; color: #000000; 
                                 border-radius: 20px; font-size: 0.8rem; font-weight: 600;">
                        Atendido
                    </span>
                `;
            }

            function obtenerBaseWhatsapp(telefono) {
                if (!telefono) return '';
                let num = telefono.replace(/\D/g, ''); // Eliminar no-dígitos
                if (num.startsWith('0')) {
                    num = '58' + num.substring(1);
                } else if (!num.startsWith('58')) {
                    if (num.length === 10 && num.startsWith('4')) {
                        num = '58' + num;
                    }
                }
                return num;
            }

            /* ... inside renderRetentionTable loop ... */

            const waNum = obtenerBaseWhatsapp(client.telefono);

            tr.innerHTML = `
                <td data-label="Fecha" style="padding:12px; color:#000000; font-weight:500;"><div>${dateFormatted}</div></td>
                <td data-label="Paciente" style="padding:12px;">
                    <div style="display:flex; align-items:center; gap:10px;">
                         <div style="display:flex; flex-direction:column;">
                             <span style="font-weight:600; color:#000000;">${client.cliente_nombre}</span>
                             <span style="font-size:0.75rem; color:#000000;">ID: ${client.cliente_id}</span>
                         </div>
                    </div>
                </td>
                <td data-label="Teléfono" style="padding:12px; color:#000000;">
                    <div style="display:flex; flex-direction:column; gap:4px;">
                        <a href="tel:${client.telefono || ''}" style="text-decoration:none; color:#000000; display:flex; align-items:center; gap:6px;">
                            <i class="fa-solid fa-phone" style="font-size:0.8rem; color:#000000;"></i>
                            ${client.telefono || 'Sin Tlf'}
                        </a>
                        ${waNum ? `
                        <div style="display: flex; gap: 5px; margin-top: 5px; flex-wrap: wrap;">
                            <a href="https://wa.me/${waNum}" target="_blank" class="btn-whatsapp" 
                               style="background-color: #25D366; color: white; padding: 4px 8px; border-radius: 6px; 
                                      font-size: 0.75rem; text-decoration: none; display: inline-flex; align-items: center; gap: 4px; width: fit-content;">
                                <i class="fab fa-whatsapp"></i> Chat
                            </a>
                            <a href="https://wa.me/${waNum}?text=${encodeURIComponent('¡Hola! Nos comunicamos de *Depilarte*. Queríamos recordarte que es tiempo de tu próxima sesión para continuar con tus excelentes resultados. ¿Deseas agendar?')}" target="_blank" class="btn-whatsapp" 
                               style="background-color: #128C7E; color: white; padding: 4px 8px; border-radius: 6px; 
                                      font-size: 0.75rem; text-decoration: none; display: inline-flex; align-items: center; gap: 4px; width: fit-content; box-shadow: 0 2px 4px rgba(18, 140, 126, 0.2);">
                                <i class="fa-solid fa-paper-plane"></i> Recordatorio
                            </a>
                        </div>` : ''}
                    </div>
                </td>
                <td data-label="Acción" style="padding:12px; text-align:center;">
                    <div>${actionHtml}</div>
                </td>
            `;

            tbody.appendChild(tr);
        });

        table.appendChild(tbody);
        listContainer.appendChild(table);

        // ATTACH EVENTS TO DYNAMIC BUTTONS
        const buttons = listContainer.querySelectorAll('.btn-agendar');
        buttons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = btn.dataset.id;
                const name = btn.dataset.name;
                handleAgendarClick(id, name);
            });
            // Hose effect
            btn.addEventListener('mouseenter', () => btn.style.transform = 'translateY(-1px)');
            btn.addEventListener('mouseleave', () => btn.style.transform = 'translateY(0)');
        });
    }

    function handleAgendarClick(clientId, clientName) {
        // Redirect to Agenda
        // Optional: We can pass query params to pre-select user if Agenda supports it
        // Or store in localStorage
        localStorage.setItem('preselect_client_id', clientId);
        localStorage.setItem('preselect_client_name', clientName);

        window.location.href = 'agenda.html';
    }

    function updateWeekLabel(startStr, endStr) {
        if (!labelWeek) return;

        if (currentOffset === 0) {
            labelWeek.textContent = "Semana Actual (Retención)";
            return;
        }

        const s = new Date(startStr);
        const e = new Date(endStr);

        const fmt = { month: 'short', day: 'numeric' };
        labelWeek.textContent = `${s.toLocaleDateString('es-ES', fmt)} - ${e.toLocaleDateString('es-ES', fmt)}`;
    }

    // 5. EVENT LISTENERS
    if (btnPrev && btnNext) {
        btnPrev.addEventListener('click', () => {
            currentOffset--;
            fetchDashboardData();
        });

        btnNext.addEventListener('click', () => {
            currentOffset++;
            fetchDashboardData();
        });
    }

    // Initial Load
    fetchDashboardData();

    // Mobile Sidebar
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
});
