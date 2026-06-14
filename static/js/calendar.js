/* ═══════════════════════════════════════════════
   SEASON - Agenda / Month Calendar (v2)
   ═══════════════════════════════════════════════ */

let agendaMonth = new Date();
agendaMonth.setDate(1);
agendaMonth.setHours(12, 0, 0, 0);

let agendaSelectedDate = _todayStr();
let agendaCache = {};
let _pendingOpen = true;

function _todayStr() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}
function _dateStr(d) {
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}
function _shortDate(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    const days = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
    const months = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
    return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`;
}

// ── Init ────────────────────────────────────────

function initCalendarNav() {
    document.getElementById('agendaPrevMonth')?.addEventListener('click', () => {
        agendaMonth.setMonth(agendaMonth.getMonth() - 1);
        loadCalendar();
    });
    document.getElementById('agendaNextMonth')?.addEventListener('click', () => {
        agendaMonth.setMonth(agendaMonth.getMonth() + 1);
        loadCalendar();
    });
    document.getElementById('agendaTodayBtn')?.addEventListener('click', () => {
        agendaMonth = new Date();
        agendaMonth.setDate(1);
        agendaMonth.setHours(12, 0, 0, 0);
        agendaSelectedDate = _todayStr();
        loadCalendar(true);
    });
}
initCalendarNav();

// ── Pending unassigned section ───────────────────

async function loadPendingUnassigned() {
    try {
        const data = await apiGet('/api/reservations/unassigned');
        const section = document.getElementById('agendaPendingSection');
        const list    = document.getElementById('agendaPendingList');
        const count   = document.getElementById('agendaPendingCount');
        const plural  = document.getElementById('agendaPendingS');
        if (!section || !list) return;

        if (!data || data.length === 0) {
            section.style.display = 'none';
            return;
        }

        section.style.display = 'block';
        count.textContent = data.length;
        plural.textContent = data.length === 1 ? '' : 's';

        list.innerHTML = data.map(r => {
            const turno = r.shift === 'comida' ? '☀️ Comida' : '🌙 Cena';
            const safeName = (r.client_name || '').replace(/'/g, "\\'");
            return `
            <div class="agenda-pending-card" onclick="selectAgendaDay('${r.date}')">
                <div class="agenda-pending-card-date">${_shortDate(r.date)}</div>
                <div class="agenda-pending-card-info">
                    <div class="agenda-pending-card-name">${r.client_name}</div>
                    <div class="agenda-pending-card-meta">${turno} · ${r.time} · ${r.guests}p${r.notes ? ' · ' + r.notes : ''}</div>
                </div>
                <button class="agenda-pending-assign-btn" onclick="event.stopPropagation(); openEditReservation(${r.id})">Asignar mesa</button>
            </div>`;
        }).join('');
    } catch(e) {
        console.warn('Error cargando pendientes:', e);
    }
}

function togglePendingSection() {
    _pendingOpen = !_pendingOpen;
    const list   = document.getElementById('agendaPendingList');
    const toggle = document.getElementById('agendaPendingToggle');
    if (list)   list.style.display   = _pendingOpen ? '' : 'none';
    if (toggle) toggle.classList.toggle('collapsed', !_pendingOpen);
}

// ── Load month ───────────────────────────────────

async function loadCalendar(forceRefresh) {
    const key = agendaMonth.getFullYear() + '-' + String(agendaMonth.getMonth()+1).padStart(2,'0');

    if (!agendaCache[key] || forceRefresh) {
        const firstDay = new Date(agendaMonth);
        const dow = firstDay.getDay();
        const offset = (dow === 0) ? 6 : dow - 1;
        firstDay.setDate(firstDay.getDate() - offset);

        const lastDay = new Date(agendaMonth);
        lastDay.setMonth(lastDay.getMonth() + 1);
        lastDay.setDate(0);
        const lastDow = lastDay.getDay();
        const endOffset = (lastDow === 0) ? 0 : 7 - lastDow;
        lastDay.setDate(lastDay.getDate() + endOffset);

        const from = _dateStr(firstDay);
        const to   = _dateStr(lastDay);
        try {
            const data = await apiGet(`/api/reports/range?from=${from}&to=${to}`);
            agendaCache[key] = { data, from };
        } catch(e) {
            console.warn('Error cargando agenda:', e);
            return;
        }
    }

    renderMonthCalendar(agendaCache[key]);
    renderDayDetail(agendaSelectedDate);
    loadPendingUnassigned();
}

// ── Render compact month grid ────────────────────

function renderMonthCalendar({ data }) {
    const today = _todayStr();
    const monthName = agendaMonth.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    document.getElementById('agendaMonthLabel').textContent =
        monthName.charAt(0).toUpperCase() + monthName.slice(1);

    const grid = document.getElementById('agendaMonthGrid');
    if (!grid) return;

    const currentMonthNum = agendaMonth.getMonth();
    const currentYear     = agendaMonth.getFullYear();

    grid.innerHTML = data.map(d => {
        const dateObj = new Date(d.date + 'T12:00:00');
        const isCurrentMonth = dateObj.getMonth() === currentMonthNum && dateObj.getFullYear() === currentYear;
        const isToday    = d.date === today;
        const isSelected = d.date === agendaSelectedDate;
        const hasComida  = d.comida?.count > 0;
        const hasCena    = d.cena?.count > 0;

        const classes = [
            'agenda-day',
            isCurrentMonth ? '' : 'agenda-day-other',
            isToday    ? 'agenda-day-today'    : '',
            isSelected ? 'agenda-day-selected' : '',
        ].filter(Boolean).join(' ');

        return `
        <div class="${classes}" data-date="${d.date}" onclick="selectAgendaDay('${d.date}')">
            <span class="agenda-day-num">${dateObj.getDate()}</span>
            <div class="agenda-day-dots">
                ${hasComida ? `<span class="agenda-dot agenda-dot-comida"></span>` : ''}
                ${hasCena   ? `<span class="agenda-dot agenda-dot-cena"></span>`   : ''}
            </div>
        </div>`;
    }).join('');
}

// ── Select a day ─────────────────────────────────

function selectAgendaDay(dateStr) {
    agendaSelectedDate = dateStr;

    if (typeof currentDate !== 'undefined' && currentDate !== dateStr) {
        currentDate = dateStr;
        const picker = document.getElementById('datePicker');
        if (picker) picker.value = dateStr;
        if (typeof updateDateDisplay === 'function') updateDateDisplay();
    }

    document.querySelectorAll('.agenda-day').forEach(el => {
        el.classList.toggle('agenda-day-selected', el.dataset.date === dateStr);
    });

    // If the date is in a different month, navigate there
    const d = new Date(dateStr + 'T12:00:00');
    if (d.getMonth() !== agendaMonth.getMonth() || d.getFullYear() !== agendaMonth.getFullYear()) {
        agendaMonth = new Date(d);
        agendaMonth.setDate(1);
        agendaMonth.setHours(12,0,0,0);
        loadCalendar();
        return;
    }

    renderDayDetail(dateStr);
}

// ── Render day detail with cards ─────────────────

function renderDayDetail(dateStr) {
    const panel = document.getElementById('agendaDayDetail');
    if (!panel) return;

    const key    = dateStr.substring(0, 7);
    const cached = agendaCache[key];
    if (!cached) {
        panel.innerHTML = `<div class="agenda-day-detail-empty">Selecciona un día</div>`;
        return;
    }

    const day = cached.data.find(d => d.date === dateStr);
    if (!day) {
        panel.innerHTML = `<div class="agenda-day-detail-empty">Sin datos para este día</div>`;
        return;
    }

    const dateObj  = new Date(dateStr + 'T12:00:00');
    const dayLabel = dateObj.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

    let html = `
    <div class="agenda-detail-header">
        <span class="agenda-detail-date">${dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1)}</span>
        <button class="btn-primary btn-sm" onclick="openNewReservationModal()">+ Reserva</button>
    </div>`;

    if (day.reservations === 0) {
        html += `<div class="agenda-detail-empty">Sin reservas este día</div>`;
    } else {
        html += `<div class="agenda-detail-summary">${day.reservations} reserva${day.reservations>1?'s':''} · ${day.guests} comensal${day.guests>1?'es':''}</div>`;

        if (day.comida?.count > 0) {
            html += `<div class="agenda-shift-block">
                <div class="agenda-shift-title agenda-shift-comida">☀️ COMIDA · ${day.comida.count} res · ${day.comida.guests}p</div>
                ${day.comida.items.map(r => renderAgendaCard(r)).join('')}
            </div>`;
        }
        if (day.cena?.count > 0) {
            html += `<div class="agenda-shift-block">
                <div class="agenda-shift-title agenda-shift-cena">🌙 CENA · ${day.cena.count} res · ${day.cena.guests}p</div>
                ${day.cena.items.map(r => renderAgendaCard(r)).join('')}
            </div>`;
        }
    }

    panel.innerHTML = html;
}

function renderAgendaCard(r) {
    const statusColor = {
        confirmed: '#f59e0b', seated: '#22c55e', completed: '#9ca3af',
        cancelled: '#ef4444', no_show: '#ef4444', pending: '#f59e0b'
    };
    const color      = statusColor[r.status] || '#9ca3af';
    const badgeClass = `badge-${r.status}`;
    const safeName   = (r.client_name || '').replace(/'/g, "\\'");
    const tableInfo  = r.table_number ? `Mesa ${r.table_number}` : '<span style="color:#f59e0b;font-weight:600;">Sin mesa</span>';
    const phone      = r.client_phone ? `· ${r.client_phone}` : '';

    return `
    <div class="agenda-res-card" onclick="openEditReservation(${r.id})">
        <span class="agenda-res-dot" style="background:${color}"></span>
        <div class="agenda-res-body">
            <div class="agenda-res-top">
                <span class="agenda-res-time">${r.time}</span>
                <span class="agenda-res-name">${r.client_name}</span>
                <span class="agenda-res-badge ${badgeClass}">${_statusLabel(r.status)}</span>
            </div>
            <div class="agenda-res-meta">
                <span>👥 ${r.guests}p</span>
                <span>${tableInfo}</span>
                <span>${phone}</span>
            </div>
        </div>
        <div class="agenda-res-actions" onclick="event.stopPropagation()">
            <button class="agenda-res-btn" onclick="openEditReservation(${r.id})" title="Editar">✎</button>
            <button class="agenda-res-btn btn-cancel" onclick="agendaCancelRes(${r.id}, '${safeName}')" title="Cancelar">✗</button>
            <button class="agenda-res-btn btn-delete" onclick="agendaDeleteRes(${r.id}, '${safeName}')" title="Eliminar">🗑</button>
        </div>
    </div>`;
}

function _statusLabel(status) {
    return { confirmed:'Confirmada', seated:'Sentada', completed:'Completada', cancelled:'Cancelada', no_show:'No show', pending:'Pendiente' }[status] || status;
}

// ── Quick actions from agenda ────────────────────

async function agendaCancelRes(resId, name) {
    if (!confirm(`¿Cancelar la reserva de ${name}?`)) return;
    try {
        await apiPut(`/api/reservations/${resId}`, { status: 'cancelled' });
        showToast('Reserva cancelada');
        agendaCache = {};
        loadCalendar(true);
        refreshAll();
    } catch(e) {
        showToast('Error al cancelar', 'error');
    }
}

async function agendaDeleteRes(resId, name) {
    if (!confirm(`¿Eliminar definitivamente la reserva de ${name}?`)) return;
    try {
        await apiDelete(`/api/reservations/${resId}/delete`);
        showToast('Reserva eliminada');
        agendaCache = {};
        loadCalendar(true);
        refreshAll();
    } catch(e) {
        showToast('Error al eliminar', 'error');
    }
}

// Legacy
function viewDayReservationDetail(resId) {
    if (typeof openEditReservation === 'function') openEditReservation(resId);
}
