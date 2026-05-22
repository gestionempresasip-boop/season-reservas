/* ═══════════════════════════════════════════════
   SEASON - Waitlist Management
   ═══════════════════════════════════════════════ */

async function loadWaitlist() {
    const data = await apiGet(`/api/waitlist?date=${currentDate}&shift=${currentShift}`);
    renderWaitlist(data);
}

function renderWaitlist(items) {
    const container = document.getElementById('waitlistContainer');

    if (!items.length) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">&#9201;</div>
                <div class="empty-state-text">No hay nadie en lista de espera</div>
            </div>`;
        return;
    }

    container.innerHTML = items.map((w, i) => `
        <div class="waitlist-card">
            <div class="wl-position">#${i + 1}</div>
            <div class="wl-info">
                <div class="wl-name">${w.client_name}</div>
                <div class="wl-details">
                    ${w.guests} comensales${w.phone ? ' · ' + w.phone : ''}
                    ${w.notes ? ' · ' + w.notes : ''}
                </div>
            </div>
            <div style="display:flex; gap:6px;">
                <button class="btn-primary btn-sm" onclick="seatFromWaitlist(${w.id})">Sentar</button>
                <button class="btn-secondary btn-sm" onclick="cancelWaitlist(${w.id})">Quitar</button>
            </div>
        </div>
    `).join('');
}

function openWaitlistModal() {
    document.getElementById('formWaitlist').reset();
    openModal('modalWaitlist');
}

async function submitWaitlist(e) {
    e.preventDefault();
    await apiPost('/api/waitlist', {
        client_name: document.getElementById('wlName').value,
        phone: document.getElementById('wlPhone').value,
        guests: parseInt(document.getElementById('wlGuests').value),
        date: currentDate,
        shift: currentShift,
        notes: document.getElementById('wlNotes').value,
    });
    closeModal('modalWaitlist');
    showToast('Añadido a lista de espera', 'success');
    loadWaitlist();
}

async function seatFromWaitlist(wId) {
    const tables = await apiGet(`/api/tables/available?date=${currentDate}&shift=${currentShift}&guests=2`);
    const tableId = tables.length > 0 ? tables[0].id : null;
    const now = new Date();
    const time = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');

    await apiPut(`/api/waitlist/${wId}/seat`, { table_id: tableId, time: time });
    showToast('Cliente sentado desde lista de espera', 'success');
    loadWaitlist();
    refreshAll();
}

async function cancelWaitlist(wId) {
    await apiPut(`/api/waitlist/${wId}/cancel`);
    showToast('Eliminado de la lista de espera');
    loadWaitlist();
}
