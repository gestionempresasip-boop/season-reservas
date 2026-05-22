/* ═══════════════════════════════════════════════
   SEASON - Main App Controller
   ═══════════════════════════════════════════════ */

const API = '';
let currentDate = (() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); })();
let currentShift = 'comida';

// Detect mobile for optimizations
const isMobile = /iPhone|iPad|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
if (isMobile) document.documentElement.classList.add('is-mobile');

document.addEventListener('DOMContentLoaded', () => {
    initDatePicker();
    initNavigation();
    initShiftButtons();
    initSocketIO();
    updateDateDisplay();
    refreshAll();
    setInterval(refreshAll, 90000); // backup refresh cada 90s (menos carga en móvil)
});

// ── SocketIO Tiempo Real ────────────────────────

let socket = null;
let connectionAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;

function initSocketIO() {
    if (typeof io === 'undefined') return;

    socket = io({
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnection: true,
        reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
        transports: ['polling']
    });

    socket.on('connect', () => {
        connectionAttempts = 0;
        updateSyncStatus(true);
        console.log('✅ Conectado al servidor');
    });

    socket.on('disconnect', () => {
        updateSyncStatus(false);
        console.log('❌ Desconectado del servidor');
    });

    socket.on('connect_error', (error) => {
        console.warn('⚠️ Error de conexión:', error);
        updateSyncStatus(false);
    });

    socket.on('reservation_changed', () => {
        debouncedRefresh();
    });
}

function updateSyncStatus(isConnected) {
    const btn = document.getElementById('btnSync');
    if (!btn) return;

    if (isConnected) {
        btn.innerHTML = '✓ LIVE';
        btn.style.borderColor = '#16a34a';
        btn.style.color = '#16a34a';
        btn.title = 'Conectado en tiempo real';
    } else {
        btn.innerHTML = '⟳ SYNC';
        btn.style.borderColor = '#ea580c';
        btn.style.color = '#ea580c';
        btn.title = 'Sincronizando automáticamente cada 30 segundos';
    }
}

function refreshActiveView() {
    const active = document.querySelector('.view.active');
    if (!active) return;
    if (active.id === 'viewReservas') loadReservationsList();
    if (active.id === 'viewEspera') loadWaitlist();
    if (active.id === 'viewClientes') loadClientsList();
    if (active.id === 'viewAgenda') loadCalendar();
}

// Debounced refresh: múltiples llamadas en 500ms se agrupan en una sola
let _refreshTimer = null;
function debouncedRefresh() {
    if (_refreshTimer) clearTimeout(_refreshTimer);
    _refreshTimer = setTimeout(() => { refreshAll(); }, 500);
}

// ── Date ────────────────────────────────────────

function initDatePicker() {
    const picker = document.getElementById('datePicker');
    picker.value = currentDate;
    picker.addEventListener('change', (e) => {
        currentDate = e.target.value;
        updateDateDisplay();
        refreshAll();
    });
}

function updateDateDisplay() {
    const d = new Date(currentDate + 'T12:00:00');
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const target = new Date(d);
    target.setHours(12, 0, 0, 0);
    const isToday = target.getTime() === today.getTime();

    const months = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
    const display = document.getElementById('dateDisplay');
    if (isToday) {
        display.textContent = `HOY · ${d.getDate()} ${months[d.getMonth()]}`;
    } else {
        display.textContent = `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
    }
}

// ── Shift ───────────────────────────────────────

function initShiftButtons() {
    document.getElementById('btnComida').addEventListener('click', () => setShift('comida'));
    document.getElementById('btnCena').addEventListener('click', () => setShift('cena'));
}

function setShift(shift) {
    currentShift = shift;
    document.querySelectorAll('.shift-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`[data-shift="${shift}"]`).classList.add('active');
    refreshAll();
}

// ── Navigation ──────────────────────────────────

function initNavigation() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const viewId = btn.dataset.view;
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
            document.getElementById(viewId).classList.add('active');

            if (viewId === 'viewReservas') loadReservationsList();
            if (viewId === 'viewEspera') loadWaitlist();
            if (viewId === 'viewClientes') loadClientsList();
            if (viewId === 'viewAgenda') loadCalendar();
            if (viewId === 'viewInformes') initReportDates();
        });
    });
}

// ── Refresh ─────────────────────────────────────

async function refreshAll() {
    try {
        if (isMobile) {
            // Mobile: split into 2 lightweight calls (parallel) instead of 1 heavy
            const [statsRes, dashRes] = await Promise.allSettled([
                apiGet(`/api/quick-status?date=${currentDate}&shift=${currentShift}`),
                apiGet(`/api/dashboard?date=${currentDate}&shift=${currentShift}`)
            ]);

            if (statsRes.status === 'fulfilled') {
                const stats = statsRes.value;
                document.getElementById('statReservas').textContent = stats.reservations;
                document.getElementById('statComensales').textContent = stats.guests;
                document.getElementById('statOcupacion').textContent = stats.occupancy + '%';
                document.getElementById('statSentadas').textContent = stats.seated;
                document.getElementById('statPendientes').textContent = stats.pending;
            }

            if (dashRes.status === 'fulfilled') {
                const data = dashRes.value;
                tableDataMap = {};
                if (data.tables) data.tables.forEach(t => { tableDataMap[t.number] = t; });
                if (typeof renderFloorPlan === 'function') renderFloorPlan();
                if (typeof allReservations !== 'undefined' && data.reservations) {
                    allReservations = data.reservations;
                }
            }
        } else {
            // Desktop: single dashboard call
            const data = await apiGet(`/api/dashboard?date=${currentDate}&shift=${currentShift}`);
            document.getElementById('statReservas').textContent = data.stats.reservations;
            document.getElementById('statComensales').textContent = data.stats.guests;
            document.getElementById('statOcupacion').textContent = data.stats.occupancy + '%';
            document.getElementById('statSentadas').textContent = data.stats.seated;
            document.getElementById('statPendientes').textContent = data.stats.pending;

            tableDataMap = {};
            data.tables.forEach(t => { tableDataMap[t.number] = t; });
            if (typeof renderFloorPlan === 'function') renderFloorPlan();

            if (typeof allReservations !== 'undefined') {
                allReservations = data.reservations;
            }
        }

        // Refresh active view with already-loaded data
        const active = document.querySelector('.view.active');
        if (active) {
            if (active.id === 'viewReservas' && typeof renderReservationsList === 'function') {
                if (typeof allReservations !== 'undefined') renderReservationsList(allReservations);
            } else if (active.id === 'viewEspera') loadWaitlist();
            else if (active.id === 'viewClientes') loadClientsList();
            else if (active.id === 'viewAgenda') loadCalendar();
        }
    } catch (e) {
        console.error('❌ Error en refresh:', e);
        showConnectionError();
    }
}

function showConnectionError() {
    const msg = document.querySelector('[data-error="connection"]');
    if (!msg) {
        const div = document.createElement('div');
        div.setAttribute('data-error', 'connection');
        div.style.cssText = `
            position: fixed; top: 60px; left: 50%; transform: translateX(-50%);
            background: #fecaca; color: #7f1d1d; padding: 12px 16px;
            border-radius: 8px; font-size: 12px; z-index: 1000;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1); max-width: 90vw;
        `;
        div.textContent = '⚠️ Problemas de conexión. Reintentando...';
        document.body.appendChild(div);
        setTimeout(() => div.remove(), 5000);
    }
}

// loadStats: now handled by /api/dashboard in refreshAll()

// ── Sync Button ─────────────────────────────────

document.getElementById('btnSync')?.addEventListener('click', () => {
    // Limpiar caché si existe
    if ('caches' in window) {
        caches.keys().then(cacheNames => {
            cacheNames.forEach(cacheName => {
                caches.delete(cacheName);
            });
        });
    }

    refreshAll();
    showToast('✓ Datos sincronizados', 'success');
});

// Long press para limpiar caché
let syncPressTimer;
document.getElementById('btnSync')?.addEventListener('mousedown', () => {
    syncPressTimer = setTimeout(() => {
        if ('caches' in window) {
            caches.keys().then(cacheNames => {
                Promise.all(cacheNames.map(name => caches.delete(name))).then(() => {
                    showToast('🗑️ Caché limpiado completamente', 'success');
                    location.reload();
                });
            });
        }
    }, 2000);
});

document.getElementById('btnSync')?.addEventListener('mouseup', () => {
    clearTimeout(syncPressTimer);
});

// ── Modal ────────────────────────────────────────

function openModal(id) {
    document.getElementById(id).classList.remove('hidden');
}

function closeModal(id) {
    document.getElementById(id).classList.add('hidden');
}

// ── Toast ────────────────────────────────────────

function showToast(msg, type = '') {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.className = 'toast ' + type;
    setTimeout(() => toast.classList.add('hidden'), 2500);
}

// ── API Helpers ──────────────────────────────────

// ── API Functions with Retry Logic ──────────────

const MAX_RETRIES = 1; // Menos reintentos
const RETRY_DELAY = 500;
const API_TIMEOUT = 10000; // 10s timeout (fallar rápido es mejor que esperar)

function createTimeout(ms) {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), ms);
    return controller.signal;
}

async function withRetry(fn, retries = MAX_RETRIES) {
    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        } catch (error) {
            if (i === retries - 1) throw error;
            const delay = RETRY_DELAY * (i + 1);
            console.log(`🔄 Reintento ${i + 1}/${retries} en ${delay/1000}s...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

async function apiGet(url) {
    return withRetry(async () => {
        const res = await fetch(API + url, { signal: createTimeout(API_TIMEOUT) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
    });
}

async function apiPost(url, data) {
    return withRetry(async () => {
        const res = await fetch(API + url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
            signal: createTimeout(API_TIMEOUT)
        });
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error || `HTTP ${res.status}`);
        }
        return res.json();
    });
}

async function apiPut(url, data) {
    return withRetry(async () => {
        const res = await fetch(API + url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data || {}),
            signal: createTimeout(API_TIMEOUT)
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
    });
}

async function apiDelete(url) {
    return withRetry(async () => {
        const res = await fetch(API + url, {
            method: 'DELETE',
            signal: createTimeout(API_TIMEOUT)
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
    });
}

// ── Utility ──────────────────────────────────────

function formatDate(iso) {
    const d = new Date(iso + 'T12:00:00');
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function statusBadge(status) {
    const map = {
        confirmed: ['Confirmada', 'badge-orange'],
        seated: ['Sentada', 'badge-green'],
        completed: ['Completada', 'badge-teal'],
        cancelled: ['Cancelada', 'badge-gray'],
        no_show: ['No Show', 'badge-red'],
    };
    const [label, cls] = map[status] || [status, 'badge-gray'];
    return `<span class="badge ${cls}">${label}</span>`;
}

function sourceBadge(source) {
    const map = {
        phone: ['Tel.', 'badge-blue'],
        whatsapp: ['WhatsApp', 'badge-green'],
        walk_in: ['Walk-in', 'badge-purple'],
        web: ['Web', 'badge-teal'],
    };
    const [label, cls] = map[source] || [source, 'badge-gray'];
    return `<span class="badge ${cls}">${label}</span>`;
}

function zoneName(zone) {
    const map = {
        exterior: 'Exterior',
        salon_principal: 'Sal. Principal',
        salon_interior: 'Sal. Interior',
    };
    return map[zone] || zone;
}

// Actualizar fecha automaticamente cada dia
setInterval(() => {
    const newDate = (() => {
        const d = new Date();
        return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    })();
    if (newDate !== currentDate) {
        currentDate = newDate;
        document.getElementById('datePicker').value = currentDate;
        updateDateDisplay();
        refreshAll();
    }
}, 60000); // Verificar cada minuto

// Enter para enviar formularios
document.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
        const modal = document.querySelector('.modal.active, [role="dialog"]:not([hidden])');
        if (modal) {
            const form = modal.querySelector('form');
            const submitBtn = modal.querySelector('button[type="submit"]');
            if (form) form.dispatchEvent(new Event('submit'));
            if (submitBtn) submitBtn.click();
        }
    }
});
