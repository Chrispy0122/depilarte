const API_URL = '/api/staff';

// --- STATE ---
let allStaff = [];

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    fetchStaff();

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

// --- FETCH STAFF ---
async function fetchStaff() {
    const loader = document.getElementById('loadingStaff');
    const grid = document.getElementById('staffGrid');

    try {
        loader.style.display = 'block';
        grid.innerHTML = '';

        const res = await fetch(`${API_URL}/`);
        if (res.ok) {
            allStaff = await res.json();
            renderStaff(allStaff);
        } else {
            grid.innerHTML = '<p class="error-msg">Error cargando el personal.</p>';
        }
    } catch (e) {
        console.error("Error fetching staff:", e);
        grid.innerHTML = '<p class="error-msg">Error de conexión al cargar el personal.</p>';
    } finally {
        loader.style.display = 'none';
    }
}

// --- RENDER STAFF ---
function renderStaff(staffArray) {
    const grid = document.getElementById('staffGrid');
    grid.innerHTML = '';

    if (staffArray.length === 0) {
        grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #64748b; padding: 40px;">No hay empleados registrados.</div>';
        return;
    }

    staffArray.forEach(emp => {
        const card = document.createElement('div');
        card.className = 'staff-card';

        // Get initials
        const nameParts = (emp.nombre_completo || 'S N').split(' ');
        const initials = nameParts[0].charAt(0) + (nameParts.length > 1 ? nameParts[1].charAt(0) : '');
        
        const safeRole = emp.rol || 'N/A';
        const roleClass = `role-${safeRole}`;

        let roleLabel = safeRole;
        if(safeRole === 'ambos') roleLabel = 'Especialista & Recepción';

        card.innerHTML = `
            <div class="staff-avatar">${initials.toUpperCase()}</div>
            <div class="staff-info">
                <h4 class="staff-name">${emp.nombre_completo}</h4>
                <span class="staff-role ${roleClass}">${roleLabel}</span>
                <div class="staff-status">
                    <i class="fa-solid fa-circle-check"></i> Activo
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

// --- MODALS ---
const staffModal = document.getElementById('staffModal');

function openStaffModal() {
    document.getElementById('staffForm').reset();
    staffModal.style.display = 'flex';
}

function closeStaffModal() {
    staffModal.style.display = 'none';
}

async function saveStaff() {
    const nameInput = document.getElementById('staffName').value.trim();
    const roleInput = document.getElementById('staffRole').value;

    if (!nameInput || !roleInput) {
        if(typeof dpToast !== 'undefined') dpToast("Por favor complete todos los campos requeridos.", 'warning');
        else alert("Por favor complete todos los campos requeridos.");
        return;
    }

    const payload = {
        nombre_completo: nameInput,
        rol: roleInput,
        activo: 1
    };

    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': token ? `Bearer ${token}` : ''
            },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            closeStaffModal();
            fetchStaff();
            if(typeof dpToast !== 'undefined') dpToast("Empleado guardado correctamente", 'success');
            else alert("Empleado guardado correctamente");
        } else {
            console.error("Error response", await res.text());
            if(typeof dpToast !== 'undefined') dpToast("Error guardando empleado", 'error');
            else alert("Error guardando empleado");
        }
    } catch (e) {
        console.error(e);
        if(typeof dpToast !== 'undefined') dpToast("Error de conexión", 'error');
        else alert("Error de conexión");
    }
}
