/**
 * dialogs.js — Sistema global de notificaciones para Depilarte CRM
 * Reemplaza alert() y confirm() con modales y toasts bonitos.
 */

// ─── TOAST CONTAINER (auto-inject) ────────────────────────────────────────────
(function injectToastContainer() {
    if (document.getElementById('dp-toast-container')) return;
    const container = document.createElement('div');
    container.id = 'dp-toast-container';
    container.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 99999;
        display: flex;
        flex-direction: column;
        gap: 10px;
        pointer-events: none;
    `;
    document.body.appendChild(container);
})();

// ─── TOAST STYLES (auto-inject) ───────────────────────────────────────────────
(function injectToastStyles() {
    if (document.getElementById('dp-dialog-styles')) return;
    const style = document.createElement('style');
    style.id = 'dp-dialog-styles';
    style.textContent = `
        /* ── TOAST ── */
        .dp-toast {
            display: flex;
            align-items: flex-start;
            gap: 12px;
            min-width: 300px;
            max-width: 380px;
            padding: 14px 16px;
            border-radius: 14px;
            background: #ffffff;
            box-shadow: 0 8px 32px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.08);
            pointer-events: all;
            transform: translateX(120%);
            opacity: 0;
            transition: transform 0.35s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s ease;
            border-left: 4px solid #6366f1;
            position: relative;
            overflow: hidden;
        }
        .dp-toast.dp-show {
            transform: translateX(0);
            opacity: 1;
        }
        .dp-toast.dp-hide {
            transform: translateX(120%);
            opacity: 0;
        }
        .dp-toast.dp-success { border-left-color: #22c55e; }
        .dp-toast.dp-error   { border-left-color: #ef4444; }
        .dp-toast.dp-warning { border-left-color: #f59e0b; }
        .dp-toast.dp-info    { border-left-color: #6366f1; }

        .dp-toast-icon {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1rem;
            flex-shrink: 0;
        }
        .dp-success .dp-toast-icon { background: rgba(34,197,94,0.12); color: #22c55e; }
        .dp-error   .dp-toast-icon { background: rgba(239,68,68,0.12);  color: #ef4444; }
        .dp-warning .dp-toast-icon { background: rgba(245,158,11,0.12); color: #f59e0b; }
        .dp-info    .dp-toast-icon { background: rgba(99,102,241,0.12); color: #6366f1; }

        .dp-toast-body { flex: 1; min-width: 0; }
        .dp-toast-title {
            font-weight: 700;
            font-size: 0.85rem;
            color: #1e293b;
            margin-bottom: 2px;
            font-family: 'Poppins', 'Inter', sans-serif;
        }
        .dp-toast-msg {
            font-size: 0.82rem;
            color: #64748b;
            line-height: 1.4;
            font-family: 'Poppins', 'Inter', sans-serif;
            word-break: break-word;
        }
        .dp-toast-close {
            background: none;
            border: none;
            color: #94a3b8;
            font-size: 1rem;
            cursor: pointer;
            padding: 0;
            line-height: 1;
            flex-shrink: 0;
            transition: color 0.2s;
        }
        .dp-toast-close:hover { color: #475569; }

        /* ── CONFIRM MODAL ── */
        .dp-confirm-overlay {
            position: fixed;
            inset: 0;
            background: rgba(15,23,42,0.55);
            backdrop-filter: blur(4px);
            z-index: 99998;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            transition: opacity 0.25s ease;
        }
        .dp-confirm-overlay.dp-show { opacity: 1; }

        .dp-confirm-box {
            background: #fff;
            border-radius: 20px;
            box-shadow: 0 24px 64px rgba(0,0,0,0.18);
            max-width: 360px;
            width: 90%;
            overflow: hidden;
            transform: scale(0.85) translateY(20px);
            transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1);
        }
        .dp-confirm-overlay.dp-show .dp-confirm-box {
            transform: scale(1) translateY(0);
        }
        .dp-confirm-bar {
            height: 5px;
        }
        .dp-confirm-bar.danger  { background: linear-gradient(90deg,#ef4444,#f97316); }
        .dp-confirm-bar.info    { background: linear-gradient(90deg,#6366f1,#8b5cf6); }
        .dp-confirm-bar.warning { background: linear-gradient(90deg,#f59e0b,#f97316); }

        .dp-confirm-content { padding: 28px 24px 24px; text-align: center; }
        .dp-confirm-icon-wrap {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 68px;
            height: 68px;
            border-radius: 50%;
            margin-bottom: 16px;
            font-size: 1.9rem;
        }
        .dp-confirm-icon-wrap.danger  { background: rgba(239,68,68,0.1);  color: #ef4444; }
        .dp-confirm-icon-wrap.info    { background: rgba(99,102,241,0.1); color: #6366f1; }
        .dp-confirm-icon-wrap.warning { background: rgba(245,158,11,0.1); color: #f59e0b; }

        .dp-confirm-title {
            font-weight: 700;
            font-size: 1.05rem;
            color: #1e293b;
            margin-bottom: 8px;
            font-family: 'Poppins','Inter',sans-serif;
        }
        .dp-confirm-msg {
            font-size: 0.88rem;
            color: #64748b;
            margin-bottom: 24px;
            line-height: 1.5;
            font-family: 'Poppins','Inter',sans-serif;
        }
        .dp-confirm-btns { display: flex; gap: 10px; }
        .dp-confirm-btn  {
            flex: 1;
            padding: 11px;
            border-radius: 10px;
            border: none;
            font-weight: 600;
            font-size: 0.88rem;
            cursor: pointer;
            font-family: 'Poppins','Inter',sans-serif;
            transition: opacity 0.2s, transform 0.15s;
        }
        .dp-confirm-btn:hover  { opacity: 0.88; transform: translateY(-1px); }
        .dp-confirm-btn:active { transform: translateY(0); }
        .dp-btn-cancel { background: #f1f5f9; color: #475569; }
        .dp-btn-ok.danger  { background: linear-gradient(135deg,#ef4444,#f97316); color:#fff; }
        .dp-btn-ok.info    { background: linear-gradient(135deg,#6366f1,#8b5cf6); color:#fff; }
        .dp-btn-ok.warning { background: linear-gradient(135deg,#f59e0b,#f97316); color:#fff; }
    `;
    document.head.appendChild(style);
})();

// ─── ICONS ────────────────────────────────────────────────────────────────────
const _ICONS = {
    success: 'fa-solid fa-circle-check',
    error: 'fa-solid fa-circle-xmark',
    warning: 'fa-solid fa-triangle-exclamation',
    info: 'fa-solid fa-circle-info',
    confirm: 'fa-solid fa-calendar-xmark',
    question: 'fa-solid fa-circle-question',
    trash: 'fa-solid fa-trash',
};

const _TITLES = {
    success: 'Éxito',
    error: 'Error',
    warning: 'Atención',
    info: 'Información',
};

// ─── dpToast(message, type, duration) ─────────────────────────────────────────
window.dpToast = function (message, type = 'info', duration = 3800) {
    const container = document.getElementById('dp-toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `dp-toast dp-${type}`;
    toast.innerHTML = `
        <div class="dp-toast-icon"><i class="${_ICONS[type] || _ICONS.info}"></i></div>
        <div class="dp-toast-body">
            <div class="dp-toast-title">${_TITLES[type] || 'Aviso'}</div>
            <div class="dp-toast-msg">${message}</div>
        </div>
        <button class="dp-toast-close" aria-label="Cerrar"><i class="fa-solid fa-xmark"></i></button>
    `;

    container.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
        requestAnimationFrame(() => toast.classList.add('dp-show'));
    });

    // Close button
    toast.querySelector('.dp-toast-close').addEventListener('click', () => removeToast(toast));

    // Auto-close
    const timer = setTimeout(() => removeToast(toast), duration);
    toast._timer = timer;

    return toast;
};

function removeToast(toast) {
    clearTimeout(toast._timer);
    toast.classList.remove('dp-show');
    toast.classList.add('dp-hide');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
}

// ─── dpAlert(message, type) ────────────────────────────────────────────────────
// Drop-in replacement for alert() — just shows a toast
window.dpAlert = function (message, type = 'info') {
    dpToast(message, type, 4500);
};

// ─── dpConfirm(options) ───────────────────────────────────────────────────────
// Returns a Promise<boolean> — drop-in replacement for confirm()
// Options: { title, message, type='danger', okText, cancelText, icon }
window.dpConfirm = function (options = {}) {
    const {
        title = '¿Confirmar acción?',
        message = 'Esta acción no se puede deshacer.',
        type = 'danger',
        okText = 'Sí, confirmar',
        cancelText = 'No, volver',
        icon = null,
    } = (typeof options === 'string') ? { title: options } : options;

    const iconClass = icon || (type === 'danger' ? _ICONS.trash : _ICONS.question);

    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'dp-confirm-overlay';
        overlay.innerHTML = `
            <div class="dp-confirm-box">
                <div class="dp-confirm-bar ${type}"></div>
                <div class="dp-confirm-content">
                    <div class="dp-confirm-icon-wrap ${type}">
                        <i class="${iconClass}"></i>
                    </div>
                    <div class="dp-confirm-title">${title}</div>
                    <div class="dp-confirm-msg">${message}</div>
                    <div class="dp-confirm-btns">
                        <button class="dp-confirm-btn dp-btn-cancel" id="dpCancelBtn">${cancelText}</button>
                        <button class="dp-confirm-btn dp-btn-ok ${type}" id="dpOkBtn">${okText}</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        requestAnimationFrame(() => {
            requestAnimationFrame(() => overlay.classList.add('dp-show'));
        });

        function close(result) {
            overlay.classList.remove('dp-show');
            overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
            resolve(result);
        }

        overlay.querySelector('#dpOkBtn').addEventListener('click', () => close(true));
        overlay.querySelector('#dpCancelBtn').addEventListener('click', () => close(false));
        // Click outside = cancel
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });
    });
};

// ─── LOGOUT MODAL ─────────────────────────────────────────────────────────────
// Injects a logout confirm overlay if it doesn't already exist in the DOM,
// then shows it. This way personal.html (which has its own) and other pages
// that don't define it work the same way.
window.confirmarLogout = function () {
    let overlay = document.getElementById('logoutConfirmOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'logoutConfirmOverlay';
        overlay.className = 'logout-confirm-overlay';
        overlay.innerHTML = `
            <div class="logout-confirm-box">
                <div class="logout-confirm-icon">
                    <i class="fa-solid fa-right-from-bracket"></i>
                </div>
                <h3>¿Cerrar sesión?</h3>
                <p>¿Estás seguro de que deseas cerrar tu sesión? Serás redirigido al inicio de sesión.</p>
                <div class="logout-confirm-actions">
                    <button class="btn-cancelar-logout" onclick="cancelarLogout()">Cancelar</button>
                    <button class="btn-confirmar-logout" onclick="ejecutarLogout()">Sí, cerrar sesión</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) cancelarLogout();
        });
    }
    overlay.classList.add('active');
};

window.cancelarLogout = function () {
    const overlay = document.getElementById('logoutConfirmOverlay');
    if (overlay) overlay.classList.remove('active');
};

window.ejecutarLogout = function () {
    localStorage.clear();
    window.location.href = '/';
};

document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') window.cancelarLogout && cancelarLogout();
});
