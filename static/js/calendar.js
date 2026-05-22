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
        return `
            <div class="calendar-day ${isToday ? 'today' : ''} ${d.reservations > 0 ? 'has-reservations' : ''}"
                 onclick="viewDayReservations('${d.date}')"
                 style="cursor: ${d.reservations > 0 ? 'pointer' : 'default'};">
                <div class="calendar-day-header">${dayNames[i] || d.day_name}</div>
                <div class="calendar-day-number">${dateObj.getDate()}</div>
                ${d.reservations > 0 ? `
                    <div class="calendar-shift comida">
                        <span>Reservas</span>
                        <strong>${d.reservations}</strong>
                    </div>
                    <div class="calendar-shift cena">
                        <span>Comensales</span>
                        <strong>${d.guests}</strong>
                    </div>
                ` : `<div style="font-size:12px; color:#9ca3af; text-align:center; margin-top:10px;">Sin reservas</div>`}
            </div>
        `;
    }).join('');
}

async function viewDayReservations(date) {
    const dateObj = new Date(date + 'T12:00:00');
    const dateStr = dateObj.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    try {
        // Obtener todas las reservas del día
        const reservas = await apiGet(`/api/reservations?date=${date}&shift=comida&all=true`);
        const reservasCena = await apiGet(`/api/reservations?date=${date}&shift=cena&all=true`);
        const todasReservas = [...reservas, ...reservasCena].sort((a, b) => a.time.localeCompare(b.time));

        // Crear modal
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal" style="max-width:600px;">
                <div class="modal-header">
                    <h3>📅 Reservas - ${dateStr.charAt(0).toUpperCase() + dateStr.slice(1)}</h3>
                    <button class="btn-close" onclick="this.closest('.modal-overlay').remove()">×</button>
                </div>
                <div style="max-height:70vh; overflow-y:auto; padding:20px;">
                    ${todasReservas.length > 0 ? todasReservas.map(r => `
                        <div style="background:#f9fafb; border:1.5px solid #e5e7eb; border-radius:10px; padding:14px; margin-bottom:12px; cursor:pointer; transition:all 0.3s;"
                             onmouseover="this.style.boxShadow='0 4px 12px rgba(0,0,0,0.1)'; this.style.borderColor='#0f766e';"
                             onmouseout="this.style.boxShadow=''; this.style.borderColor='#e5e7eb';"
                             onclick="editReservationModal(${r.id})">
                            <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:8px;">
                                <div>
                                    <div style="font-weight:600; font-size:14px; color:#1f2937;">${r.client_name}</div>
                                    <div style="font-size:12px; color:#6b7280; margin-top:2px;">${r.client_phone || 'Sin teléfono'}</div>
                                </div>
                                <span style="background:#e0f2f1; color:#0f766e; padding:4px 8px; border-radius:6px; font-size:11px; font-weight:600;">
                                    ${r.status === 'confirmed' ? '✓ Confirmada' : r.status === 'seated' ? '✓ Sentada' : r.status === 'completed' ? '✓ Completada' : r.status === 'no_show' ? '✗ No Show' : 'Cancelada'}
                                </span>
                            </div>
                            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:8px; padding-top:8px; border-top:1px solid #d1d5db;">
                                <div>
                                    <div style="font-size:11px; color:#6b7280; font-weight:600;">HORA</div>
                                    <div style="font-size:14px; font-weight:600; color:#1f2937;">${r.time}</div>
                                </div>
                                <div>
                                    <div style="font-size:11px; color:#6b7280; font-weight:600;">COMENSALES</div>
                                    <div style="font-size:14px; font-weight:600; color:#1f2937;">👥 ${r.guests}</div>
                                </div>
                                <div>
                                    <div style="font-size:11px; color:#6b7280; font-weight:600;">MESA</div>
                                    <div style="font-size:14px; font-weight:600; color:#1f2937;">${r.table_number ? '🪑 ' + r.table_number : '—'}</div>
                                </div>
                                <div>
                                    <div style="font-size:11px; color:#6b7280; font-weight:600;">TURNO</div>
                                    <div style="font-size:14px; font-weight:600; color:#1f2937; text-transform:capitalize;">${r.shift}</div>
                                </div>
                            </div>
                            ${r.notes ? `<div style="margin-top:8px; padding:8px; background:#fff3cd; border-radius:6px; font-size:12px; color:#664d03;">📝 ${r.notes}</div>` : ''}
                        </div>
                    `).join('') : `
                        <div style="text-align:center; padding:40px 20px; color:#9ca3af;">
                            <div style="font-size:28px; margin-bottom:10px;">📭</div>
                            <div>No hay reservas este día</div>
                        </div>
                    `}
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    } catch (error) {
        console.error('Error cargando reservas:', error);
        showToast('Error al cargar reservas del día', 'error');
    }
}

function editReservationModal(resId) {
    openEditReservation(resId);
    document.querySelector('.modal-overlay:last-child').remove();
}
