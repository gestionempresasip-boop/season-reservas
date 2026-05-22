/* ═══════════════════════════════════════════════
   SEASON - Weekly Calendar / Agenda
   ═══════════════════════════════════════════════ */

let calendarWeekStart = getMonday(new Date());

function getMonday(d) {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    date.setDate(diff);
    return date;
}

function initCalendarNav() {
    document.getElementById('prevWeek')?.addEventListener('click', () => {
        calendarWeekStart.setDate(calendarWeekStart.getDate() - 7);
        loadCalendar();
    });
    document.getElementById('nextWeek')?.addEventListener('click', () => {
        calendarWeekStart.setDate(calendarWeekStart.getDate() + 7);
        loadCalendar();
    });
}

initCalendarNav();

async function loadCalendar() {
    const from = calendarWeekStart.toISOString().split('T')[0];
    const data = await apiGet(`/api/reports/weekly?from=${from}`);
    renderCalendar(data);
}

function renderCalendar(days) {
    const grid = document.getElementById('calendarGrid');
    const today = new Date().toISOString().split('T')[0];
    const dayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

    const endDate = new Date(calendarWeekStart);
    endDate.setDate(endDate.getDate() + 6);
    document.getElementById('weekRange').textContent =
        `${calendarWeekStart.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} - ${endDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}`;

    grid.innerHTML = days.map((d, i) => {
        const isToday = d.date === today;
        const dateObj = new Date(d.date + 'T12:00:00');
        const dayOfWeek = dateObj.getDay(); // 0 = Sunday, 1 = Monday, etc.
        const dayNameCorrect = dayNames[(dayOfWeek + 6) % 7]; // Convert to 0 = Monday
        const comida = d.comida || { count: 0, guests: 0, items: [] };
        const cena = d.cena || { count: 0, guests: 0, items: [] };

        return `
            <div class="calendar-day ${isToday ? 'today' : ''} ${d.reservations > 0 ? 'has-reservations' : ''}">
                <div class="calendar-day-header">${dayNameCorrect}</div>
                <div class="calendar-day-number">${dateObj.getDate()}</div>

                ${d.reservations > 0 ? `
                    <div class="calendar-summary">
                        <span>${d.reservations} reservas</span> · <span>${d.guests} comensales</span>
                    </div>

                    ${comida.count > 0 ? `
                        <div class="calendar-shift-section">
                            <div class="shift-header comida-header">
                                <span>COMIDA</span>
                                <span>${comida.count} res · ${comida.guests}p</span>
                            </div>
                            ${comida.items.map(r => renderCalendarReservation(r)).join('')}
                        </div>
                    ` : ''}

                    ${cena.count > 0 ? `
                        <div class="calendar-shift-section">
                            <div class="shift-header cena-header">
                                <span>CENA</span>
                                <span>${cena.count} res · ${cena.guests}p</span>
                            </div>
                            ${cena.items.map(r => renderCalendarReservation(r)).join('')}
                        </div>
                    ` : ''}
                ` : `<div style="font-size:12px; color:#9ca3af; text-align:center; margin-top:10px;">Sin reservas</div>`}
            </div>
        `;
    }).join('');
}

function renderCalendarReservation(r) {
    const statusIcon = {
        confirmed: '<span style="color:#f59e0b;">&#9679;</span>',
        seated: '<span style="color:#22c55e;">&#9679;</span>',
        completed: '<span style="color:#6b7280;">&#9679;</span>',
        cancelled: '<span style="color:#ef4444;">&#9679;</span>',
        no_show: '<span style="color:#ef4444;">&#9679;</span>',
    };
    return `
        <div class="calendar-reservation" onclick="viewDayReservationDetail(${r.id})">
            <div class="cal-res-row">
                ${statusIcon[r.status] || ''}
                <span class="cal-res-time">${r.time}</span>
                <span class="cal-res-name">${r.client_name.length > 14 ? r.client_name.substring(0, 13) + '..' : r.client_name}</span>
            </div>
            <div class="cal-res-detail">
                ${r.guests}p${r.table_number ? ' · M' + r.table_number : ''}${r.notes ? ' · ' + (r.notes.length > 15 ? r.notes.substring(0, 14) + '..' : r.notes) : ''}
            </div>
        </div>
    `;
}

function viewDayReservationDetail(resId) {
    // Intentar abrir el editor de reserva
    if (typeof openEditReservation === 'function') {
        openEditReservation(resId);
    }
}
