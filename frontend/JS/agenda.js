document.addEventListener('DOMContentLoaded', () => {
    // --- CONFIG ---
    const API_URL = "/api";
    const calendarEl = document.getElementById('calendar');
    const dayHeader = document.getElementById('day-view-header');
    const pageContent = document.getElementById('wrapper'); // To toggle classes if needed

    // --- STATE ---
    let calendar;
    let selectedDate = null; // YYYY-MM-DD

    // --- INIT ---
    initCalendar();
    loadDropdowns(); // Helper to load patients/services

    function initCalendar() {
        calendar = new FullCalendar.Calendar(calendarEl, {
            // BASE CONFIG
            initialView: 'dayGridMonth',
            locale: 'es',
            firstDay: 1, // Lunes
            height: 'auto',
            contentHeight: 'auto',

            // HEADER (Month View Only - JS will toggle for Day)
            headerToolbar: {
                left: 'title',
                center: '',
                right: 'prev,next'
            },

            // VIEWS CONFIG
            views: {
                dayGridMonth: {
                    titleFormat: { year: 'numeric', month: 'long' } // "Febrero 2026"
                },
                timeGridDay: { // Missing key restored here
                    // TIME AXIS CONFIG
                    slotDuration: '00:20:00',
                    slotMinTime: '08:00:00',
                    slotMaxTime: '18:00:00',
                    allDaySlot: false,
                    expandRows: false, // DISABLED to prevent skipping slots/noon

                    // LABEL FORMATTING
                    slotLabelInterval: '00:20:00',
                    slotLabelFormat: {
                        hour: 'numeric',      // "8", "9", "10" (No leading zero)
                        minute: '2-digit',    // "00", "20", "40"
                        omitZeroMinute: false, // Force "8:00" not "8"
                        meridiem: 'short',    // "a.m." vs "p.m."
                        hour12: true          // STRICT 12-hour format
                    },

                    dayHeaderFormat: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
                    // We don't use standard title here, we use custom header
                }
            },

            // EVENTS SOURCE
            events: async (info, success, failure) => {
                try {
                    // Fetch all appointments
                    const res = await fetch(`${API_URL}/agenda/`);
                    if (!res.ok) throw new Error("API Error");
                    const data = await res.json();

                    // Filter out CANCELLED events
                    const activeEvents = data.filter(item => item.estado !== 'CANCELLED' && item.estado !== 'Cancelado');

                    const events = activeEvents.map(item => {
                        // Default: PENDING (Red)
                        let statusClass = 'evento-pendiente';

                        // If Confirmed -> Green
                        const estadoLower = (item.estado || '').toLowerCase();
                        if (estadoLower === 'confirmada' || estadoLower === 'confirmed' || item.estado === 'Confirmado' || estadoLower === 'pagada') {
                            statusClass = 'evento-confirmado';
                        }
                        // Note: Cancelled are already filtered out

                        // Build Title: Client - Service1, Service2...
                        const clientName = item.cliente ? item.cliente.nombre_completo : "Sin Cliente";
                        const serviceNames = item.servicios && item.servicios.length > 0
                            ? item.servicios.map(s => s.nombre).join(', ')
                            : "Sin Servicio";

                        return {
                            id: item.id,
                            title: `${clientName} - ${serviceNames}`,
                            start: item.fecha_hora_inicio,
                            end: item.fecha_hora_fin,
                            classNames: [statusClass],
                            // Custom Props
                            extendedProps: {
                                cliente_id: item.cliente ? item.cliente.id : null,
                                servicios_ids: item.servicios ? item.servicios.map(s => s.id) : [],
                                servicios_names: serviceNames,
                                status: item.estado
                            }
                        };
                    });
                    success(events);
                } catch (e) {
                    console.error(e);
                    failure(e);
                }
            },

            // --- INTERACTIONS ---

            // 1. Click on Day Cell (Month) -> Go to Day View
            dateClick: (info) => {
                if (calendar.view.type === 'dayGridMonth') {
                    calendar.changeView('timeGridDay', info.dateStr);
                } else {
                    // In TimeGrid, click = New Appt
                    openNewModal(info.dateStr, info.date);
                }
            },

            // 2. Click on Event -> Open ACTION Modal (Simple View)
            eventClick: (info) => {
                const event = info.event;
                openActionModal(event);
            },

            // --- VISUAL HOOKS ---

            // 3. Custom Event Rendering (The Mint Green Card)
            eventContent: (arg) => {
                if (arg.view.type === 'timeGridDay') {
                    return {
                        html: `
                        <div style="display: flex; flex-direction: column; height: 100%; justify-content: center; padding: 2px;">
                            <div style="font-weight: 700; font-size: 0.85rem; margin-bottom: 2px; line-height: 1.2;">
                                ${arg.event.title}
                            </div>
                            <div style="font-size: 0.75rem; opacity: 0.8; display: flex; align-items: center; gap: 4px;">
                                <i class="fa-regular fa-clock"></i> ${arg.timeText}
                            </div>
                        </div>
                        `
                    };
                }
            },

            // 4. View Change Hook (Toggle Custom Header)
            datesSet: (info) => {
                if (info.view.type === 'timeGridDay') {
                    // HIDE Standard Toolbar
                    document.querySelector('.fc-header-toolbar').style.display = 'none';
                    // SHOW Custom Header
                    dayHeader.classList.remove('d-none');
                    document.getElementById('calendar-container').classList.add('day-view-active');

                    // Update Title
                    const date = calendar.getDate();
                    // "Agenda - 6 Febrero"
                    const day = date.getDate();
                    const month = date.toLocaleString('es-ES', { month: 'long' });
                    // Capitalize
                    const monthCap = month.charAt(0).toUpperCase() + month.slice(1);
                    document.getElementById('day-header-title').innerText = `Agenda - ${day} ${monthCap}`;

                    // Subtitle "viernes, 6 de febrero..."
                    const fullDate = date.toLocaleString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                    document.getElementById('day-header-subtitle').innerText = fullDate;

                } else {
                    // RESET to Month View State
                    document.querySelector('.fc-header-toolbar').style.display = 'flex';
                    dayHeader.classList.add('d-none');
                    document.getElementById('calendar-container').classList.remove('day-view-active');
                }
            }
        });

        calendar.render();
    }

    // --- NAVIGATION LOGIC ---
    document.getElementById('btn-back-month').addEventListener('click', () => {
        calendar.changeView('dayGridMonth');
    });

    // --- MODAL & DATA LOADING ---
    window.openNewModal = (dateStr, dateObj, isEdit = false) => {
        const modalEl = document.getElementById('modalNew');
        const modal = new bootstrap.Modal(modalEl);

        // Reset Form
        if (!isEdit) {
            document.getElementById('formNewAppt').reset();
            $('#cliente-select').val(null).trigger('change');
            $('#servicio_id').val(null).trigger('change');
            delete modalEl.dataset.eventId;
        }

        // Populate Time Select
        const startSelect = document.getElementById('startSelect');
        startSelect.innerHTML = '';
        for (let h = 8; h < 18; h++) { // 8 to 18 (6pm)
            ["00", "20", "40"].forEach(m => {
                let val = `${h.toString().padStart(2, '0')}:${m}`;
                let opt = document.createElement('option');
                opt.value = val;
                opt.innerText = val;
                if (dateStr && dateStr.includes(val)) opt.selected = true;
                startSelect.appendChild(opt);
            });
        }

        // Store selected date for construction
        // FIX: Use LOCAL date methods to avoid UTC day-drift when user clicks near midnight.
        // FullCalendar's info.date is in UTC, so .toISOString() can give the wrong day.
        if (dateObj) {
            const y = dateObj.getFullYear();
            const m = String(dateObj.getMonth() + 1).padStart(2, '0');
            const d = String(dateObj.getDate()).padStart(2, '0');
            modalEl.dataset.selectedDate = `${y}-${m}-${d}`;
        } else if (dateStr) {
            modalEl.dataset.selectedDate = dateStr.split('T')[0];
        }

        // Hide buttons on new
        if (!isEdit) {
            document.getElementById('btnConfirmar').classList.add('d-none');
            document.getElementById('btnCancelar').classList.add('d-none');
        }

        modal.show();
    };

    // --- CUSTOM CONFIRM DIALOG ---
    // Now handled globally by dialogs.js (dpConfirm)

    // CANCEL / REAGENDAR APPOINTMENT LOGIC
    window.cancelAppointment = (id) => handleCancelAction(id); // Backward compat alias

    function handleCancelAction(citaId) {
        // Close the actions modal first
        const modalAction = bootstrap.Modal.getInstance(document.getElementById('modalActions'));
        if (modalAction) modalAction.hide();

        // Build 3-option modal
        const overlay = document.createElement('div');
        overlay.className = 'dp-confirm-overlay';
        overlay.innerHTML = `
            <div class="dp-confirm-box" style="max-width:420px;width:92%;">
                <div class="dp-confirm-bar danger"></div>
                <div class="dp-confirm-content">
                    <div class="dp-confirm-icon-wrap warning">
                        <i class="fa-solid fa-calendar-xmark"></i>
                    </div>
                    <div class="dp-confirm-title">¿Qué deseas hacer con esta cita?</div>
                    <div class="dp-confirm-msg" style="margin-bottom:16px;">Puedes eliminarla definitivamente o moverla a una nueva fecha.</div>

                    <!-- REAGENDAR PANEL (hidden) -->
                    <div id="dp-reagendar-panel" style="display:none; margin-bottom:16px; text-align:left;">
                        <label style="display:block; font-size:0.85rem; font-weight:600; color:#1e293b; margin-bottom:6px;">
                            <i class="fa-regular fa-calendar" style="color:#6366f1;"></i> Nueva fecha y hora
                        </label>
                        <input type="datetime-local" id="dp-nueva-fecha"
                            style="width:100%; padding:10px; border:1px solid #ddd; border-radius:8px; font-family:'Poppins',sans-serif; font-size:0.9rem;">
                        <button id="dp-btn-confirm-reagendar" class="dp-confirm-btn dp-btn-ok info"
                            style="width:100%; margin-top:10px; background:linear-gradient(135deg,#6366f1,#8b5cf6);">
                            <i class="fa-solid fa-check"></i> Confirmar Nueva Fecha
                        </button>
                    </div>

                    <!-- MAIN BUTTONS -->
                    <div class="dp-confirm-btns" id="dp-main-btns">
                        <button class="dp-confirm-btn dp-btn-cancel" id="dp-btn-cerrar">Cerrar</button>
                        <button class="dp-confirm-btn dp-btn-ok danger" id="dp-btn-eliminar" style="flex:1.2;">
                            <i class="fa-solid fa-trash-can"></i> Eliminar
                        </button>
                        <button class="dp-confirm-btn" id="dp-btn-reagendar"
                            style="flex:1.2; background:linear-gradient(135deg,#6366f1,#8b5cf6); color:#fff;">
                            <i class="fa-solid fa-calendar-days"></i> Reagendar
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add('dp-show')));

        function closeOverlay() {
            overlay.classList.remove('dp-show');
            overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
        }

        // Cerrar
        overlay.querySelector('#dp-btn-cerrar').addEventListener('click', closeOverlay);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) closeOverlay(); });

        // Eliminar definitivamente (flujo original)
        overlay.querySelector('#dp-btn-eliminar').addEventListener('click', async () => {
            closeOverlay();
            try {
                const res = await fetch(`${API_URL}/agenda/appointments/${citaId}/status`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ estado: 'CANCELLED' })
                });
                if (res.ok) {
                    calendar.refetchEvents();
                    dpToast('Cita eliminada de la agenda.', 'success');
                } else {
                    const err = await res.json();
                    dpToast('Error al eliminar: ' + JSON.stringify(err), 'error');
                }
            } catch (e) {
                dpToast('Error de conexión.', 'error');
            }
        });

        // Reagendar: mostrar panel de fecha
        overlay.querySelector('#dp-btn-reagendar').addEventListener('click', () => {
            overlay.querySelector('#dp-main-btns').style.display = 'none';
            const panel = overlay.querySelector('#dp-reagendar-panel');
            panel.style.display = 'block';
            // Precargar con fecha/hora actual LOCAL (evita drift UTC)
            const now = new Date();
            const yy = now.getFullYear();
            const mm = String(now.getMonth() + 1).padStart(2, '0');
            const dd = String(now.getDate()).padStart(2, '0');
            const hh = String(now.getHours()).padStart(2, '0');
            const min = String(now.getMinutes()).padStart(2, '0');
            overlay.querySelector('#dp-nueva-fecha').value = `${yy}-${mm}-${dd}T${hh}:${min}`;
        });

        // Confirmar nueva fecha
        overlay.querySelector('#dp-btn-confirm-reagendar').addEventListener('click', async () => {
            const fechaRaw = overlay.querySelector('#dp-nueva-fecha').value; // "YYYY-MM-DDTHH:MM"
            if (!fechaRaw) {
                dpToast('Selecciona una nueva fecha y hora.', 'warning');
                return;
            }
            // Enviar como datetime local sin conversión a UTC (consistente con el resto del sistema)
            const isoFecha = fechaRaw + ':00'; // "YYYY-MM-DDTHH:MM:00"
            try {
                const res = await fetch(`${API_URL}/agenda/reagendar/${citaId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fecha_hora_inicio: isoFecha })
                });
                if (res.ok) {
                    closeOverlay();
                    calendar.refetchEvents();
                    dpToast('¡Cita reagendada exitosamente!', 'success');
                } else {
                    dpToast('Error al reagendar la cita.', 'error');
                }
            } catch (e) {
                dpToast('Error de conexión.', 'error');
            }
        });
    }

    // CONFIRM APPOINTMENT LOGIC
    window.confirmAppointment = async (id) => {
        console.log("=== CONFIRMING APPOINTMENT ===", id);
        try {
            // PATCH /api/agenda/appointments/{id}/status
            const res = await fetch(`${API_URL}/agenda/appointments/${id}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ estado: 'confirmada' })
            });
            console.log("Confirm response status:", res.status);

            if (res.ok) {
                console.log("Appointment confirmed successfully!");
                calendar.refetchEvents();
                // Close modals
                const modalAction = bootstrap.Modal.getInstance(document.getElementById('modalActions'));
                if (modalAction) modalAction.hide();

                const modalNew = bootstrap.Modal.getInstance(document.getElementById('modalNew'));
                if (modalNew) modalNew.hide();
            } else {
                const err = await res.json();
                console.error("Error confirming:", err);
                dpToast("Error al confirmar: " + JSON.stringify(err), 'error');
            }
        } catch (e) {
            console.error("Exception in confirmAppointment:", e);
            dpToast("Error de conexión: " + e.message, 'error');
        }
    };

    // --- HELPER: OPEN ACTION MODAL ---
    function openActionModal(event) {
        const props = event.extendedProps;
        const modal = new bootstrap.Modal(document.getElementById('modalActions'));

        // Populate Data
        document.getElementById('actionClientName').textContent = event.title;

        // Time Formatting
        const timeStr = event.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
        document.getElementById('actionServiceTime').textContent = `${props.service} • ${timeStr}`;

        // Buttons
        const btnConfirm = document.getElementById('btnActionConfirm');
        const btnCancel = document.getElementById('btnActionCancel');

        // Bind Actions
        btnConfirm.onclick = () => confirmAppointment(event.id);
        btnCancel.onclick = () => handleCancelAction(event.id);

        // Logic: If already confirmed, maybe hide confirm? User said "confirma y cancelar".
        // If confirmed, likely we don't need to confirm again, but showing "Status: Confirmado" might be nice.
        // For now, simple logic:

        if (props.status === 'CONFIRMED' || props.status === 'Confirmado' || props.status === 'confirmada') {
            btnConfirm.classList.add('d-none'); // Hide confirm if already confirmed
            // Add a visual indicator?
            document.getElementById('actionClientName').innerHTML = `✅ ${event.title}`;
        } else {
            btnConfirm.classList.remove('d-none');
            document.getElementById('actionClientName').textContent = event.title;
        }

        modal.show();
    }

    document.getElementById('saveAppt').addEventListener('click', async () => {
        console.log("=== SAVE BUTTON CLICKED ===");

        const modalEl = document.getElementById('modalNew');
        const eventId = modalEl.dataset.eventId;
        const selectedDate = modalEl.dataset.selectedDate; // YYYY-MM-DD
        const time = $('#startSelect').val(); // HH:MM

        console.log("Selected Date:", selectedDate);
        console.log("Selected Time:", time);

        if (!selectedDate || !time) {
            dpToast("Fecha/Hora inválida", 'warning');
            console.error("Missing date or time!");
            return;
        }

        // Construct ISO: YYYY-MM-DDTHH:MM:00
        const isoStart = `${selectedDate}T${time}:00`;
        console.log("ISO Start:", isoStart);

        // Get Services List
        const selectedServices = $('#servicio_id').val() || [];
        console.log("Selected Services (raw):", selectedServices);

        const serviciosIds = selectedServices
            .map(id => parseInt(id))
            .filter(id => !isNaN(id) && id > 0);
        console.log("Servicios IDs (filtered):", serviciosIds);

        if (serviciosIds.length === 0) {
            dpToast("Seleccione al menos un tratamiento", 'warning');
            console.error("No services selected!");
            return;
        }

        const clienteId = parseInt($('#cliente-select').val());
        console.log("Cliente ID:", clienteId);

        if (!clienteId || isNaN(clienteId)) {
            dpToast("Seleccione un cliente", 'warning');
            console.error("No client selected!");
            return;
        }

        const durationVal = parseInt($('#durationSelect').val());
        const duracionTotal = durationVal * 20; // 1=20, 2=40, etc.

        const payload = {
            cliente_id: clienteId,
            servicios_ids: serviciosIds,
            fecha_hora_inicio: isoStart,
            duracion_total: duracionTotal
        };
        console.log("Payload to send:", payload);

        try {
            if (eventId) {
                // UPDATE (pendiente de implementar completamente)
                dpToast("Edición completa no implementada aún.", 'warning');
            } else {
                // CREATE (POST) - Usa el endpoint correcto que maneja la tabla
                // intermedia cita_servicios. NO usar /appointments (endpoint legacy
                // que falla con servicios_ids al inyectarlo en models.Cita directamente).
                console.log("Making POST request to:", `${API_URL}/agenda/`);
                const token = localStorage.getItem('token') || '';
                const res = await fetch(`${API_URL}/agenda/`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': token   // requerido para extraer negocio_id (TenantMixin)
                    },
                    body: JSON.stringify(payload)
                });
                console.log("Response status:", res.status);

                if (res.ok) {
                    console.log("Success! Refreshing calendar...");
                    calendar.refetchEvents();
                    bootstrap.Modal.getInstance(modalEl).hide();
                    // Reset form
                    $('#cliente-select').val('').trigger('change');
                    $('#servicio_id').val([]).trigger('change');
                    dpToast('✅ Cita agendada exitosamente.', 'success');
                } else {
                    // Parseo seguro: primero texto, luego intentar JSON
                    const rawText = await res.text();
                    let errMsg = rawText;
                    try {
                        const errJson = JSON.parse(rawText);
                        errMsg = errJson.detail || JSON.stringify(errJson);
                    } catch (_) { /* No era JSON, usar rawText */ }
                    console.error("Error response:", errMsg);
                    dpToast(`⚠️ Error al guardar: ${errMsg}`, 'error');
                }
            }

        } catch (e) {
            console.error("Exception caught:", e);
            dpToast("Error de conexión: " + e.message, 'error');
        }
    });

    // Load Dropdowns
    async function loadDropdowns() {
        try {
            // Clients -> /api/pacientes/
            const resC = await fetch(`${API_URL}/pacientes/`);
            if (resC.ok) {
                const clients = await resC.json();
                const cSelect = document.getElementById('cliente-select');
                cSelect.innerHTML = '<option value="">Seleccione...</option>';
                clients.forEach(c => {
                    const histNum = c.numero_historia ? ` | H-${c.numero_historia}` : '';
                    cSelect.innerHTML += `<option value="${c.id}">${c.nombre_completo}${histNum}</option>`;
                });
                // Update Select2
                $('#cliente-select').trigger('change');
            }

            // Services -> /api/agenda/servicios
            let resS = await fetch(`${API_URL}/agenda/servicios`);
            if (resS.ok) {
                let services = await resS.json();

                // DATA RESTORATION: If empty, try to populate
                if (services.length === 0) {
                    console.warn("No services found. Attempting to populate defaults...");
                    await fetch(`${API_URL}/agenda/debug/populate`);
                    // Retry fetch
                    resS = await fetch(`${API_URL}/agenda/servicios`);
                    if (resS.ok) services = await resS.json();
                }

                const sSelect = document.getElementById('servicio_id');
                sSelect.innerHTML = '<option value="">Seleccione...</option>';
                services.forEach(s => {
                    // Store duration in data attribute
                    sSelect.innerHTML += `<option value="${s.id}" data-duration="${s.duracion_minutos}">${s.nombre}</option>`;
                });
                // Update Select2
                $('#servicio_id').trigger('change');
            }

            // CRITICAL FIX: dropdownParent to Modal
            $('#cliente-select').select2({
                dropdownParent: $('#modalNew'),
                theme: 'bootstrap-5',
                width: '100%',
                placeholder: 'Seleccione Paciente'
            });

            $('#servicio_id').select2({
                dropdownParent: $('#modalNew'),
                theme: 'bootstrap-5',
                width: '100%',
                placeholder: 'Seleccione Tratamiento(s)',
                multiple: true,
                closeOnSelect: false
            });

            // AUTOCOMPLETE: Al cambiar el paciente, preseleccionar sus últimos tratamientos
            $('#cliente-select').on('change', async function () {
                const pacienteId = $(this).val();
                
                // Limpiar selección actual de tratamientos
                $('#servicio_id').val([]).trigger('change');

                if (!pacienteId) return;
                try {
                    const res = await fetch(`${API_URL}/agenda/ultimo-tratamiento/${pacienteId}`);
                    if (!res.ok) return;
                    const ids = await res.json();
                    
                    if (Array.isArray(ids) && ids.length > 0) {
                        $('#servicio_id').val(ids).trigger('change');
                        dpToast('✨ Tratamientos habituales auto-seleccionados', 'info');
                    }
                } catch (e) {
                    console.error("Error al obtener último tratamiento:", e);
                }
            });

            // Listener for Service Change -> Update Duration
            $('#servicio_id').on('change', function () {
                const selectedOptions = $(this).find(':selected');
                let totalMinutes = 0;

                selectedOptions.each(function () {
                    const dur = $(this).data('duration');
                    if (dur) totalMinutes += parseInt(dur);
                });

                // Default minimum 20
                if (totalMinutes === 0 && selectedOptions.length > 0) totalMinutes = 20;

                // Map to Dropdown Value (assuming 20min blocks)
                // 20->1, 40->2, 60->3...
                let val = Math.ceil(totalMinutes / 20);
                if (val < 1) val = 1;
                // Cap at max option? Let's Assume 6 (120 min) is max for now or let selects handle it
                if (val > 6) val = 6;

                $('#durationSelect').val(val);
            });
        } catch (e) { console.error(e); }
    }

    // --- MOBILE SIDEBAR LOGIC (From Layout) ---
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
