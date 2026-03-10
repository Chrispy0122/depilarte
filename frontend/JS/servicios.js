// --- CONFIGURATION ---
const API_URL = "/api";

// --- STATE MANAGEMENT ---
let currentServices = [];
let allServices = []; // Store full list for client-side filtering
let viewMode = 'grid'; // Forced to Grid by default for Mobile First
let filters = {
    search: '',
    category: 'all',
    status: 'active' // 'active', 'inactive'
};

document.addEventListener('DOMContentLoaded', () => {
    initMenu();
    initDateDisplay();
    initFilters();
    initSearch();
    initViewToggles();
    initOffcanvas();

    // Initial Load
    fetchServices();
});

// --- API INTEGRATION ---

async function fetchServices() {
    const gridBody = document.getElementById('servicesGrid');

    // Show Loading
    gridBody.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding:40px"><i class="fa-solid fa-spinner fa-spin fa-2x" style="color:var(--primary)"></i><p style="margin-top:10px; color:#777">Cargando catálogo...</p></div>';

    try {
        // Fetch ALL services (we will filter client-side for speed and simplicity as per requirements)
        // We request no active filter to get everything initially
        const response = await fetch(`${API_URL}/servicios/`);

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const data = await response.json();

        // Map API fields to consistent internal format if needed, or use directly
        // API returns: { id, codigo, nombre, sesion, paquete_4_sesiones, num_zonas, cantidad_sesiones, comision_recepcionista, comision_especialista, categoria, activo }
        allServices = data.map(item => ({
            ...item,
            // Ensure numeric types for calculations if strings came back (though API typed)
            precio_sesion: item.sesion,
            precio_paquete_4: item.paquete_4_sesiones,
            comision_recepcion: item.comision_recepcionista,
            comision_especialista: item.comision_especialista,
            // Normalize active status (API uses 1/0 int, we want boolean for easier logic)
            activo: item.activo === 1
        }));

        console.log("Services loaded:", allServices.length);
        applyFilters();

    } catch (e) {
        console.error("Fetch error:", e);
        gridBody.innerHTML = `<div style="grid-column: 1/-1; color:red; text-align:center; padding: 20px;"><i class="fa-solid fa-triangle-exclamation"></i> Error al cargar servicios: ${e.message}</div>`;
    }
}


// --- INITIALIZATION FUNCTIONS ---

function initMenu() {
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');

    // Toggle menu
    const toggleMenu = () => {
        if (sidebar) sidebar.classList.toggle('active');
        if (overlay) overlay.classList.toggle('active');
    };

    if (menuToggle) {
        menuToggle.addEventListener('click', toggleMenu);
    }
    if (overlay) {
        overlay.addEventListener('click', toggleMenu);
    }
}

function initDateDisplay() {
    const dDisplay = document.getElementById('currentDateDisplay');
    if (dDisplay) {
        const now = new Date();
        dDisplay.textContent = now.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }
}

function initFilters() {
    // Category Pills
    const categoryBtns = document.getElementById('categoryFilters').querySelectorAll('.pill');
    categoryBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // UI Update
            categoryBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // State Update
            filters.category = btn.dataset.category;
            applyFilters();
        });
    });

    // Status Tabs
    const statusBtns = document.querySelectorAll('.status-tabs .tab-btn');
    statusBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            statusBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            filters.status = btn.dataset.status;
            applyFilters();
        });
    });
}

function initSearch() {
    const searchInput = document.getElementById('searchInput');
    let timeout;

    searchInput.addEventListener('input', (e) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            filters.search = e.target.value.toLowerCase();
            applyFilters();
        }, 300); // Debounce
    });
}

function initViewToggles() {
    const listBtn = document.getElementById('viewListBtn');
    const gridBtn = document.getElementById('viewGridBtn');

    listBtn.addEventListener('click', () => setView('list'));
    gridBtn.addEventListener('click', () => setView('grid'));
}

function setView(mode) {
    viewMode = 'grid'; // Force strictly GRID for this Mobile First Premium design

    // Toggle Containers
    const gridContainer = document.getElementById('gridViewContainer');
    if (gridContainer) gridContainer.classList.remove('hidden');
}

// --- CORE LOGIC ---

function applyFilters() {
    // Filter the allServices array
    currentServices = allServices.filter(service => {
        // 1. Status Filter
        const isActive = filters.status === 'active';
        if (service.activo !== isActive) return false;

        // 2. Category Filter
        // Normalize categories (some might be capitalized in DB)
        const serviceCat = (service.categoria || '').toLowerCase();
        if (filters.category !== 'all' && serviceCat !== filters.category) return false;

        // 3. Search Filter
        if (filters.search) {
            const matchName = (service.nombre || '').toLowerCase().includes(filters.search);
            const matchCode = (service.codigo || '').toLowerCase().includes(filters.search);
            if (!matchName && !matchCode) return false;
        }

        return true;
    });

    renderCurrentView();
}

function renderCurrentView() {
    const gridBody = document.getElementById('servicesGrid');
    const emptyState = document.getElementById('emptyState');
    const gridContainer = document.getElementById('gridViewContainer');

    // Empty State Check
    if (currentServices.length === 0) {
        gridContainer.classList.add('hidden');
        emptyState.classList.remove('hidden');
        return;
    }

    // Restore View visibility (respecting current mode)
    emptyState.classList.add('hidden');
    gridContainer.classList.remove('hidden');

    // Helper: Money Formatter
    const formatMoney = (amount) => amount ? `$${Number(amount).toFixed(2)}` : '-';

    // OPTIMIZACIÓN DE RENDIMIENTO: Limitar DOM a 50 records máximos
    const limit = 50;
    const isTruncated = currentServices.length > limit;
    const renderList = isTruncated ? currentServices.slice(0, limit) : currentServices;

    // RENDER GRID (Premium Cards)
    gridBody.innerHTML = renderList.map(item => `
        <div class="service-card" onclick="openOffcanvas('${item.codigo}')">
            <div class="card-header">
                <div>
                    <div class="card-title">${item.nombre}</div>
                    <div class="code-badge" style="display:inline-block">${item.codigo}</div>
                </div>
                <!-- Action Dots / Status Menu -->
                <div class="card-actions" style="color: #A0AEC0; font-size: 1.2rem;">
                    <i class="fa-solid fa-ellipsis-vertical"></i>
                </div>
            </div>
            
            <div class="card-body">
                <div style="font-size:0.8rem; color:#6B7280; margin-bottom:10px; display: flex; align-items: center; justify-content: space-between;">
                    <span><i class="fa-solid fa-layer-group"></i> ${item.categoria || 'General'}</span>
                    <span style="background: ${item.activo ? '#D1FAE5' : '#FEE2E2'}; color: ${item.activo ? '#10B981' : '#EF4444'}; padding: 2px 8px; border-radius: 12px; font-weight: 600; font-size: 0.7rem;">
                        ${item.activo ? 'Activo' : 'Inactivo'}
                    </span>
                </div>
                
                <div class="price-row" style="margin-top: 15px; padding-top: 15px; border-top: 1px dashed #E5E7EB; display: flex; justify-content: space-between; align-items: flex-end;">
                    <div class="price-item">
                        <span class="price-label" style="font-size: 0.75rem; color: #6B7280;">Sesión</span>
                        <span class="price-main" style="font-size: 1.25rem; font-weight: 700; color: #111827;">${formatMoney(item.precio_sesion)}</span>
                        <span style="font-size: 0.7rem; color: #9CA3AF; display: flex; align-items: center; gap: 4px; margin-top: 4px;">
                            <i class="fa-regular fa-clock"></i> 30 min
                        </span>
                    </div>
                </div>
            </div>
        </div>
    `).join('');

    // Add small warning if truncated
    if (isTruncated) {
        const warning = document.createElement('div');
        warning.style = "grid-column: 1/-1; text-align: center; color: #6b7280; font-size: 0.85rem; padding: 10px;";
        warning.innerHTML = `<i class="fa-solid fa-circle-info"></i> Mostrando los primeros ${limit} de ${currentServices.length} servicios. Usa el buscador para encontrar específicos.`;
        gridBody.appendChild(warning);
    }
}

// --- OFFCANVAS LOGIC ---

function initOffcanvas() {
    const overlay = document.getElementById('offcanvasOverlay');
    const closeBtn = document.getElementById('btnCloseOffcanvas');
    const cancelBtn = document.getElementById('btnCancelForm');

    const close = () => {
        document.getElementById('offcanvasOverlay').classList.remove('open');
        document.getElementById('serviceOffcanvas').classList.remove('open');
    };

    overlay.addEventListener('click', close);
    closeBtn.addEventListener('click', close);
    cancelBtn.addEventListener('click', close);

    // New Service Button (Desktop)
    document.getElementById('btnNewService').addEventListener('click', () => {
        openOffcanvas(null); // Null means new
    });

    // New Service Button (Mobile FAB)
    const fab = document.getElementById('fabNewService');
    if (fab) {
        fab.addEventListener('click', () => openOffcanvas(null));
    }
}

// Exposed to global scope for HTML onclick access
window.openOffcanvas = function (codigo) {
    const canvas = document.getElementById('serviceOffcanvas');
    const overlay = document.getElementById('offcanvasOverlay');
    const title = document.getElementById('offcanvasTitle');

    // Reset Form
    document.getElementById('serviceForm').reset();

    if (codigo) {
        // EDIT MODE
        const service = allServices.find(s => s.codigo === codigo); // Search in real data
        if (!service) return;

        title.textContent = "Editar Servicio";
        document.getElementById('formCodeBadge').textContent = service.codigo;

        // Status indicator
        const statusEl = document.getElementById('formStatusIndicator');
        if (service.activo) {
            statusEl.textContent = 'Activo';
            statusEl.className = 'status-indicator active';
        } else {
            statusEl.textContent = 'Inactivo';
            statusEl.className = 'status-indicator inactive';
        }

        // Populate Fields
        document.getElementById('formNombre').value = service.nombre || '';
        document.getElementById('formCodigo').value = service.codigo || '';
        // Handle select value matching (case insensitive ideally, but exact for now)
        const catSelect = document.getElementById('formCategoria');
        if (service.categoria) {
            catSelect.value = service.categoria.toLowerCase(); // Ensure lowercase match
        }

        document.getElementById('formPrecioSesion').value = service.precio_sesion || '';
        document.getElementById('formPrecioPack').value = service.precio_paquete_4 || '';
        document.getElementById('formZonas').value = service.num_zonas || '';
        document.getElementById('formSesionesRec').value = service.cantidad_sesiones || '';
        document.getElementById('formComisionRec').value = service.comision_recepcion || '';
        document.getElementById('formComisionEsp').value = service.comision_especialista || '';

    } else {
        // NEW MODE
        title.textContent = "Nuevo Servicio";
        document.getElementById('formCodeBadge').textContent = "NEW";
        const statusEl = document.getElementById('formStatusIndicator');
        statusEl.textContent = 'Activo (Predeterminado)';
        statusEl.className = 'status-indicator active';
    }

    // Separate "Open" execution to allow CSS transition to work if display changed
    requestAnimationFrame(() => {
        overlay.classList.add('open');
        canvas.classList.add('open');
    });
};

// --- FORM SUBMISSION ---
document.getElementById('serviceForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    // Identify if it's new
    const isEdit = document.getElementById('formCodeBadge').textContent !== 'NEW';
    const codigo = document.getElementById('formCodigo').value.trim();

    if (!codigo) {
        alert("El código del servicio es obligatorio.");
        return;
    }

    const payload = {
        nombre: document.getElementById('formNombre').value.trim(),
        codigo: codigo,
        categoria: document.getElementById('formCategoria').value,
        sesion: parseFloat(document.getElementById('formPrecioSesion').value) || 0,
        paquete_4_sesiones: parseFloat(document.getElementById('formPrecioPack').value) || null,
        num_zonas: document.getElementById('formZonas').value.trim() || null,
        cantidad_sesiones: document.getElementById('formSesionesRec').value.trim() || null,
        comision_recepcionista: parseFloat(document.getElementById('formComisionRec').value) || 0,
        comision_especialista: parseFloat(document.getElementById('formComisionEsp').value) || 0,
        activo: 1
    };

    try {
        if (isEdit) {
            console.warn("Edit mode detected, but backend PUT is not fully implemented yet. Assuming it's a workaround to POST a new object with different code, or handle existing one if custom logic allows.");
        }

        const response = await fetch(`${API_URL}/servicios/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.detail || 'Error desde el servidor al intentar registrar.');
        }

        // 1. Limpiar el formulario
        document.getElementById('serviceForm').reset();

        // 2. Cerrar el modal / offcanvas
        document.getElementById('btnCloseOffcanvas').click();

        // 3. Volver a llamar a la función que descarga la lista real de servicios
        await fetchServices();

        // Opcional feedback UX
        if (typeof dpToast === 'function') {
            dpToast("✅ ¡Servicio guardado exitosamente!", "success");
        } else {
            alert("¡Servicio guardado exitosamente!");
        }

    } catch (error) {
        if (typeof dpToast === 'function') {
            dpToast(`Ocurrió un error: ${error.message}`, "error");
        } else {
            alert(`Ocurrió un error: ${error.message}`);
        }
    }
});

