// --- CONSTANTS ---
const API_URL = "/api";
let currentServices = [];
let selectedService = null;

// --- STATE ---
// let patientsToday = []; // Removed
let currentCitaId = null;
let currentPatient = null;
let currentPatientBalance = 0;
let saleType = 'session'; // 'session' or 'package'
let bcvRate = 0;
// CART STATE
let cartItems = [];
let _paqueteActivoCaja = null;
let _isCobrandoCuotaPaquete = null;

// --- DOM ELEMENTS ---
const patientListEl = document.getElementById('cobranzaList');
const modal = document.getElementById('checkoutModal');
// const modalAvatar = document.getElementById('modalAvatar'); // REMOVED
// const modalPatientName = document.getElementById('modalPatientName'); // REMOVED
const clientSelect = document.getElementById('clientSelect'); // ADDED
const walletAmountEl = document.getElementById('walletAmount');
const subtotalDisplay = document.getElementById('subtotalDisplay');

// Service Selector UI
const serviceSelect = document.getElementById('serviceSelect');
const saleTypeContainer = document.getElementById('saleTypeContainer');
const priceDisplaySession = document.getElementById('priceDisplaySession');
const priceDisplayPackage = document.getElementById('priceDisplayPackage');
const radioSession = document.querySelector('input[name="saleType"][value="session"]');
const radioPackage = document.querySelector('input[name="saleType"][value="package"]');
const radios = document.querySelectorAll('input[name="saleType"]');

// Cart UI
const btnAddService = document.getElementById('btnAddService');
const cartList = document.getElementById('cartList');

// Payment Inputs
const checkAbonoWallet = document.getElementById('check-abono-wallet');
const divAbonoExtra = document.getElementById('div-abono-extra');
const inpAbonoWallet = document.getElementById('inp-abono-wallet');
const inpFechaProxima = document.getElementById('inp-fecha-proxima');
const txtTotalPagar = document.getElementById('txt-total-pagar');
const bsConversionDisplay = document.getElementById('bsConversionDisplay');

const useWalletCheck = document.getElementById('useWalletCheck');
const deductionRow = document.getElementById('deductionRow');
const deductionAmountEl = document.getElementById('deductionAmount');
const walletAvailableText = document.getElementById('walletAvailableText');
const btnProcessPayment = document.getElementById('btnProcessPayment');
const paymentMethodSelect = document.getElementById('paymentMethodSelect');

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    fetchBCV();
    fetchServices();
    // fetchStaff(); // REMOVED - Auto-assign in backend
    // fetchHistory(); // REPLACED by switchTab('caja')
    switchTab('caja'); // Default View
    fetchConfirmedToday(); // NEW: Confirmed Appointments for Today
    fetchPatients(); // To populate selector for mapping (even if disabled)

    // Display Date
    const dDisplay = document.getElementById('currentDateDisplay');
    if (dDisplay) {
        const now = new Date();
        dDisplay.textContent = `Fecha: ${now.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;
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

    // Manual "New Charge" button logic REMOVED.
    // Flow is now exclusively triggered from "Confirmed Patients" table.

    // Event Delegation for Table Buttons
    document.addEventListener('click', (e) => {
        // Handle "Cobrar" from Main Table
        if (e.target.closest('.btn-quick-pay')) {
            const btn = e.target.closest('.btn-quick-pay');
            const clientId = parseInt(btn.dataset.clientid);
            if (clientId) {
                openCheckout(clientId);
            }
        }

        // Handle "Cobrar" from Confirmed Patients Table (ROBUST FIX)
        const btnConfirmed = e.target.closest('.btn-charge-confirmed');
        if (btnConfirmed) {
            const cid = parseInt(btnConfirmed.dataset.clientid);
            const citaId = parseInt(btnConfirmed.dataset.citaid);
            const cName = btnConfirmed.dataset.clientname;
            openCheckoutForAppointment(cid, citaId, cName);
        }

        const btn = e.target.closest('.btn-cobrar');
        if (btn) {
            const id = btn.getAttribute('data-id');
            if (id) openCheckout(parseInt(id));
        }
    });

    // Listeners for functionality
    if (useWalletCheck) useWalletCheck.addEventListener('change', updateCalculations);

    // Toggle Abono
    if (checkAbonoWallet) {
        checkAbonoWallet.addEventListener('change', () => {
            if (checkAbonoWallet.checked) {
                divAbonoExtra.style.display = 'block';
                inpAbonoWallet.value = "10.00"; // suggestion
                if (inpAbonoWallet) inpAbonoWallet.focus();
            } else {
                divAbonoExtra.style.display = 'none';
                if (inpAbonoWallet) inpAbonoWallet.value = "0.00";
            }
            updateCalculations();
        });
    }

    if (inpAbonoWallet) inpAbonoWallet.addEventListener('input', updateCalculations);

    // SERVICE SELECTOR LOGIC
    if (serviceSelect) {
        serviceSelect.addEventListener('change', () => {
            const svcId = parseInt(serviceSelect.value);
            selectedService = currentServices.find(s => s.id === svcId);

            if (selectedService) {
                // Determine Sale Type Options
                if (selectedService.paquete_4_sesiones) {
                    // Show Radios
                    saleTypeContainer.style.display = 'block';
                    priceDisplaySession.textContent = `$${selectedService.sesion.toFixed(2)}`;
                    priceDisplayPackage.textContent = `$${selectedService.paquete_4_sesiones.toFixed(2)}`;

                    // Default to Session
                    radioSession.checked = true;
                    saleType = 'session';
                } else {
                    // Hide Radios, Force Session
                    saleTypeContainer.style.display = 'none';
                    saleType = 'session';
                }
            } else {
                saleTypeContainer.style.display = 'none';
            }
            // Note: We don't update calculations immediately on select anymore, 
            // the user must click "Add". But we could show a preview if desired.
        });
    }

    // RADIO LOGIC
    radios.forEach(r => {
        r.addEventListener('change', (e) => {
            saleType = e.target.value;
        });
    });

    // ADD TO CART LOGIC
    if (btnAddService) {
        btnAddService.addEventListener('click', () => {
            if (!selectedService) {
                dpToast("Selecciona un servicio primero.", 'warning');
                return;
            }

            // Determine Price and Type Label
            let finalPrice = 0;
            let typeLabel = "";

            if (saleType === 'package' && selectedService.paquete_4_sesiones) {
                finalPrice = selectedService.paquete_4_sesiones;
                typeLabel = "Paquete";
            } else if (saleType === 'promotion') {
                finalPrice = 0; // Or prompt user? For now 0, and they edit in cart.
                typeLabel = "Promoción";
            } else {
                finalPrice = selectedService.sesion;
                typeLabel = "Sesión";
            }

            // Create Item
            const item = {
                id: Date.now(), // unique id for removal
                serviceId: selectedService.id,
                name: selectedService.nombre,
                type: typeLabel,
                price: finalPrice,
                // --- Fractional Payment Fields ---
                tipoCobro: 'completo',
                paqueteTotalSesiones: selectedService.sesiones || 4, // Assuming default 4 if not specified
                paqueteCostoTotal: selectedService.paquete_4_sesiones || finalPrice
            };

            cartItems.push(item);
            renderCart();
            updateCalculations();

            // Reset Select to allow adding more
            serviceSelect.value = "";
            selectedService = null;
            saleTypeContainer.style.display = 'none';
        });
    }
});

// --- RENDER CART ---
function renderCart() {
    if (!cartList) return;

    if (cartItems.length === 0) {
        cartList.innerHTML = '<div style="text-align: center; color: #999; font-size: 0.85rem; font-style: italic;">Ningún servicio agregado aún.</div>';
        return;
    }

    cartList.innerHTML = '';
    cartItems.forEach((item, index) => {
        const row = document.createElement('div');
        row.style.cssText = "display: flex; justify-content: space-between; align-items: center; background: #fff; padding: 10px; border: 1px solid #eee; border-radius: 8px; font-size: 0.9rem; margin-bottom: 8px;";

        const isPackageAvailable = item.hasPackageOption; // We need to store this or lookup

        // Lookup service for options (fallback)
        const svc = currentServices.find(s => s.id === item.serviceId);
        const hasPackage = svc ? (svc.paquete_4_sesiones && svc.paquete_4_sesiones > 0) : false;

        let typeSelectorHTML = '';
        if (hasPackage) {
            typeSelectorHTML = `
                <select class="cart-type-select" data-index="${index}" style="padding: 4px; border: 1px solid #ddd; border-radius: 4px; font-size: 0.8rem; background: #f8f9fa;">
                    <option value="session" ${item.type === 'Sesión' || item.type === 'session' ? 'selected' : ''}>Sesión</option>
                    <option value="package" ${item.type === 'Paquete' || item.type === 'package' ? 'selected' : ''}>Paquete</option>
                    <option value="promotion" ${item.type === 'Promoción' || item.type === 'promotion' ? 'selected' : ''}>Promoción</option>
                </select>
            `;
        } else {
            // Even if no package, allow promotion switching? 
            // The user might want to promo a single session service.
            // Let's enable selector for all, or at least session/promo.
            typeSelectorHTML = `
                <select class="cart-type-select" data-index="${index}" style="padding: 4px; border: 1px solid #ddd; border-radius: 4px; font-size: 0.8rem; background: #f8f9fa;">
                    <option value="session" ${item.type === 'Sesión' || item.type === 'session' ? 'selected' : ''}>Sesión</option>
                    <option value="promotion" ${item.type === 'Promoción' || item.type === 'promotion' ? 'selected' : ''}>Promoción</option>
                </select>
            `;
        }

        // --- FRACTIONAL PACKAGE DROPDOWN ---
        let fracSelectorHTML = '';
        if (item.type === 'Paquete' || item.type === 'package') {
            fracSelectorHTML = `
                <div style="margin-top: 6px;">
                    <select class="cart-frac-select" data-index="${index}" style="padding: 4px; border: 1px solid #ddd; border-radius: 4px; font-size: 0.8rem; background: #e0f2fe; color: #0284c7; font-weight: 600;">
                        <option value="completo" ${item.tipoCobro === 'completo' ? 'selected' : ''}>Pagar Paquete Completo</option>
                        <option value="fraccionado" ${item.tipoCobro === 'fraccionado' ? 'selected' : ''}>Pagar 1 Sesión</option>
                    </select>
                </div>
            `;
        }

        row.innerHTML = `
            <div style="flex: 1;">
                <div style="font-weight: 600; color: #333;">${item.name}</div>
                <div style="margin-top: 4px;">${typeSelectorHTML}</div>
                ${fracSelectorHTML}
            </div>
            <div style="display: flex; align-items: center; gap: 10px;">
                <div style="position: relative;">
                    <span style="position: absolute; left: 8px; top: 50%; transform: translateY(-50%); color: #888; font-size: 0.8rem;">$</span>
                    <input type="number" step="0.01" class="cart-price-input" data-index="${index}" value="${item.price.toFixed(2)}" 
                        style="width: 80px; padding: 6px 6px 6px 20px; border: 1px solid #ccc; border-radius: 6px; font-weight: 600; color: #333;">
                </div>
                <button class="btn-remove-item" data-index="${index}" style="background: #fee2e2; border: none; color: #ef4444; width: 30px; height: 30px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        `;
        cartList.appendChild(row);
    });

    // Attach Listeners
    // 1. Remove
    document.querySelectorAll('.btn-remove-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.target.closest('button').dataset.index);
            cartItems.splice(idx, 1);
            renderCart();
            updateCalculations();
        });
    });

    // 2. Type Change
    document.querySelectorAll('.cart-type-select').forEach(sel => {
        sel.addEventListener('change', (e) => {
            const idx = parseInt(e.target.dataset.index);
            const newType = e.target.value; // 'session' or 'package'
            const item = cartItems[idx];

            // Find Service to get default price
            const svc = currentServices.find(s => s.id === item.serviceId);
            if (svc) {
                if (newType === 'package') {
                    item.type = 'Paquete';
                    item.tipoCobro = 'completo'; // Reset to full package
                    item.paqueteCostoTotal = svc.paquete_4_sesiones || 0;
                    item.paqueteTotalSesiones = svc.sesiones || 4;
                    item.price = item.paqueteCostoTotal;
                } else if (newType === 'promotion') {
                    item.type = 'Promoción';
                    item.price = 0;
                } else {
                    item.type = 'Sesión';
                    item.price = svc.sesion || 0;
                }
                // Re-render to update input value
                renderCart();
                updateCalculations();
            }
        });
    });

    // 2.5 Fractional Change
    document.querySelectorAll('.cart-frac-select').forEach(sel => {
        sel.addEventListener('change', (e) => {
            const idx = parseInt(e.target.dataset.index);
            const newFrac = e.target.value; // 'completo' or 'fraccionado'
            const item = cartItems[idx];

            item.tipoCobro = newFrac;
            if (newFrac === 'fraccionado') {
                item.price = item.paqueteCostoTotal / item.paqueteTotalSesiones;
            } else {
                item.price = item.paqueteCostoTotal;
            }
            // Re-render
            renderCart();
            updateCalculations();
        });
    });


    // 3. Price Input Change
    document.querySelectorAll('.cart-price-input').forEach(inp => {
        inp.addEventListener('input', (e) => {
            const idx = parseInt(e.target.dataset.index);
            const newPrice = parseFloat(e.target.value);
            if (!isNaN(newPrice) && newPrice >= 0) {
                cartItems[idx].price = newPrice;
                // If they manually edit the price of a package, update the base cost as well
                if (cartItems[idx].type === 'Paquete' || cartItems[idx].type === 'package') {
                    if (cartItems[idx].tipoCobro === 'completo') {
                        cartItems[idx].paqueteCostoTotal = newPrice;
                    } else {
                        cartItems[idx].paqueteCostoTotal = newPrice * cartItems[idx].paqueteTotalSesiones;
                    }
                }
                updateCalculations();
            }
        });
    });
}

// --- FETCH SERVICES ---
async function fetchServices() {
    try {
        const res = await fetch(`${API_URL}/servicios/`);
        if (res.ok) {
            currentServices = await res.json();
            // Populate Dropdown
            populateServiceDropdown();
        }
    } catch (e) {
        console.error("Error fetching services:", e);
    }
}

// --- FETCH PAYMENT HISTORY (MAIN TABLE) ---
async function fetchHistory() {
    const tbody = document.getElementById('paymentHistoryBody');
    if (!tbody) return;

    try {
        // Assuming we added a GET /api/cobranza/ (listar_pagos) in backend check
        // Or strictly /api/cobranza/pagos if that was the route name in previous file view
        // The router view showed: @router.get("/") def listar_pagos
        const res = await fetch(`${API_URL}/cobranza/`);
        if (res.ok) {
            const list = await res.json();
            tbody.innerHTML = '';

            if (list.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="padding:20px; text-align:center; font-style:italic;">No hay cobros registrados.</td></tr>';
                return;
            }

            list.forEach(item => {
                const tr = document.createElement('tr');
                tr.style.borderBottom = "1px solid #eee";
                tr.innerHTML = `
                    <td style="padding: 12px; color: #666;">${item.fecha}</td>
                    <td style="padding: 12px; font-weight: 600; color: #333;">${item.cliente.nombre}</td>
                    <td style="padding: 12px; color: var(--primary); font-weight: bold;">$${item.monto.toFixed(2)}</td>
                    <td style="padding: 12px;">${item.metodo}</td>
                    <td style="padding: 12px; font-size: 0.85rem; color: #888;">${item.referencia || '-'}</td>
                `;
                tbody.appendChild(tr);
            });
        }
    } catch (e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="5" style="color:red; text-align:center;">Error cargando historial.</td></tr>';
    }
}


// --- FETCH PATIENTS (MODAL DROPDOWN) ---
async function fetchPatients() {
    try {
        const res = await fetch(`${API_URL}/pacientes/?limit=1000`); // Get all for dropdown
        if (res.ok) {
            const patients = await res.json();
            populatePatientDropdown(patients);
        }
    } catch (e) {
        console.error("Error fetching patients:", e);
    }
}

function populatePatientDropdown(patients) {
    // Ensure we are targeting a select element. The user might have it named clientSelect or cliente_id
    // We will target commonly used IDs or stick to what we had: 'clientSelect' or 'modalPatientName' if it was converted back to select.
    // Wait, the user reverted the modal structure in previous turn.
    // The user's request says: "MANTENER EL MODAL" and "Rellena el <select id="cliente_id">".
    // I need to check the HTML to see what ID is actually used for the selector now.
    // In step 369/370 I reverted the search flow, but did I revert the selector to a text element?
    // Let's check the HTML first before commiting to an ID. 
    // Assuming 'clientSelect' if it exists, or 'client_id' as user suggested.

    // Correction: In strict adherence to USER REQUEST "Rellena el <select id="cliente_id">"
    // But I must check if that ID exists in my HTML. I likely have 'clientSelect' from earlier.
    // I'll use 'clientSelect' as consistent with my codebase, or add it if missing.

    const select = document.getElementById('clientSelect') || document.getElementById('cliente_id');
    if (!select) return;

    select.innerHTML = '<option value="">Seleccione Cliente...</option>';

    patients.forEach(c => {
        const option = document.createElement('option');
        option.value = c.id;
        option.textContent = c.nombre_completo; // Model uses nombre_completo
        select.appendChild(option);
    });

    // Listener for change
    select.addEventListener('change', async () => {
        const newClientId = parseInt(select.value);
        if (newClientId) {
            await loadClientData(newClientId);
            updateCalculations();
        }
    });
}

function populateServiceDropdown() {
    if (!serviceSelect) return;
    serviceSelect.innerHTML = '<option value="">Seleccione un servicio...</option>';

    // Check if services have categories, grouping if desired. 
    // For now, simple list.
    currentServices.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = s.nombre;
        serviceSelect.appendChild(opt);
    });
}

// Debounce Helper
function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

async function searchPatients(query) {
    try {
        // Fetch all and filter client-side for simplicity/speed (or backend search endpoint)
        // Ideally backend should support ?search=... but we reuse fetching all for this scope if small DB
        const res = await fetch(`${API_URL}/pacientes/?limit=1000`);
        if (res.ok) {
            const allPatients = await res.json();
            const filtered = allPatients.filter(p =>
                p.nombre_completo.toLowerCase().includes(query.toLowerCase()) ||
                p.cedula.includes(query) ||
                (p.numero_historia && p.numero_historia.includes(query))
            );
            renderSearchResults(filtered);
        }
    } catch (e) {
        console.error(e);
        searchResults.innerHTML = '<p style="text-align:center; color:red;">Error buscando pacientes.</p>';
    }
}

function renderSearchResults(patients) {
    searchResults.innerHTML = '';
    if (patients.length === 0) {
        searchResults.innerHTML = '<p style="text-align:center;">No se encontraron pacientes.</p>';
        return;
    }

    patients.forEach(p => {
        const card = document.createElement('div');
        card.className = 'search-result-card';
        card.style.cssText = `
            display: flex; align-items: center; justify-content: space-between;
            background: white; padding: 15px 20px; border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.05); border: 1px solid #eee;
            transition: transform 0.2s;
        `;

        // const avatarUrl = ... REMOVED
        card.innerHTML = `
            <div style="display: flex; align-items: center; gap: 15px;">
                <!-- Avatar Removed -->
                <div>
                    <h4 style="margin: 0; color: #333; font-size: 1.1rem;">${p.nombre_completo}</h4>
                    <span style="font-size: 0.9rem; color: #666;">C.I: ${p.cedula}</span>
                    <span style="font-size: 0.8rem; color: #999; margin-left: 10px;">ID: ${p.id}</span>
                </div>
            </div>
            <button class="btn-verify-pay" data-id="${p.id}" style="
                background: var(--primary); color: white; border: none;
                padding: 10px 20px; border-radius: 8px; font-weight: 600;
                cursor: pointer; display: flex; align-items: center; gap: 8px;
            ">
                <i class="fa-solid fa-money-bill-1-wave"></i> Registrar Cobro
            </button>
        `;
        searchResults.appendChild(card);
    });

    // Attach listeners
    document.querySelectorAll('.btn-verify-pay').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const pid = parseInt(e.target.closest('button').dataset.id);
            openCheckout(pid);
        });
    });
}

// --- FETCH BCV ---
async function fetchBCV() {
    try {
        const r = await fetch(`${API_URL}/cobranza/tasa-bcv`);
        if (r.ok) {
            const d = await r.json();
            bcvRate = d.tasa;
            const ha = document.querySelector('.header-actions');
            if (ha && !document.querySelector('.bcv-badge')) {
                const b = document.createElement('div');
                b.className = 'bcv-badge';
                b.style.cssText = "background:#fff; padding:5px 10px; border-radius:8px; font-weight:bold; color:#2B7A58; display:inline-block; margin-right:10px;";
                b.innerHTML = `💵 BCV: ${bcvRate.toFixed(2)}`;
                ha.prepend(b);
            }
        }
    } catch (e) {
        console.error(e);
    }
}

// fetchAppointments and renderList were removed as part of the Emergency Cleanup to enforce Directory logic.

// --- FETCH CONFIRMED APPOINTMENTS TODAY ---
async function fetchConfirmedToday() {
    const tbody = document.getElementById('confirmedListBody');
    const badge = document.getElementById('confirmedCount');
    if (!tbody) return;

    try {
        const res = await fetch(`${API_URL}/cobranza/pendientes`);
        if (res.ok) {
            const list = await res.json();
            tbody.innerHTML = '';

            if (badge) badge.textContent = list.length;

            if (list.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" style="padding:20px; text-align:center; font-style:italic;">No hay citas confirmadas para hoy pendientes de gestión.</td></tr>';
                return;
            }

            list.forEach(item => {
                const tr = document.createElement('tr');
                tr.style.borderBottom = "1px solid #eee";
                tr.innerHTML = `
                    <td style="padding: 12px; font-weight: 500;">${item.hora}</td>
                    <td style="padding: 12px; font-weight: 600; color: #333;">${item.paciente_nombre}</td>
                    <td style="padding: 12px;"><span style="background: #e3f2fd; color: #1565c0; padding: 4px 8px; border-radius: 4px; font-size: 0.85rem; font-weight: 600;">Confirmada</span></td>
                    <td style="padding: 12px; text-align: right;">
                        <button class="btn-charge-confirmed" data-clientid="${item.cliente_id}" data-citaid="${item.id}" data-clientname="${item.paciente_nombre}"
                            style="background: #2B7A58; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 600;">
                            <i class="fa-solid fa-dollar-sign"></i> Cobrar
                        </button>
                    </td>
                `;
                tbody.appendChild(tr);
            });

            // Attach Listeners REMOVED (Handled by Global Delegation)
            // document.querySelectorAll('.btn-charge-confirmed').forEach(...)

        }
    } catch (e) {
        console.error("Error fetching confirmed:", e);
        tbody.innerHTML = '<tr><td colspan="4" style="color:red; text-align:center;">Error cargando citas.</td></tr>';
    }
}

// --- OPEN CHECKOUT (LOCKED MODE) ---
// --- OPEN CHECKOUT (LOCKED MODE) ---
async function openCheckoutForAppointment(clienteId, citaId, clientName) {
    currentCitaId = citaId;
    currentPatient = null;
    currentPatientBalance = 0;
    cartItems = [];
    selectedService = null;
    saleType = 'session';

    // Reset Form UI
    if (walletAmountEl) walletAmountEl.textContent = "...";
    if (useWalletCheck) {
        useWalletCheck.checked = false;
        useWalletCheck.disabled = true;
    }
    if (checkAbonoWallet) checkAbonoWallet.checked = false;
    if (divAbonoExtra) divAbonoExtra.style.display = 'none';
    if (inpAbonoWallet) inpAbonoWallet.value = "0.00";
    if (serviceSelect) serviceSelect.value = "";
    if (saleTypeContainer) saleTypeContainer.style.display = 'none';

    // Default Date Proxima
    const d = new Date();
    d.setDate(d.getDate() + 21);
    if (inpFechaProxima) inpFechaProxima.value = d.toISOString().split('T')[0];

    renderCart();

    const select = document.getElementById('clientSelect');
    if (select) {
        select.value = clienteId;
        select.disabled = true; // LOCK

        // Trigger change manual
        await loadClientData(clienteId);
        updateCalculations();

        // Use passed name for immediate feedback while loading data
        const modalPatientName = document.getElementById('modalPatientName');
        if (modalPatientName && clientName) {
            modalPatientName.textContent = clientName;
        }
    }

    // Open Modal
    if (modal) modal.classList.add('active');
}

// Deprecated or Internal Use Only
function openNewChargeModal() {
    // Kept empty or basic just in case, but flow is overridden
}

// Keep openCheckout for backward compatibility if called from elsewhere (e.g., search)
// But modify to set citaId if provided
// Keep openCheckout for backward compatibility if called from elsewhere (e.g., search)
// But modify to set citaId if provided
window.openCheckout = async function (patientId) {
    // Reset State
    currentCitaId = null;
    currentPatient = null;
    currentPatientBalance = 0;
    cartItems = [];
    selectedService = null;
    saleType = 'session';

    // Reset Form UI
    if (walletAmountEl) walletAmountEl.textContent = "...";
    if (useWalletCheck) {
        useWalletCheck.checked = false;
        useWalletCheck.disabled = true;
    }
    if (checkAbonoWallet) checkAbonoWallet.checked = false;
    if (divAbonoExtra) divAbonoExtra.style.display = 'none';
    if (inpAbonoWallet) inpAbonoWallet.value = "0.00";
    if (serviceSelect) serviceSelect.value = "";
    if (saleTypeContainer) saleTypeContainer.style.display = 'none';

    // Default Date Proxima
    const d = new Date();
    d.setDate(d.getDate() + 21);
    if (inpFechaProxima) inpFechaProxima.value = d.toISOString().split('T')[0];

    // Render Empty Cart
    renderCart();

    const select = document.getElementById('clientSelect');
    if (select) {
        select.value = patientId;
        select.disabled = true; // Lock for specific patient

        // Trigger change manual
        await loadClientData(patientId);
        updateCalculations();

        // Set Verified Name Display
        const modalPatientName = document.getElementById('modalPatientName');
        if (modalPatientName && currentPatient) {
            modalPatientName.textContent = currentPatient.nombre_completo;
        }
    }

    // OPEN MODAL
    if (modal) modal.classList.add('active');
}

async function loadClientData(clienteId) {
    try {
        const res = await fetch(`${API_URL}/pacientes/${clienteId}`);
        if (res.ok) {
            currentPatient = await res.json();
            currentPatientBalance = currentPatient.saldo_wallet || 0;
        } else {
            currentPatient = null;
            currentPatientBalance = 0;
        }
    } catch {
        currentPatient = null;
        currentPatientBalance = 0;
    }

    walletAmountEl.textContent = `$${currentPatientBalance.toFixed(2)}`;

    // Wallet Text
    if (currentPatientBalance <= 0) {
        useWalletCheck.disabled = true;
        walletAvailableText.textContent = "Sin saldo";
    } else {
        useWalletCheck.disabled = false;
        walletAvailableText.textContent = `Disponible: $${currentPatientBalance.toFixed(2)}`;
    }

    // --- PAQUETES LOGIC ---
    try {
        const pRes = await fetch(`${API_URL}/cobranza/paciente/${clienteId}/paquetes`);
        if (pRes.ok) {
            const paquetes = await pRes.json();
            const panel = document.getElementById('paq-panel');
            const panelEmpty = document.getElementById('paq-panel-empty');

            if (paquetes && paquetes.length > 0) {
                _paqueteActivoCaja = paquetes[0]; // Tomar el primer paquete activo
                if (panel) panel.style.display = 'block';
                if (panelEmpty) panelEmpty.style.display = 'none';

                document.getElementById('paq-nombre-display').textContent = _paqueteActivoCaja.nombre_paquete;
                document.getElementById('paq-sesiones-display').textContent = `Sesiones: ${_paqueteActivoCaja.sesiones_usadas} / ${_paqueteActivoCaja.total_sesiones}`;
                document.getElementById('paq-pagado-display').textContent = `Pagado: $${_paqueteActivoCaja.monto_pagado.toFixed(2)} / $${_paqueteActivoCaja.costo_total.toFixed(2)}`;

                const pct = (_paqueteActivoCaja.sesiones_usadas / _paqueteActivoCaja.total_sesiones) * 100;
                document.getElementById('paq-progress-bar').style.width = pct + "%";
            } else {
                _paqueteActivoCaja = null;
                if (panel) panel.style.display = 'none';
                if (panelEmpty) panelEmpty.style.display = 'block';
            }
        }
    } catch (e) { console.error("Error loading packages", e); }
}

window.closeModal = function () {
    modal.classList.remove('active');
    _paqueteActivoCaja = null;
    _isCobrandoCuotaPaquete = null;
}

// --- CALCULATIONS ---
function updateCalculations(preserveInput = false) {
    // 1. Service Sum (FROM CART)
    let serviceSum = cartItems.reduce((acc, item) => acc + item.price, 0);

    /* 
    DEPRECATED SINGLE SELECTION LOGIC
    if (selectedService) {
        if (saleType === 'package' && selectedService.precio_paquete) {
            serviceSum = selectedService.precio_paquete;
        } else {
            serviceSum = selectedService.precio_sesion;
        }
    }
    */

    subtotalDisplay.textContent = `$${serviceSum.toFixed(2)}`;

    // 2. Wallet Deduction
    let deduction = 0;
    if (useWalletCheck.checked) {
        deduction = Math.min(serviceSum, currentPatientBalance);
        deductionRow.style.display = 'flex';
        deductionAmountEl.textContent = `-$${deduction.toFixed(2)}`;
    } else {
        deductionRow.style.display = 'none';
    }

    const payService = serviceSum - deduction;

    // Only overwrite if NOT preserving input (e.g. adding items, or first load)
    // AND if inpMontoDeuda exists
    // REMOVED inpMontoDeuda logic

    // 2.5 Start with whatever is in the input (User might have lowered it)
    const amountPayingForService = payService;

    // 3. Abono (Wallet Extra)
    const abonoWallet = parseFloat(inpAbonoWallet ? inpAbonoWallet.value : 0) || 0;

    // 4. Total Cash Flow (What client pays now)
    const totalCash = amountPayingForService + abonoWallet;

    if (txtTotalPagar) txtTotalPagar.textContent = `$${totalCash.toFixed(2)}`;

    // BS
    if (bcvRate > 0) {
        bsConversionDisplay.textContent = `Bs ${(totalCash * bcvRate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
}

// --- PROCESS PAYMENT UPDATE ---
console.log("🔍 Setting up payment button listener...");

if (!btnProcessPayment) {
    console.error("❌ ERROR: btnProcessPayment not found!");
} else {
    btnProcessPayment.addEventListener('click', async () => {
        console.log("💰 PAYMENT BUTTON CLICKED!");

        // Validate
        const select = document.getElementById('clientSelect');
        const clienteId = select ? parseInt(select.value) : null;

        if (!clienteId) {
            dpToast("Seleccione un paciente.", 'warning');
            return;
        }
        if (cartItems.length === 0) {
            dpToast("Agrega al menos un servicio.", 'warning');
            return;
        }
        if (!inpFechaProxima.value) {
            dpToast("Fecha próxima requerida.", 'warning');
            return;
        }

        btnProcessPayment.disabled = true;
        btnProcessPayment.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ...';

        // Recalculate totals
        let serviceSum = cartItems.reduce((acc, item) => acc + item.price, 0);
        let deduction = 0;
        if (useWalletCheck && useWalletCheck.checked) {
            deduction = Math.min(serviceSum, currentPatientBalance);
        }
        const payService = serviceSum - deduction;
        const abono = parseFloat(inpAbonoWallet ? inpAbonoWallet.value : 0) || 0;

        // Capture Reference (Optional)
        const refInput = document.getElementById('inp-referencia');
        const referenciaVal = refInput ? refInput.value.trim() : "";

        // Create Items Payload
        const itemsPayload = cartItems.map(item => {
            let tVenta = 'sesion';
            if (item.type === 'Paquete' || item.type === 'package') tVenta = 'paquete';
            if (item.type === 'Promoción' || item.type === 'promotion') tVenta = 'promocion';

            return {
                servicio_id: item.serviceId,
                tipo_venta: tVenta,
                precio_aplicado: item.price,
                tipo_cobro: item.tipoCobro || 'completo',
                sesiones_totales: item.paqueteTotalSesiones || 1
            };
        });

        const payload = {
            // New Scheme Payload
            cliente_id: clienteId,
            items: itemsPayload,
            metodo_pago: paymentMethodSelect.value, // Used for header
            referencia: referenciaVal || null,
            fecha_proxima: inpFechaProxima.value || null,

            // Partial Payment Logic Removed. "Abono" is now Wallet Top-Up.
            monto_abonado: parseFloat(abono.toFixed(2)),
            monto_wallet_usado: parseFloat(deduction.toFixed(2)),
            tasa_bcv: bcvRate > 0 ? bcvRate : null  // Guardar tasa del día
        };

        console.log("📤 Sending payment payload:", payload);

        try {
            const r = await fetch(`${API_URL}/cobranza/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (r.ok) {
                const data = await r.json();

                // --- ABONO DE PAQUETE (Si aplica) ---
                if (_isCobrandoCuotaPaquete) {
                    const idx = cartItems.findIndex(i => i.type === "Cuota");
                    if (idx !== -1) {
                        try {
                            await fetch(`${API_URL}/cobranza/paquete/${_isCobrandoCuotaPaquete}/abonar`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ monto: cartItems[idx].price })
                            });
                        } catch (e) { console.error("Error al abonar cuota de paquete:", e); }
                    }
                }
                _isCobrandoCuotaPaquete = null;

                dpToast(`¡Cobro exitoso! (ID: ${data.cobro_id || 'OK'})`, 'success');
                closeModal();
                fetchCajaHoy();
            } else {
                const err = await r.json();
                dpToast("Error: " + (err.detail || "Error desconocido"), 'error');
            }
        } catch (e) {
            console.error(e);
            dpToast("Error de conexión", 'error');
        } finally {
            btnProcessPayment.disabled = false;
            btnProcessPayment.innerHTML = 'Confirmar y Procesar <i class="fa-solid fa-arrow-right"></i>';
        }
    });
}

// --- NEW MODULE LOGIC: TABS & STAFF ---

let staffList = [];

// 1. Switch Tabs
window.switchTab = function (tabName) {
    // Buttons
    document.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.remove('active');
        b.style.borderBottom = "3px solid transparent";
        b.style.color = "#888";
    });
    const activeBtn = document.getElementById(`tab-${tabName}`);
    if (activeBtn) {
        activeBtn.classList.add('active');
        activeBtn.style.borderBottom = "3px solid #2B7A58"; // Primary color
        activeBtn.style.color = "#333";
    }

    // Content
    document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
    document.getElementById(`view-${tabName}`).style.display = 'block';

    // Load Data
    if (tabName === 'caja') {
        fetchCajaHoy();
    }
    // Nomina is loaded on demand via button
}

// 2. Fetch Staff
// Staff functions removed

// 3. Fetch Caja Hoy
async function fetchCajaHoy() {
    const tbody = document.getElementById('paymentHistoryBody');
    const totalDisplay = document.getElementById('totalTodayDisplay');
    const countDisplay = document.getElementById('todayCount');
    const dateInput = document.getElementById('fechaCaja');

    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px;">Cargando...</td></tr>';

    try {
        let url = `${API_URL}/cobranza/hoy`;
        if (dateInput && dateInput.value) {
            url += `?fecha=${dateInput.value}`;
        }

        const res = await fetch(url);
        if (res.ok) {
            const data = await res.json();
            tbody.innerHTML = '';

            if (totalDisplay) totalDisplay.textContent = `$${data.total_cobrado.toFixed(2)}`;
            if (countDisplay) countDisplay.textContent = data.cobros.length;

            if (data.cobros.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; font-style:italic;">No hay movimientos en esta fecha.</td></tr>';
                return;
            }

            data.cobros.forEach(c => {
                const tr = document.createElement('tr');
                tr.style.borderBottom = "1px solid #eee";
                tr.innerHTML = `
                    <td style="padding: 12px; color: #666;">${c.hora}</td>
                    <td style="padding: 12px; font-weight: 600; color: #333;">${c.cliente}</td>
                    <td style="padding: 12px; font-size: 0.85rem; color: #555;">${c.servicios}</td>
                    <td style="padding: 12px; text-align: right; font-weight: 600;">
                        $${(c.monto_total ?? c.monto ?? 0).toFixed(2)}
                        ${c.tasa_bcv ? `<div style="font-size:0.78rem; color:#888; font-weight:400;">Bs ${((c.monto_total ?? c.monto ?? 0) * c.tasa_bcv).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>` : ''}
                    </td>
                    <td style="padding: 12px; text-align: right; color: #2B7A58; font-weight: 700;">
                        $${(c.monto_abonado ?? 0).toFixed(2)}
                        ${c.tasa_bcv ? `<div style="font-size:0.78rem; color:#888; font-weight:400;">Bs ${((c.monto_abonado ?? 0) * c.tasa_bcv).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>` : ''}
                    </td>
                    <td style="padding: 12px;">${c.metodo}</td>
                    <td style="padding: 12px; font-size: 0.85rem; color: #888;">${c.referencia || '-'}</td>
                `;
                tbody.appendChild(tr);
            });
        } else {
            const err = await res.json();
            throw new Error(err.detail || "Error del servidor (" + res.status + ")");
        }
    } catch (e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:red;">Error cargando caja.</td></tr>';
        dpToast("Error cargando Caja de Hoy: " + e.message, 'error');
    }
}

// 3.5 Export Excel
function exportToExcel() {
    const dateInput = document.getElementById('fechaCaja');
    const fecha = dateInput ? dateInput.value : null;

    // Validate
    if (!fecha) {
        dpToast("Selecciona una fecha válida.", 'warning');
        return;
    }

    try {
        const btn = document.querySelector('.btn-export');
        let originalText = "Exportar Excel";

        if (btn) {
            originalText = btn.innerHTML;
            btn.innerHTML = `<span style="font-size:0.9rem;">⏳ Generando...</span>`;
            btn.style.opacity = "0.7";
            btn.style.cursor = "wait";
            btn.disabled = true;
        }

        const url = `${API_URL}/cobranza/exportar?fecha=${fecha}`;

        // Trigger download
        window.location.href = url;

        // Reset UI simulation (since we can't truly know when download starts via window.location)
        setTimeout(() => {
            if (btn) {
                btn.innerHTML = originalText;
                btn.style.opacity = "1";
                btn.style.cursor = "pointer";
                btn.disabled = false;
            }
        }, 2500);

    } catch (e) {
        console.error(e);
        dpToast("Error exportando: " + e.message, 'error');
    }
}

// 4. Fetch Nomina
window.fetchNomina = async function () {
    const start = document.getElementById('dateStart').value;
    const end = document.getElementById('dateEnd').value;
    const tbody = document.getElementById('nominaBody');

    if (!start || !end) {
        dpToast("Seleccione rango de fechas completo.", 'warning');
        return;
    }

    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px;">Calculando nómina...</td></tr>';

    try {
        const res = await fetch(`${API_URL}/cobranza/nomina/historico?start_date=${start}&end_date=${end}`);
        if (res.ok) {
            const lista = await res.json();
            tbody.innerHTML = '';

            if (lista.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px;">No se generaron comisiones en este periodo.</td></tr>';
                return;
            }

            lista.forEach(emp => {
                const tr = document.createElement('tr');
                tr.style.borderBottom = "1px solid #eee";
                tr.innerHTML = `
                    <td style="padding: 12px; color: #888;">${emp.empleado_id}</td>
                    <td style="padding: 12px; font-weight: 600; color: #333;">${emp.nombre}</td>
                    <td style="padding: 12px;">${emp.rol}</td>
                    <td style="padding: 12px; text-align: center; font-weight: 500;">${emp.total_zonas}</td>
                    <td style="padding: 12px; text-align: center; font-weight: 500;">${emp.total_limpiezas}</td>
                    <td style="padding: 12px; text-align: center; font-weight: 500;">${emp.total_masajes}</td>
                    <td style="padding: 12px; font-weight: bold; color: #2B7A58; text-align: right;">$${emp.total_pagar.toFixed(2)}</td>
                `;
                tbody.appendChild(tr);
            });
        } else {
            const err = await res.json();
            dpToast(err.detail || "Error en reporte", 'error');
            tbody.innerHTML = '';
        }
    } catch (e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:red;">Error de conexión.</td></tr>';
        dpToast("Error cargando Nómina: " + e.message, 'error');
    }
}



// --- SERVICES MODAL LOGIC (ADDED) ---
const servicesModal = document.getElementById('servicesModal');
let cachedServices = [];

window.openServicesModal = async function () {
    servicesModal.classList.add('active');
    if (cachedServices.length === 0) {
        await fetchServicesForModal();
    } else {
        renderServicesModal(cachedServices);
    }
}

window.closeServicesModal = function () {
    servicesModal.classList.remove('active');
}

window.filterServicesModal = function (category, btn) {
    // Update tabs
    document.querySelectorAll('#servicesModal .filter-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    if (category === 'all') {
        renderServicesModal(cachedServices);
    } else {
        const filtered = cachedServices.filter(s => s.categoria === category);
        renderServicesModal(filtered);
    }
}

async function fetchServicesForModal() {
    const tbody = document.getElementById('modalServicesBody');
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;"><i class="fa-solid fa-spinner fa-spin"></i> Cargando...</td></tr>';

    try {
        const res = await fetch(`${API_URL}/servicios/`);
        if (res.ok) {
            cachedServices = await res.json();
            renderServicesModal(cachedServices);
        } else {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:red;">Error cargando datos.</td></tr>';
        }
    } catch (e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="5" style="color:red; text-align:center;">Error de conexión.</td></tr>';
    }
}

function renderServicesModal(items) {
    const tbody = document.getElementById('modalServicesBody');
    tbody.innerHTML = '';

    if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; font-style:italic;">No hay servicios en esta categoría.</td></tr>';
        return;
    }

    items.forEach(item => {
        const tr = document.createElement('tr');

        const precioSesion = item.sesion > 0 ? `$${item.sesion}` : '-';
        const precioPaquete = item.paquete_4_sesiones ? `$${item.paquete_4_sesiones}` : '-';

        // Format logic derived from image: "mismo precio de depilacion" handling or zeroes
        let displaySesion = `<span style="font-weight:600;">${precioSesion}</span>`;
        let displayPaquete = `<span style="color:var(--primary); font-weight:700; background:#ecfdf5; padding:2px 6px; border-radius:4px;">${precioPaquete}</span>`;

        if (item.sesion === 0 && item.nombre.includes("mismo precio")) {
            displaySesion = '<span style="font-size:0.8rem; color:#777;">Ver Depilación</span>';
            displayPaquete = '-';
        }

        tr.innerHTML = `
            <td><span style="font-family:monospace; background:#eee; padding:2px 6px; border-radius:4px; font-size:0.85rem;">${item.codigo}</span></td>
            <td style="font-weight:500;">${item.nombre}</td>
            <td>${displaySesion}</td>
            <td>${displayPaquete}</td>
            <td style="font-size:0.85rem; color:#666;">${item.num_zonas || '-'}</td>
        `;
        tbody.appendChild(tr);
    });
}

// Initialize Date Picker for 'Caja Diaria'
document.addEventListener('DOMContentLoaded', () => {
    const dateInput = document.getElementById('fechaCaja');
    if (dateInput) {
        // Set Default Date to Local YYYY-MM-DD
        const today = new Date();
        const y = today.getFullYear();
        const m = String(today.getMonth() + 1).padStart(2, '0');
        const d = String(today.getDate()).padStart(2, '0');
        dateInput.value = `${y}-${m}-${d}`;

        // Reload on change
        dateInput.addEventListener('change', () => {
            // Refresh regardless of active tab since this input is likely only visible in Caja tab
            // But good check is safe
            if (window.fetchCajaHoy) window.fetchCajaHoy();
        });
    }

    // ==========================================
    // MODULE: PAQUETES (CUPONERAS) FRONTEND
    // ==========================================

    // 1. OPEN MODAL VENDER PAQUETE
    const btnNewPaq = document.getElementById('btn-nuevo-paquete');
    const btnNewPaqEmpty = document.getElementById('btn-nuevo-paquete-empty');
    if (btnNewPaq) btnNewPaq.addEventListener('click', () => document.getElementById('modalVenderPaquete').classList.add('active'));
    if (btnNewPaqEmpty) btnNewPaqEmpty.addEventListener('click', () => document.getElementById('modalVenderPaquete').classList.add('active'));

    // 2. FORM DE VENDER PAQUETE
    const frmVender = document.getElementById('formVenderPaquete');
    if (frmVender) {
        frmVender.addEventListener('submit', async (e) => {
            e.preventDefault();
            const clientId = document.getElementById('clientSelect').value;
            if (!clientId) return dpToast("Selecciona un paciente primero", "error");

            const payload = {
                nombre_paquete: document.getElementById('vp-nombre').value,
                total_sesiones: parseInt(document.getElementById('vp-sesiones').value),
                costo_total: parseFloat(document.getElementById('vp-costo').value)
            };

            try {
                const r = await fetch(`${API_URL}/cobranza/paciente/${clientId}/paquetes`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
                });
                if (r.ok) {
                    dpToast("Paquete vendido exitosamente", "success");
                    document.getElementById('modalVenderPaquete').classList.remove('active');
                    frmVender.reset();
                    loadClientData(clientId); // reload to show panel
                } else {
                    dpToast("Error al vender paquete", "error");
                }
            } catch (err) { console.error(err); dpToast("Error de conexión", "error"); }
        });
    }

    // 3. BOTÓN COBRAR SESIÓN DE PAQUETE (AGREGA AL CARRITO)
    const btnCobrarPaq = document.getElementById('btn-cobrar-sesion-paq');
    if (btnCobrarPaq) {
        btnCobrarPaq.addEventListener('click', () => {
            if (!_paqueteActivoCaja) return;
            const costPerSession = _paqueteActivoCaja.costo_total / _paqueteActivoCaja.total_sesiones;

            cartItems.push({
                id: Date.now(),
                serviceId: 0, // id temporal o nulo
                name: "Cuota de Paquete: " + _paqueteActivoCaja.nombre_paquete,
                type: "Cuota",
                price: parseFloat(costPerSession.toFixed(2))
            });
            _isCobrandoCuotaPaquete = _paqueteActivoCaja.id; // Flag for checkout logic
            renderCart();
            updateCalculations();
            dpToast("Cuota de paquete agregada al cobro", "info");
        });
    }

});
