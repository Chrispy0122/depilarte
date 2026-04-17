document.addEventListener('DOMContentLoaded', () => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const welcomeMsg = document.getElementById('welcomeMsg');
    const appointmentList = document.getElementById('appointmentList');
    const btnLogout = document.getElementById('btnLogout');

    if (welcomeMsg && user.nombre_completo) {
        welcomeMsg.textContent = `¡Hola, ${user.nombre_completo.split(' ')[0]}!`;
    }

    // Set current date
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('currentDate').textContent = new Date().toLocaleDateString('es-ES', options);

    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            localStorage.clear();
            window.location.href = '/';
        });
    }

    fetchAppointments();

    async function fetchAppointments() {
        try {
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const day = String(today.getDate()).padStart(2, '0');
            const fechaLocal = `${year}-${month}-${day}`;
            
            console.log(`CABINA: Solicitando citas para la fecha local: ${fechaLocal}`);
            
            const response = await fetch(`/api/agenda/mis-citas-hoy?fecha=${fechaLocal}`);
            
            if (!response.ok) {
                const errorData = await response.text();
                throw new Error(`Error ${response.status}: ${errorData || 'Ocurrió un error al obtener citas'}`);
            }
            
            const citas = await response.json();
            renderAppointments(citas);
        } catch (err) {
            console.error("CABINA ERROR FETCH:", err);
            appointmentList.innerHTML = `
                <div class="empty-state">
                    <i class="fa-solid fa-circle-exclamation"></i>
                    <p>Error al cargar las citas del día.</p>
                    <small style="color:var(--text-muted); font-size:0.7rem;">${err.message}</small>
                </div>
            `;
        }
    }

    function renderAppointments(citas) {
        if (!citas || citas.length === 0) {
            appointmentList.innerHTML = `
                <div class="empty-state">
                    <i class="fa-regular fa-calendar-check"></i>
                    <p>No tienes citas programadas para hoy.</p>
                </div>
            `;
            return;
        }

        appointmentList.innerHTML = '';
        citas.sort((a, b) => new Date(a.fecha_hora_inicio) - new Date(b.fecha_hora_inicio));

        citas.forEach(cita => {
            const date = new Date(cita.fecha_hora_inicio);
            const time = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: true });
            
            const card = document.createElement('div');
            card.className = 'appointment-card';
            
            const serviciosStr = cita.servicios && cita.servicios.length > 0 
                ? cita.servicios.map(s => s.nombre).join(', ') 
                : 'Tratamiento no especificado';

            card.innerHTML = `
                <div class="status-indicator ${cita.estado}"></div>
                <div class="time-box">
                    <span class="time">${time}</span>
                    <span class="label">Hora</span>
                </div>
                <div class="info-box">
                    <div class="patient-name">${cita.cliente ? cita.cliente.nombre_completo : 'Paciente Desconocido'}</div>
                    <div class="treatment-name">
                        <i class="fa-solid fa-hand-sparkles"></i> ${serviciosStr}
                    </div>
                </div>
                <div class="action-icon">
                    <i class="fa-solid fa-chevron-right" style="color:#EEE;"></i>
                </div>
            `;

            card.addEventListener('click', () => {
                if (cita.cliente) {
                    abrirHistoriaPaciente(cita.cliente.id);
                }
            });

            appointmentList.appendChild(card);
        });
    }

    // --- STATE ---
    let _currentPacienteId = null;
    let _histExiste = false;

    // --- MODAL LOGIC ---
    const profileModal = document.getElementById('profileModal');
    const closeModal = document.getElementById('closeModal');
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    if (closeModal) {
        closeModal.addEventListener('click', () => {
            profileModal.classList.remove('active');
        });
    }

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.tab).classList.add('active');
        });
    });

    async function abrirHistoriaPaciente(pacienteId) {
        _currentPacienteId = pacienteId;
        profileModal.classList.add('active');
        tabBtns[0].click(); // Reset to General tab

        // Clear form
        document.getElementById('formHistoriaClinica').reset();

        try {
            // 1. Datos Generales y Visitas
            const response = await fetch(`/api/pacientes/${pacienteId}`);
            if (!response.ok) throw new Error("Error cargando ficha");
            const p = await response.json();

            document.getElementById('modalPatientName').textContent = p.nombre_completo || 'Paciente';
            document.getElementById('val-cedula').textContent = p.cedula || '-';
            document.getElementById('val-telefono').textContent = p.telefono || '-';
            
            const dob = p.historia_clinica?.personal?.fecha_nacimiento;
            document.getElementById('val-edad').textContent = dob ? calculateAge(dob) + ' años' : '-';
            document.getElementById('val-profesion').textContent = p.historia_clinica?.personal?.profesion || '-';

            const tbody = document.getElementById('val-historial-body');
            tbody.innerHTML = '';
            if (p.historial_citas && p.historial_citas.length > 0) {
                p.historial_citas.forEach(h => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `<td>${new Date(h.fecha).toLocaleDateString()}</td><td>${h.motivo || 'Servicio'}</td>`;
                    tbody.appendChild(tr);
                });
            } else {
                tbody.innerHTML = '<tr><td colspan="2" style="text-align:center;">Sin visitas previas</td></tr>';
            }

            // 2. Cargar Historia Clínica Unificada
            const token = localStorage.getItem('token');
            const histRes = await fetch(`/api/pacientes/${pacienteId}/historia-clinica`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const histForm = document.getElementById('formHistoriaClinica');
            
            if (histRes.ok) {
                _histExiste = true;
                const d = await histRes.json();
                
                // Pre-fill logic based on all inputs
                const inputs = histForm.querySelectorAll('input, select, textarea');
                inputs.forEach(el => {
                    const name = el.name;
                    if (!name) return;
                    if (el.type === 'checkbox') {
                        el.checked = !!d[name];
                    } else {
                        el.value = d[name] || '';
                    }
                });
            } else {
                _histExiste = false;
            }

        } catch (err) {
            console.error(err);
            alert("Error al cargar los detalles del paciente.");
        }
    }

    // --- RENDERIZADO CONDICIONAL ---
    function renderizarFormularioCabina() {
        const tipoNegocio = localStorage.getItem('tipo_negocio');
        const formLaser = document.getElementById('form-laser');
        const formBelleza = document.getElementById('form-belleza');

        if (formLaser && formBelleza) {
            formLaser.style.display = 'none';
            formBelleza.style.display = 'none';

            if (tipoNegocio === 'laser' || !tipoNegocio) { // Default a laser
                formLaser.style.display = 'block';
            } else if (tipoNegocio === 'belleza') {
                formBelleza.style.display = 'block';
            }
        }
    }
    renderizarFormularioCabina();

    // --- FORM SUBMIT UNIFICADO ---
    document.getElementById('formHistoriaClinica').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const tipoNegocio = localStorage.getItem('tipo_negocio');
        
        let payload = {};
        
        const getCheck = k => !!form.querySelector(`[name="${k}"]`)?.checked;
        const getVal = k => form.querySelector(`[name="${k}"]`)?.value || null;

        // Universales
        payload.fuma = getCheck('fuma');
        payload.alcohol = getCheck('alcohol');
        payload.alergias = getCheck('alergias');
        payload.diabetes = getCheck('diabetes');
        payload.hipertension = getCheck('hipertension');
        payload.observaciones = getVal('observaciones');

        // Condicionales
        if (tipoNegocio === 'laser' || !tipoNegocio) {
            payload.fototipo = getVal('fototipo');
            payload.tipo_piel_laser = getVal('tipo_piel_laser');
            payload.bronceado = getCheck('bronceado');
            payload.fotosensibilidad = getCheck('fotosensibilidad');
            payload.medicamentos_fotosensibles = getCheck('medicamentos_fotosensibles');
        } else if (tipoNegocio === 'belleza') {
            payload.tipo_cabello = getVal('tipo_cabello');
            payload.estado_unas = getVal('estado_unas');
            payload.tintes_previos = getCheck('tintes_previos');
            payload.keratina = getCheck('keratina');
            payload.alergia_quimicos = getCheck('alergia_quimicos');
        }

        const method = _histExiste ? 'PUT' : 'POST';
        const token = localStorage.getItem('token');
        
        try {
            const res = await fetch(`/api/pacientes/${_currentPacienteId}/historia-clinica`, {
                method, 
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error("Error al guardar la historia clínica");
            alert("✅ Historia Clínica Guardada");
            _histExiste = true;
        } catch (err) { alert(err.message); }
    });

    function calculateAge(dob) {
        const birthDate = new Date(dob);
        const difference = Date.now() - birthDate.getTime();
        const ageDate = new Date(difference);
        return Math.abs(ageDate.getUTCFullYear() - 1970);
    }
});
