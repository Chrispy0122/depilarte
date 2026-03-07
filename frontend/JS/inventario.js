const API_URL = '/api/inventario';

// --- STATE ---
let allProducts = [];

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    fetchDashboardKPIs();
    fetchInventory();

    // Filters
    document.getElementById('searchInv').addEventListener('input', filterProducts);
    document.getElementById('filterType').addEventListener('change', filterProducts);
    document.getElementById('filterCategory').addEventListener('change', filterProducts);
    document.getElementById('checkLowStock').addEventListener('change', filterProducts);

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

// --- FETCH DASHBOARD ---
async function fetchDashboardKPIs() {
    try {
        const res = await fetch(`${API_URL}/dashboard`);
        if (res.ok) {
            const data = await res.json();
            document.getElementById('kpiValor').textContent = `$${data.valor_total_inventario.toFixed(2)}`;
            document.getElementById('kpiCriticos').textContent = data.productos_criticos;

            // TODO: Render charts if needed
        }
    } catch (e) {
        console.error("Error fetching KPIs:", e);
    }
}

// --- FETCH INVENTORY ---
async function fetchInventory() {
    const loader = document.getElementById('loadingInventory');
    const grid = document.getElementById('inventoryGrid');

    try {
        loader.style.display = 'block';
        grid.innerHTML = '';

        const res = await fetch(`${API_URL}/productos`);
        if (res.ok) {
            allProducts = await res.json();
            populateCategories();
            renderProducts(allProducts);
        }
    } catch (e) {
        console.error("Error fetching inventory:", e);
        grid.innerHTML = '<p class="error-msg">Error cargando inventario. Intente recargar.</p>';
    } finally {
        loader.style.display = 'none';
    }
}

// --- RENDER PRODUCTS ---
function renderProducts(products) {
    const grid = document.getElementById('inventoryGrid');
    grid.innerHTML = '';

    if (products.length === 0) {
        grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #64748b; padding: 40px;">No se encontraron productos.</div>';
        return;
    }

    products.forEach(p => {
        const card = document.createElement('div');
        card.className = 'product-card';

        // Determine status color
        let statusClass = 'status-optimo';
        let statusText = 'Óptimo';

        if (p.estado_stock === 'critico') {
            statusClass = 'status-critico';
            statusText = 'Crítico';
        } else if (p.estado_stock === 'bajo') {
            statusClass = 'status-bajo';
            statusText = 'Bajo';
        } else if (p.estado_stock === 'exceso') {
            statusClass = 'status-exceso'; // Define if needed
            statusText = 'Exceso';
        }

        // Icon or Image Logic
        let iconHtml = '';
        if (p.imagen_url && p.imagen_url.trim() !== '') {
            // Check if it's an image path (contains '/') or emoji
            if (p.imagen_url.includes('/') || p.imagen_url.includes('.')) {
                iconHtml = `<img src="${p.imagen_url}" alt="${p.nombre}" style="width: 64px; height: 64px; object-fit: contain; border-radius: 8px;">`;
            } else {
                // It's an emoji
                iconHtml = `<div style="font-size: 3rem;">${p.imagen_url}</div>`;
            }
        } else {
            // Fallback to Category Icon
            let iconClass = 'fa-box';
            const cat = (p.categoria || '').toLowerCase();
            if (cat.includes('cabina') || cat.includes('interno')) iconClass = 'fa-pump-soap';
            if (cat.includes('desechable')) iconClass = 'fa-trash-can';
            if (cat.includes('lenceria') || cat.includes('toalla')) iconClass = 'fa-shirt';
            if (cat.includes('papel') || cat.includes('rollo')) iconClass = 'fa-note-sticky';

            iconHtml = `<i class="fa-solid ${iconClass}" style="font-size: 2.5rem; color: #cbd5e1;"></i>`;
        }

        card.innerHTML = `
            <div class="product-header" style="flex-direction: column; align-items: center; gap: 10px; padding-bottom: 10px; border-bottom: 1px dashed #eee;">
                ${iconHtml}
                <div class="product-badge ${statusClass}" style="background:var(--${statusClass}-bg); color: white; background-color: ${getColor(p.estado_stock)}; font-size: 0.75rem; padding: 4px 8px; border-radius: 12px;">
                    ${statusText}
                </div>
            </div>
            <div class="product-body">
                <h4 class="product-name" title="${p.nombre || 'Sin Nombre'}">${p.nombre || 'Sin Nombre'}</h4>
                <div class="product-meta">
                    <span>${p.categoria || 'Sin Categoría'}</span>
                    <span>$${(p.costo_unitario || 0).toFixed(2)}</span>
                </div>
                
                <div class="stock-info" style="display:flex; justify-content:space-between; font-size:0.8rem; font-weight:600; color:#555;">
                    <span>Stock: ${p.stock_actual || 0} ${p.unidad_medida || 'u'}</span>
                    <span style="color:#94a3b8;">Min: ${p.stock_minimo || 0}</span>
                </div>
                
                <div class="stock-bar-container">
                    <div class="stock-bar-fill" style="width: ${Math.min(p.porcentaje_stock || 0, 100)}%; background-color: ${getColor(p.estado_stock)}"></div>
                </div>
                
                <div class="product-actions">
                    <button class="btn-card" onclick="editProduct(${p.id})">
                        <i class="fa-solid fa-pen"></i> Editar
                    </button>
                    <button class="btn-card" onclick="openAdjustment(${p.id})">
                        <i class="fa-solid fa-sliders"></i> Ajustar
                    </button>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

function getColor(status) {
    if (status === 'critico') return '#ef4444';
    if (status === 'bajo') return '#f59e0b';
    return '#10b981';
}

// --- FILTERS ---
function filterProducts() {
    const search = document.getElementById('searchInv').value.toLowerCase();
    const type = document.getElementById('filterType').value;
    const cat = document.getElementById('filterCategory').value;
    const lowStock = document.getElementById('checkLowStock').checked;

    const filtered = allProducts.filter(p => {
        const pName = (p.nombre || '').toLowerCase();
        const pCat = (p.categoria || '').toLowerCase();

        const matchSearch = pName.includes(search) || pCat.includes(search);
        const matchType = type ? p.tipo === type : true;
        const matchCat = cat ? p.categoria === cat : true;
        const matchLow = lowStock ? (p.estado_stock === 'critico' || p.estado_stock === 'bajo') : true;

        return matchSearch && matchType && matchCat && matchLow;
    });

    renderProducts(filtered);
}

function populateCategories() {
    // Check for null categories
    const cats = [...new Set(allProducts.map(p => p.categoria || 'Sin Categoría'))].sort();
    const select = document.getElementById('filterCategory');
    select.innerHTML = '<option value="">Todas las Categorías</option>';
    cats.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c;
        select.appendChild(opt);
    });
}

// --- MODALS ---
const productModal = document.getElementById('productModal');

function openProductModal() {
    document.getElementById('productForm').reset();
    document.getElementById('prodId').value = '';
    document.getElementById('modalTitle').textContent = 'Nuevo Producto';
    productModal.style.display = 'flex';
}

function closeProductModal() {
    productModal.style.display = 'none';
}

async function saveProduct() {
    const id = document.getElementById('prodId').value;
    const payload = {
        nombre: document.getElementById('prodName').value,
        categoria: document.getElementById('prodCategory').value,
        tipo: document.getElementById('prodType').value,
        stock_actual: parseFloat(document.getElementById('prodStock').value) || 0,
        unidad_medida: document.getElementById('prodUnit').value,
        stock_minimo: parseFloat(document.getElementById('prodMin').value) || 0,
        costo_unitario: parseFloat(document.getElementById('prodCost').value) || 0
    };

    try {
        let res;
        if (id) {
            // Update
            res = await fetch(`${API_URL}/productos/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } else {
            // Create
            res = await fetch(`${API_URL}/productos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        }

        if (res.ok) {
            closeProductModal();
            fetchInventory();
            fetchDashboardKPIs();
            dpToast("Producto guardado correctamente", 'success');
        } else {
            dpToast("Error guardando producto", 'error');
        }
    } catch (e) {
        console.error(e);
        dpToast("Error de conexión", 'error');
    }
}

function editProduct(id) {
    const p = allProducts.find(x => x.id === id);
    if (!p) return;

    document.getElementById('prodId').value = p.id;
    document.getElementById('prodName').value = p.nombre;
    document.getElementById('prodCategory').value = p.categoria;
    document.getElementById('prodType').value = p.tipo;
    document.getElementById('prodStock').value = p.stock_actual;
    document.getElementById('prodUnit').value = p.unidad_medida;
    document.getElementById('prodMin').value = p.stock_minimo;
    document.getElementById('prodCost').value = p.costo_unitario;

    document.getElementById('modalTitle').textContent = 'Editar Producto';
    productModal.style.display = 'flex';
}

// --- RECIPE MANAGEMENT ---
const recipeModal = document.getElementById('recipeModal');
let currentRecipeIngredients = [];

function openRecipeModal() {
    loadServices();
    loadProductOptions(); // For ingredient selector
    recipeModal.style.display = 'flex';
}

function closeRecipeModal() {
    recipeModal.style.display = 'none';
    currentRecipeIngredients = [];
    document.getElementById('ingredientsList').innerHTML = '<p style="color:#999; font-style:italic;">Selecciona un servicio para ver su receta.</p>';
}

async function loadServices() {
    const select = document.getElementById('recipeService');
    try {
        const res = await fetch('/api/agenda/servicios'); // Reusing agenda endpoint
        if (res.ok) {
            const services = await res.json();
            select.innerHTML = '<option value="">Seleccione un servicio...</option>';
            services.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s.id;
                opt.textContent = s.nombre;
                select.appendChild(opt);
            });
        }
    } catch (e) {
        console.error("Error loading services", e);
    }
}

async function loadProductOptions() {
    const select = document.getElementById('newIngProduct');
    select.innerHTML = '<option value="">Buscar producto...</option>';

    // Sort alphabetically
    const sorted = [...allProducts].sort((a, b) => a.nombre.localeCompare(b.nombre));

    sorted.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = `${p.nombre} (${p.unidad_medida})`;
        opt.dataset.unit = p.unidad_medida;
        select.appendChild(opt);
    });

    // Listener to update unit label
    select.addEventListener('change', () => {
        const opt = select.options[select.selectedIndex];
        document.getElementById('newIngUnit').value = opt.dataset.unit || '';
    });
}

async function loadRecipe() {
    const serviceId = document.getElementById('recipeService').value;
    const list = document.getElementById('ingredientsList');

    if (!serviceId) {
        list.innerHTML = '<p style="color:#999; font-style:italic;">Selecciona un servicio para ver su receta.</p>';
        currentRecipeIngredients = [];
        return;
    }

    try {
        const res = await fetch(`${API_URL}/recetas?servicio_id=${serviceId}`);
        if (res.ok) {
            const recipe = await res.json();
            if (recipe) {
                // Map to our internal format
                currentRecipeIngredients = recipe.ingredientes.map(i => ({
                    producto_id: i.producto_id,
                    cantidad: i.cantidad,
                    unidad: i.unidad,
                    nombre: getProductName(i.producto_id)
                }));
            } else {
                currentRecipeIngredients = []; // No recipe yet
            }
        } else {
            currentRecipeIngredients = [];
        }
        renderIngredients();
    } catch (e) {
        console.error(e);
        currentRecipeIngredients = [];
        renderIngredients();
    }
}

function getProductName(id) {
    const p = allProducts.find(x => x.id === id);
    return p ? p.nombre : 'Producto ID ' + id;
}

function renderIngredients() {
    const list = document.getElementById('ingredientsList');
    list.innerHTML = '';

    if (currentRecipeIngredients.length === 0) {
        list.innerHTML = '<p style="text-align:center; padding:10px; color:#666;">Sin ingredientes asignados.</p>';
        return;
    }

    currentRecipeIngredients.forEach((ing, index) => {
        const row = document.createElement('div');
        row.style.cssText = "display:flex; justify-content:space-between; align-items:center; padding:8px; border-bottom:1px solid #eee; font-size:0.9rem;";
        row.innerHTML = `
            <span><strong>${ing.nombre}</strong></span>
            <div style="display:flex; gap:10px; align-items:center;">
                <span class="badge" style="background:#e0f2fe; color:#0369a1;">${ing.cantidad} ${ing.unidad}</span>
                <button onclick="removeIngredient(${index})" style="background:none; border:none; color:#ef4444; cursor:pointer;"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
        list.appendChild(row);
    });
}

function addIngredient() {
    const prodSelect = document.getElementById('newIngProduct');
    const qtyInput = document.getElementById('newIngQty');
    const unitInput = document.getElementById('newIngUnit');

    const prodId = parseInt(prodSelect.value);
    const qty = parseFloat(qtyInput.value);

    if (!prodId || !qty) {
        dpToast("Selecciona producto y cantidad válida.", 'warning');
        return;
    }

    // Check duplicate
    if (currentRecipeIngredients.some(i => i.producto_id === prodId)) {
        dpToast("Este producto ya está en la receta.", 'warning');
        return;
    }

    currentRecipeIngredients.push({
        producto_id: prodId,
        cantidad: qty,
        unidad: unitInput.value,
        nombre: prodSelect.options[prodSelect.selectedIndex].text.split(' (')[0]
    });

    renderIngredients();

    // Reset inputs
    prodSelect.value = '';
    qtyInput.value = '';
    unitInput.value = '';
}

window.removeIngredient = function (index) {
    currentRecipeIngredients.splice(index, 1);
    renderIngredients();
}

async function saveRecipe() {
    const serviceId = document.getElementById('recipeService').value;
    if (!serviceId) {
        dpToast("Selecciona un servicio.", 'warning');
        return;
    }

    const payload = {
        servicio_id: parseInt(serviceId),
        descripcion: "Receta creada desde inventario",
        ingredientes: currentRecipeIngredients.map(i => ({
            producto_id: i.producto_id,
            cantidad: i.cantidad,
            unidad: i.unidad
        }))
    };

    try {
        const res = await fetch(`${API_URL}/recetas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            dpToast("Receta guardada correctamente.", 'success');
            closeRecipeModal();
        } else {
            dpToast("Error guardando receta.", 'error');
        }
    } catch (e) {
        console.error(e);
        dpToast("Error de conexión", 'error');
    }
}
