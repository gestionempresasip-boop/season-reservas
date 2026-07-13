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
    // Auto-refresh: desktop 3min, mobile 5min (backend now caches 15-30s so polling less is fine)
    const refreshInterval = isMobile ? 300000 : 180000;
    setInterval(refreshAll, refreshInterval);
});

// ── SocketIO Tiempo Real ────────────────────────

let socket = null;
let connectionAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;

function initSocketIO() {
    if (typeof io === 'undefined' || isMobile) return; // Skip SocketIO on mobile (too heavy)

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


// Debounced refresh — coalesces rapid socket events and post-action syncs
let _refreshTimer = null;
function debouncedRefresh(delay = 400) {
    if (_refreshTimer) clearTimeout(_refreshTimer);
    _refreshTimer = setTimeout(() => { refreshAll(); }, delay);
}

// Quick optimistic list removal — removes reservation from DOM and allReservations without waiting for server
function optimisticRemove(resId) {
    if (typeof allReservations !== 'undefined') {
        allReservations = allReservations.filter(r => r.id !== resId);
    }
    // Remove from reservation list DOM immediately
    const card = document.querySelector(`[data-id="${resId}"]`);
    if (card) {
        card.style.transition = 'opacity 0.15s';
        card.style.opacity = '0';
        setTimeout(() => card.remove(), 150);
    }
    // Remove from agenda cards
    const agendaCard = document.querySelector(`.agenda-res-card[data-id="${resId}"]`);
    if (agendaCard) {
        agendaCard.style.transition = 'opacity 0.15s';
        agendaCard.style.opacity = '0';
        setTimeout(() => agendaCard.remove(), 150);
    }
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
    const shortLabel = isToday
        ? `HOY · ${d.getDate()} ${months[d.getMonth()]}`
        : `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;

    const display = document.getElementById('dateDisplay');
    if (display) display.textContent = shortLabel;

    // Keep any in-view date labels in sync
    ['toolbarDateLabel', 'reservasDateLabel', 'dayViewDateLabel'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = shortLabel;
    });
}

function changeDay(delta) {
    const d = new Date(currentDate + 'T12:00:00');
    d.setDate(d.getDate() + delta);
    currentDate = d.toISOString().split('T')[0];
    document.getElementById('datePicker').value = currentDate;
    updateDateDisplay();
    refreshAll();
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

// Track last-loaded timestamp per view to skip redundant fetches
const _viewLastLoaded = {};
const VIEW_STALE_MS = 20000; // re-fetch only if data > 20s old

function initNavigation() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const viewId = btn.dataset.view;
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
            document.getElementById(viewId).classList.add('active');

            const now = Date.now();
            const fresh = (now - (_viewLastLoaded[viewId] || 0)) < VIEW_STALE_MS;

            if (viewId === 'viewReservas') {
                // Use in-memory data if fresh — no network round-trip
                if (fresh && typeof allReservations !== 'undefined' && allReservations.length >= 0) {
                    if (typeof renderReservationsList === 'function') renderReservationsList(allReservations);
                } else {
                    loadReservationsList();
                }
                _viewLastLoaded[viewId] = now;
            }
            if (viewId === 'viewEspera') { if (!fresh) loadWaitlist(); _viewLastLoaded[viewId] = now; }
            if (viewId === 'viewClientes') { if (!fresh) loadClientsList(); _viewLastLoaded[viewId] = now; }
            if (viewId === 'viewAgenda') { if (!fresh) loadCalendar(); _viewLastLoaded[viewId] = now; }
            if (viewId === 'viewInformes') initReportDates();
            if (viewId === 'viewAjustes' && typeof loadUsersPanel === 'function') loadUsersPanel();
        });
    });
}

// ── Refresh ─────────────────────────────────────

async function refreshAll() {
    let dashboardLoaded = false;
    let lastError = null;

    // ── PRIMARY: Load dashboard (single retry, never throws) ────────────
    try {
        const data = await apiGet(`/api/dashboard?date=${currentDate}&shift=${currentShift}`);

        if (data && data.stats) {
            document.getElementById('statReservas').textContent = data.stats.reservations;
            document.getElementById('statComensales').textContent = data.stats.guests;
            document.getElementById('statOcupacion').textContent = data.stats.occupancy + '%';
            document.getElementById('statSentadas').textContent = data.stats.seated;
            document.getElementById('statPendientes').textContent = data.stats.pending;
        }

        if (data && data.tables) {
            tableDataMap = {};
            data.tables.forEach(t => { tableDataMap[t.number] = t; });

            // Procesar reservas sin mesa asignada para mostrarlas en el plano
            if (data.reservations) {
                const unassignedReservations = data.reservations.filter(
                    r => !r.table_id && (r.status === 'confirmed' || r.status === 'seated')
                );
                if (unassignedReservations.length > 0) {
                    tableDataMap._unassigned = {
                        unassignedReservations: unassignedReservations
                    };
                }
            }

            if (typeof renderFloorPlan === 'function') renderFloorPlan();
        }

        if (data && data.reservations && typeof allReservations !== 'undefined') {
            allReservations = data.reservations;
        }

        // Always refresh the floor-plan reservation panel (both shifts)
        loadFpResPanel().catch(e => console.warn('FP res panel:', e?.message));

        dashboardLoaded = true;
        // If banner was visible, hide it now
        document.querySelectorAll('[data-error="connection"]').forEach(el => el.remove());
    } catch (e) {
        lastError = e;
        console.warn('Dashboard fetch falló:', e?.message || e);
    }

    // ── SECONDARY: Refresh active view (errors ignored, never trigger banner)
    try {
        const active = document.querySelector('.view.active');
        if (active) {
            if (active.id === 'viewReservas' && typeof renderReservationsList === 'function' && typeof allReservations !== 'undefined') {
                renderReservationsList(allReservations);
            } else if (active.id === 'viewEspera' && typeof loadWaitlist === 'function') {
                loadWaitlist().catch(e => console.warn('Waitlist refresh:', e?.message));
            } else if (active.id === 'viewClientes' && typeof loadClientsList === 'function') {
                loadClientsList().catch(e => console.warn('Clientes refresh:', e?.message));
            } else if (active.id === 'viewAgenda' && typeof loadCalendar === 'function') {
                loadCalendar().catch(e => console.warn('Calendar refresh:', e?.message));
            }
            // Pending panel only when floor plan is visible
            if (active.id === 'viewPlano' && typeof loadFloorPlanPending === 'function') {
                loadFloorPlanPending().catch(e => console.warn('FP pending refresh:', e?.message));
            }
            if (active.id === 'viewPlano') {
                loadFpResPanel().catch(e => console.warn('FP res panel retry:', e?.message));
            }
        }
    } catch (e) {
        // Secondary errors must NEVER show the connection banner
        console.warn('View refresh secondario:', e?.message || e);
    }

    // Only show connection error if primary dashboard FAILED
    if (!dashboardLoaded) {
        console.error('❌ Refresh principal falló:', lastError?.message || lastError);
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

let _toastTimer = null;
function showToast(msg, type = '') {
    // Errors go to the blocking popup
    if (type === 'error' && typeof showAdminPopup === 'function') {
        showAdminPopup(msg, '❌');
        return;
    }
    const icons = { success: '✓', warning: '⚠️', '': 'ℹ️' };
    const toast = document.getElementById('toast');
    document.getElementById('toastIcon').textContent = icons[type] || 'ℹ️';
    document.getElementById('toastMsg').textContent  = msg;
    toast.className = 'toast ' + type;
    if (_toastTimer) clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => toast.classList.add('hidden'), 3000);
}

// ── API Helpers ──────────────────────────────────

// ── API Functions with Retry Logic ──────────────

const MAX_RETRIES = 1;       // Un reintento es suficiente para operaciones rápidas
const RETRY_DELAY = 400;
const API_TIMEOUT = 10000;  // 10s timeout (el cold start ya pasó después de iniciar)

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

function _handle401(res) {
    if (res.status === 401 && typeof showLoginScreen === 'function') {
        showLoginScreen();
        throw new Error('Sesión caducada — vuelve a iniciar sesión');
    }
}

async function apiGet(url) {
    return withRetry(async () => {
        const res = await fetch(API + url, { signal: createTimeout(API_TIMEOUT) });
        _handle401(res);
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
        _handle401(res);
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
        _handle401(res);
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error || `HTTP ${res.status}`);
        }
        return res.json();
    });
}

async function apiDelete(url) {
    return withRetry(async () => {
        const res = await fetch(API + url, {
            method: 'DELETE',
            signal: createTimeout(API_TIMEOUT)
        });
        _handle401(res);
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error || `HTTP ${res.status}`);
        }
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
        ext: 'Exterior',
        salon_principal: 'Sal. Principal',
        sp: 'Sal. Principal',
        salon_interior: 'Sal. Interior',
        si: 'Sal. Interior',
    };
    return map[zone] || zone || '—';
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

// ── Floor Plan: Reservations Side Panel ─────────────────
// Loads BOTH shifts for the day and shows confirmed reservations with "Sentar" button.

async function loadFpResPanel() {
    try {
        const data = await apiGet(`/api/reservations/day?date=${currentDate}`);
        const comida = data.comida || [];
        const cena   = data.cena   || [];

        // Desktop side panel
        _renderFpList(comida, 'fpResComidaList', 'fpResComidaCount');
        _renderFpList(cena,   'fpResCenaList',   'fpResCenaCount');

        // Mobile bottom sheet
        _renderFpList(comida, 'fpBsComidaList', 'fpBsComidaCount');
        _renderFpList(cena,   'fpBsCenaList',   'fpBsCenaCount');

        // Update total badge on bottom sheet handle
        const total = [...comida, ...cena].filter(r => r.status === 'confirmed').length;
        const bsBadge = document.getElementById('fpBsTotalCount');
        if (bsBadge) bsBadge.textContent = total;
    } catch(e) {
        console.warn('FP res panel load error:', e?.message);
    }
}

function toggleFpBottomSheet() {
    document.getElementById('fpBottomSheet')?.classList.toggle('fp-bs-open');
}

function _renderFpList(reservations, listId, countId) {
    const list    = document.getElementById(listId);
    const countEl = document.getElementById(countId);
    if (!list) return;

    const pending = [...reservations]
        .filter(r => r.status === 'confirmed')
        .sort((a, b) => (a.time || '').localeCompare(b.time || ''));

    if (countEl) countEl.textContent = pending.length;

    if (pending.length === 0) {
        list.innerHTML = '<div class="fp-res-empty">Sin reservas pendientes</div>';
        return;
    }

    list.innerHTML = pending.map(r => {
        const tableLabel = r.table_numbers && r.table_numbers.length
            ? 'Mesa ' + r.table_numbers.join('+')
            : '<span style="color:#f59e0b">Sin mesa</span>';

        return `<div class="fp-res-row" data-res-id="${r.id}">
            <span class="fp-res-time">${r.time || '--:--'}</span>
            <div class="fp-res-info">
                <div class="fp-res-name">${_esc(r.client_name || 'Sin nombre')}</div>
                <div class="fp-res-meta">${r.guests}p · ${tableLabel}</div>
            </div>
            <button class="fp-res-btn-seat" onclick="fpSeatReservation(${r.id},this)">Sentar</button>
        </div>`;
    }).join('');
}

async function fpSeatReservation(resId, btn) {
    btn.disabled = true;
    btn.textContent = '…';

    // Capture DOM references BEFORE detaching the row
    const row     = btn.closest('.fp-res-row');
    const list    = btn.closest('.fp-res-list');
    const section = list ? list.closest('.fp-res-shift-section') : null;
    const countEl = section ? section.querySelector('.fp-res-shift-count') : null;

    // Remove row and update count immediately
    if (row) row.remove();
    if (countEl) countEl.textContent = Math.max(0, (parseInt(countEl.textContent) || 1) - 1);
    if (list && !list.querySelector('.fp-res-row')) {
        list.innerHTML = '<div class="fp-res-empty">Sin reservas pendientes</div>';
    }
    // Update bottom sheet total badge
    const bsBadge = document.getElementById('fpBsTotalCount');
    if (bsBadge) bsBadge.textContent = Math.max(0, (parseInt(bsBadge.textContent) || 1) - 1);

    // Turn table green on the floor plan immediately
    if (typeof _applyOptimistic === 'function') _applyOptimistic(resId, 'seated');
    if (typeof showToast === 'function') showToast('Mesa sentada ✓', 'success');

    try {
        await apiPut(`/api/reservations/${resId}/seat`);
    } catch (e) {
        if (typeof showToast === 'function') showToast('Error al sentar', 'error');
    }
    debouncedRefresh();
}

function _esc(str) {
    const d = document.createElement('div'); d.textContent = str; return d.innerHTML;
}

// ── Validación horaria ────────────────────────────────────
// Reglas:
//   > 16:00  + turno COMIDA → walk-in bloqueado (comida cerrada, avisar cambiar a CENA)
//   > 22:30              → todo bloqueado (restaurante cerrado)

const CIERRE_COMIDA_MIN = 16 * 60;       // 16:00
const CIERRE_CENA_MIN   = 22 * 60 + 30; // 22:30

function _minutoActual() {
    const n = new Date(); return n.getHours() * 60 + n.getMinutes();
}

function _popupHorario(icono, titulo, msg) {
    document.getElementById('modalHorarioIcon').textContent  = icono;
    document.getElementById('modalHorarioTitle').textContent = titulo;
    document.getElementById('modalHorarioMsg').textContent   = msg;
    openModal('modalHorarioCerrado');
}

// ── Helpers de guardia horaria (usados también desde floorplan.js) ──────────

// Devuelve true si walk-in está permitido; muestra popup y devuelve false si no
function _walkInGuard() {
    const m = _minutoActual();
    if (m > CIERRE_CENA_MIN) {
        _popupHorario('🌙', 'Restaurante cerrado',
            'Son más de las 22:30 h. El servicio de hoy ha terminado.\nPuedes registrar reservas para días futuros desde la sección Reservas.');
        return false;
    }
    if (m > CIERRE_COMIDA_MIN && currentShift === 'comida') {
        _popupHorario('🍽️', 'Servicio de comida cerrado',
            'Estás en el turno de COMIDA pero ya son más de las 16:00 h.\nCambia el turno a CENA (botón arriba) para hacer un walk-in de cena.');
        return false;
    }
    return true;
}

// Devuelve true si nueva reserva está permitida; muestra popup y devuelve false si no
function _reservationGuard() {
    const m = _minutoActual();
    if (m > CIERRE_CENA_MIN) {
        _popupHorario('🌙', 'Restaurante cerrado',
            'Son más de las 22:30 h. El servicio de hoy ha terminado.\nPuedes registrar reservas para días futuros.');
        return false;
    }
    return true;
}

// Guarda para Walk-in — llamada directamente desde los botones HTML
function guardedWalkIn() {
    if (_walkInGuard()) openWalkInModal();
}

// Guarda para Nueva Reserva — llamada directamente desde los botones HTML
function guardedNewReservation(tableIds) {
    if (_reservationGuard()) openNewReservationModal(tableIds);
}
