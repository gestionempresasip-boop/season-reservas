/* ═══════════════════════════════════════════════
   SEASON - Agenda / Month Calendar
   ═══════════════════════════════════════════════ */

let agendaMonth = new Date();          // first day of visible month
agendaMonth.setDate(1);
agendaMonth.setHours(12, 0, 0, 0);

let agendaSelectedDate = _todayStr();  // selected day (YYYY-MM-DD)
let agendaCache = {};                  // key: 'YYYY-MM' → array of day objects

function _todayStr() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

function _dateStr(d) {
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
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

// ── Load ────────────────────────────────────────

async function loadCalendar(forceRefresh) {
    const key = agendaMonth.getFullYear() + '-' + String(agendaMonth.getMonth()+1).padStart(2,'0');

    if (!agendaCache[key] || forceRefresh) {
        // Fetch the whole month + padding days (up to 42 days starting from first Mon before month start)
        const firstDay = new Date(agendaMonth);
        // Go back to Monday of the week containing the 1st
        const dow = firstDay.getDay(); // 0=Sun
        const offset = (dow === 0) ? 6 : dow - 1;
        firstDay.setDate(firstDay.getDate() - offset);

        const lastDay = new Date(agendaMonth);
        lastDay.setMonth(lastDay.getMonth() + 1);
        lastDay.setDate(0); // last day of month
        const lastDow = lastDay.getDay();
        const endOffset = (lastDow === 0) ? 0 : 7 - lastDow;
        lastDay.setDate(lastDay.getDate() + endOffset);

        const days = Math.round((lastDay - firstDay) / 86400000) + 1;

        const from = _dateStr(firstDay);
        const to = _dateStr(lastDay);
        try {
            const data = await apiGet(`/api/reports/range?from=${from}&to=${to}`);
            agendaCache[key] = { data, from };
        } catch (e) {
            console.warn('Error cargando agenda:', e);
            return;
        }
    }

    renderMonthCalendar(agendaCache[key]);
    renderDayDetail(agendaSelectedDate);
}

// ── Render month grid ────────────────────────────

function renderMonthCalendar({ data, from }) {
    const today = _todayStr();
    const monthName = agendaMonth.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    document.getElementById('agendaMonthLabel').textContent =
        monthName.charAt(0).toUpperCase() + monthName.slice(1);

    const grid = document.getElementById('agendaMonthGrid');
    if (!grid) return;

    const currentMonthNum = agendaMonth.getMonth();
    const currentYear = agendaMonth.getFullYear();

    grid.innerHTML = data.map(d => {
        const dateObj = new Date(d.date + 'T12:00:00');
        const isCurrentMonth = dateObj.getMonth() === currentMonthNum && dateObj.getFullYear() === currentYear;
        const isToday = d.date === today;
        const isSelected = d.date === agendaSelectedDate;
        const hasComida = d.comida?.count > 0;
        const hasCena = d.cena?.count > 0;

        const classes = [
            'agenda-day',
            isCurrentMonth ? '' : 'agenda-day-other',
            isToday ? 'agenda-day-today' : '',
            isSelected ? 'agenda-day-selected' : '',
            d.reservations > 0 ? 'agenda-day-busy' : '',
        ].filter(Boolean).join(' ');

        return `
        <div class="${classes}" data-date="${d.date}" onclick="selectAgendaDay('${d.date}')">
            <span class="agenda-day-num">${dateObj.getDate()}</span>
            <div class="agenda-day-dots">
                ${hasComida ? `<span class="agenda-dot agenda-dot-comida" title="${d.comida.count} comidas"></span>` : ''}
                ${hasCena ? `<span class="agenda-dot agenda-dot-cena" title="${d.cena.count} cenas"></span>` : ''}
            </div>
        </div>`;
    }).join('');
}

// ── Select a day ────────────────────────────────

function selectAgendaDay(dateStr) {
    agendaSelectedDate = dateStr;

    // Sync with the global app date
    if (typeof currentDate !== 'undefined' && currentDate !== dateStr) {
        currentDate = dateStr;
        const picker = document.getElementById('datePicker');
        if (picker) picker.value = dateStr;
        if (typeof updateDateDisplay === 'function') updateDateDisplay();
        // Don't call refreshAll() — that would reload everything; just update the display
    }

    // Re-highlight selected cell
    document.querySelectorAll('.agenda-day').forEach(el => {
        el.classList.toggle('agenda-day-selected', el.dataset.date === dateStr);
    });

    renderDayDetail(dateStr);
}

// ── Render day detail panel ──────────────────────

function renderDayDetail(dateStr) {
    const panel = document.getElementById('agendaDayDetail');
    if (!panel) return;

    // Find the day data in cache
    const key = dateStr.substring(0, 7);
    const cached = agendaCache[key];
    if (!cached) {
        panel.innerHTML = `<div class="agenda-day-detail-empty">Toca un día para ver sus reservas</div>`;
        return;
    }

    const day = cached.data.find(d => d.date === dateStr);
    if (!day) {
        panel.innerHTML = `<div class="agenda-day-detail-empty">Sin datos para este día</div>`;
        return;
    }

    const dateObj = new Date(dateStr + 'T12:00:00');
    const dayLabel = dateObj.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const labelCapitalized = dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1);

    let html = `
    <div class="agenda-detail-header">
        <span class="agenda-detail-date">${labelCapitalized}</span>
        <button class="btn-primary btn-sm" onclick="openNewReservationModal()">+ Reserva</button>
    </div>`;

    if (day.reservations === 0) {
        html += `<div class="agenda-detail-empty">Sin reservas este día</div>`;
    } else {
        html += `<div class="agenda-detail-summary">${day.reservations} reserva${day.reservations>1?'s':''} · ${day.guests} comensal${day.guests>1?'es':''}</div>`;

        if (day.comida?.count > 0) {
            html += `
            <div class="agenda-shift-block">
                <div class="agenda-shift-title agenda-shift-comida">☀️ COMIDA · ${day.comida.count} res · ${day.comida.guests}p</div>
                ${day.comida.items.map(r => renderAgendaResRow(r)).join('')}
            </div>`;
        }
        if (day.cena?.count > 0) {
            html += `
            <div class="agenda-shift-block">
                <div class="agenda-shift-title agenda-shift-cena">🌙 CENA · ${day.cena.count} res · ${day.cena.guests}p</div>
                ${day.cena.items.map(r => renderAgendaResRow(r)).join('')}
            </div>`;
        }
    }

    panel.innerHTML = html;
}

function renderAgendaResRow(r) {
    const statusColor = { confirmed: '#f59e0b', seated: '#22c55e', completed: '#9ca3af', cancelled: '#ef4444', no_show: '#ef4444' };
    const color = statusColor[r.status] || '#9ca3af';
    return `
    <div class="agenda-res-row" onclick="openEditReservation(${r.id})" style="cursor:pointer">
        <span class="agenda-res-dot" style="background:${color}"></span>
        <span class="agenda-res-time">${r.time}</span>
        <span class="agenda-res-name">${r.client_name}</span>
        <span class="agenda-res-guests">${r.guests}p${r.table_number ? ' · M'+r.table_number : ''}</span>
    </div>`;
}

// Legacy — kept for compatibility
function viewDayReservationDetail(resId) {
    if (typeof openEditReservation === 'function') openEditReservation(resId);
}
