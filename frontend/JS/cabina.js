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
    let _limpExiste = false;
    let _depExiste = false;

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

        // Clear forms
        document.getElementById('formHistoriaLimpieza').reset();
        document.getElementById('formHistoriaDepilacion').reset();

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

            // 2. Limpieza Facial (Load and Pre-fill)
            const limpRes = await fetch(`/api/pacientes/${pacienteId}/historia-limpieza`);
            const limpForm = document.getElementById('formHistoriaLimpieza');
            if (limpRes.ok) {
                _limpExiste = true;
                const d = await limpRes.json();
                
                // Checkboxes
                const keys = ['fuma', 'alcohol', 'comida_chatarra', 'diabetes', 'hipertension', 'alergias', 'ovarios_poliquisticos', 'hormonas', 'anticonceptivos', 'biopolimeros', 'implantes', 'botox', 'acido_hialuronico', 'pat_acne', 'pat_melasma', 'pat_rosacea', 'pat_cicatrices'];
                keys.forEach(k => {
                    const el = limpForm.querySelector(`[name="limp-${k}"]`);
                    if (el) el.checked = !!d[k];
                });
                // Selects & Text
                const texts = ['biotipo_cutaneo', 'fototipo', 'agua_diaria', 'horas_sueno', 'actividad_fisica', 'observaciones'];
                texts.forEach(k => {
                    const el = limpForm.querySelector(`[name="limp-${k}"]`);
                    if (el) el.value = d[k] || '';
                });
            } else {
                _limpExiste = false;
            }

            // 3. Depilación (Load and Pre-fill)
            const depRes = await fetch(`/api/pacientes/${pacienteId}/historia-depilacion`);
            const depForm = document.getElementById('formHistoriaDepilacion');
            if (depRes.ok) {
                _depExiste = true;
                const d = await depRes.json();
                
                // Checkboxes
                const keys = ['epilepsia', 'ovario_poliquistico', 'asma', 'gastricos', 'hipertension', 'hepaticos', 'alergias', 'hirsutismo', 'respiratorios', 'diabetes', 'artritis', 'cancer', 'bronceado', 'acne', 'fuma', 'alcohol', 'biopolimeros', 'botox', 'plasma', 'tatuajes'];
                keys.forEach(k => {
                    const el = depForm.querySelector(`[name="${k}"]`);
                    if (el) el.checked = !!d[k];
                });
                // Selects & Text
                const texts = ['tipo_piel', 'aspecto_piel', 'medicamentos_ultimo_mes', 'metodo_anticonceptivo', 'metodo_depilacion_utilizado', 'otros'];
                texts.forEach(k => {
                    const el = depForm.querySelector(`[name="${k}"]`);
                    if (el) el.value = d[k] || '';
                });
            } else {
                _depExiste = false;
            }

        } catch (err) {
            console.error(err);
            alert("Error al cargar los detalles del paciente.");
        }
    }

    // --- FORM SUBMITS ---
    document.getElementById('formHistoriaLimpieza').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const getCheck = k => !!form.querySelector(`[name="limp-${k}"]`)?.checked;
        const getVal = k => form.querySelector(`[name="limp-${k}"]`)?.value || null;

        const payload = {
            fuma: getCheck('fuma'), alcohol: getCheck('alcohol'), comida_chatarra: getCheck('comida_chatarra'),
            agua_diaria: getVal('agua_diaria'), horas_sueno: getVal('horas_sueno'), actividad_fisica: getVal('actividad_fisica'),
            diabetes: getCheck('diabetes'), hipertension: getCheck('hipertension'), alergias: getCheck('alergias'),
            ovarios_poliquisticos: getCheck('ovarios_poliquisticos'), hormonas: getCheck('hormonas'), anticonceptivos: getCheck('anticonceptivos'),
            biopolimeros: getCheck('biopolimeros'), implantes: getCheck('implantes'), botox: getCheck('botox'), acido_hialuronico: getCheck('acido_hialuronico'),
            biotipo_cutaneo: getVal('biotipo_cutaneo'), fototipo: getVal('fototipo'),
            pat_acne: getCheck('pat_acne'), pat_melasma: getCheck('pat_melasma'), pat_rosacea: getCheck('pat_rosacea'), pat_cicatrices: getCheck('pat_cicatrices'),
            observaciones: getVal('observaciones')
        };

        const method = _limpExiste ? 'PUT' : 'POST';
        try {
            const res = await fetch(`/api/pacientes/${_currentPacienteId}/historia-limpieza`, {
                method, headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error("Error al guardar");
            alert("✅ Historia Facial Guardada");
            _limpExiste = true;
        } catch (err) { alert(err.message); }
    });

    document.getElementById('formHistoriaDepilacion').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const getCheck = k => !!form.querySelector(`[name="${k}"]`)?.checked;
        const getVal = k => form.querySelector(`[name="${k}"]`)?.value || null;

        const payload = {
            epilepsia: getCheck('epilepsia'), ovario_poliquistico: getCheck('ovario_poliquistico'), asma: getCheck('asma'),
            gastricos: getCheck('gastricos'), hipertension: getCheck('hipertension'), hepaticos: getCheck('hepaticos'),
            alergias: getCheck('alergias'), hirsutismo: getCheck('hirsutismo'), respiratorios: getCheck('respiratorios'),
            diabetes: getCheck('diabetes'), artritis: getCheck('artritis'), cancer: getCheck('cancer'),
            tipo_piel: getVal('tipo_piel'), aspecto_piel: getVal('aspecto_piel'),
            bronceado: getCheck('bronceado'), acne: getCheck('acne'), fuma: getCheck('fuma'), alcohol: getCheck('alcohol'),
            biopolimeros: getCheck('biopolimeros'), botox: getCheck('botox'), plasma: getCheck('plasma'), tatuajes: getCheck('tatuajes'),
            medicamentos_ultimo_mes: getVal('medicamentos_ultimo_mes'), metodo_anticonceptivo: getVal('metodo_anticonceptivo'),
            metodo_depilacion_utilizado: getVal('metodo_depilacion_utilizado'), otros: getVal('otros')
        };

        const method = _depExiste ? 'PUT' : 'POST';
        try {
            const res = await fetch(`/api/pacientes/${_currentPacienteId}/historia-depilacion`, {
                method, headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error("Error al guardar");
            alert("✅ Historia Cuerpo Guardada");
            _depExiste = true;
        } catch (err) { alert(err.message); }
    });

    function calculateAge(dob) {
        const birthDate = new Date(dob);
        const difference = Date.now() - birthDate.getTime();
        const ageDate = new Date(difference);
        return Math.abs(ageDate.getUTCFullYear() - 1970);
    }
});
