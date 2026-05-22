/* ═══════════════════════════════════════════════
   SEASON - Client Database Management
   ═══════════════════════════════════════════════ */

async function loadClientsList() {
    const q = document.getElementById('searchClients')?.value || '';
    const clients = await apiGet(`/api/clients?search=${encodeURIComponent(q)}`);
    renderClientsList(clients);
}

function renderClientsList(clients) {
    const container = document.getElementById('clientsList');

    if (!clients.length) {
        container.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <div class="empty-state-icon">&#128101;</div>
                <div class="empty-state-text">No hay clientes registrados</div>
            </div>`;
        return;
    }

    container.innerHTML = clients.map(c => `
        <div class="client-card" onclick="openClientDetail(${c.id})">
            <div class="client-card-header">
                <div>
                    <div class="client-card-name">
                        ${c.name}
                        ${c.vip ? '<span class="badge badge-vip">VIP</span>' : ''}
                        ${c.blacklisted ? '<span class="badge badge-red">Bloqueado</span>' : ''}
                    </div>
                    <div class="client-card-phone">${c.phone}${c.email ? ' · ' + c.email : ''}</div>
                </div>
            </div>
            ${c.allergies ? `<div style="font-size:12px; color:#ef4444; margin-top:4px;">⚠ ${c.allergies}</div>` : ''}
            <div class="client-card-stats">
                <span><strong>${c.visits_count || 0}</strong> visitas</span>
                <span><strong>${c.no_show_count || 0}</strong> no shows</span>
                ${c.last_visit ? `<span>Última: ${formatDate(c.last_visit)}</span>` : ''}
            </div>
        </div>
    `).join('');
}

let clientSearchTimeout;
document.getElementById('searchClients')?.addEventListener('input', () => {
    clearTimeout(clientSearchTimeout);
    clientSearchTimeout = setTimeout(loadClientsList, 300);
});

// ── Client Detail ───────────────────────────────

async function openClientDetail(clientId) {
    const data = await apiGet(`/api/clients/${clientId}`);
    const panel = document.getElementById('clientDetailPanel');
    document.getElementById('clientDetailName').textContent = data.name;

    let html = `
        <div class="detail-section">
            <h4>INFORMACI&Oacute;N</h4>
            <div class="detail-row"><span class="label">Tel&eacute;fono</span><span class="value">${data.phone}</span></div>
            <div class="detail-row"><span class="label">Email</span><span class="value">${data.email || '-'}</span></div>
            <div class="detail-row"><span class="label">VIP</span><span class="value">${data.vip ? 'S&iacute;' : 'No'}</span></div>
            ${data.preferences ? `<div class="detail-row"><span class="label">Preferencias</span><span class="value">${data.preferences}</span></div>` : ''}
            ${data.allergies ? `<div class="detail-row"><span class="label">Alergias</span><span class="value" style="color:#ef4444">${data.allergies}</span></div>` : ''}
            ${data.notes ? `<div class="detail-row"><span class="label">Notas</span><span class="value">${data.notes}</span></div>` : ''}
        </div>
        <div class="detail-section">
            <h4>ESTAD&Iacute;STICAS</h4>
            <div class="detail-row"><span class="label">Visitas</span><span class="value">${data.visits_count || 0}</span></div>
            <div class="detail-row"><span class="label">No Shows</span><span class="value">${data.no_show_count || 0}</span></div>
            <div class="detail-row"><span class="label">&Uacute;ltima visita</span><span class="value">${data.last_visit ? formatDate(data.last_visit) : 'Nunca'}</span></div>
            <div class="detail-row"><span class="label">Cliente desde</span><span class="value">${formatDate(data.created_at.split('T')[0])}</span></div>
        </div>
        <div style="display:flex; gap:8px; margin-bottom:16px;">
            <button class="btn-primary btn-sm" onclick="editClient(${data.id})">Editar</button>
            <button class="btn-secondary btn-sm" onclick="newReservationForClient(${data.id}, '${data.name.replace(/'/g, "\\'")}', '${data.phone}')">Nueva Reserva</button>
            <button class="btn-danger btn-sm" style="color:#ef4444; border-color:#ef4444;" onclick="deleteClient(${data.id}, '${data.name.replace(/'/g, "\\'")}')">🗑️ Eliminar Cliente</button>
        </div>
    `;

    if (data.history && data.history.length) {
        html += `<div class="detail-section"><h4>HISTORIAL</h4>`;
        html += data.history.slice(0, 20).map(r => `
            <div class="history-item">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span class="history-date">${formatDate(r.date)} · ${r.time} · ${r.shift}</span>
                    ${statusBadge(r.status)}
                </div>
                <div style="margin-top:4px; font-size:12px; color:#6b7280;">
                    ${r.guests} comensales${r.table_number ? ' · Mesa ' + r.table_number : ''} · ${sourceBadge(r.source)}
                </div>
            </div>
        `).join('');
        html += `</div>`;
    }

    document.getElementById('clientDetailContent').innerHTML = html;
    panel.classList.remove('hidden');
}

function closeClientDetail() {
    document.getElementById('clientDetailPanel').classList.add('hidden');
}

// ── New Client ──────────────────────────────────

function openNewClientModal() {
    document.getElementById('modalClientTitle').textContent = 'Nuevo Cliente';
    document.getElementById('clientEditId').value = '';
    document.getElementById('formClient').reset();
    openModal('modalClient');
}

async function editClient(clientId) {
    const data = await apiGet(`/api/clients/${clientId}`);
    document.getElementById('modalClientTitle').textContent = 'Editar Cliente';
    document.getElementById('clientEditId').value = clientId;
    document.getElementById('clientName').value = data.name;
    document.getElementById('clientPhone').value = data.phone;
    document.getElementById('clientEmail').value = data.email || '';
    document.getElementById('clientPreferences').value = data.preferences || '';
    document.getElementById('clientAllergies').value = data.allergies || '';
    document.getElementById('clientNotes').value = data.notes || '';
    document.getElementById('clientVip').checked = data.vip;
    openModal('modalClient');
}

async function submitClient(e) {
    e.preventDefault();
    const editId = document.getElementById('clientEditId').value;
    const data = {
        name: document.getElementById('clientName').value,
        phone: document.getElementById('clientPhone').value,
        email: document.getElementById('clientEmail').value,
        preferences: document.getElementById('clientPreferences').value,
        allergies: document.getElementById('clientAllergies').value,
        notes: document.getElementById('clientNotes').value,
        vip: document.getElementById('clientVip').checked,
    };

    if (editId) {
        await apiPut(`/api/clients/${editId}`, data);
        showToast('Cliente actualizado', 'success');
    } else {
        await apiPost('/api/clients', data);
        showToast('Cliente creado', 'success');
    }

    closeModal('modalClient');
    loadClientsList();
}

function newReservationForClient(clientId, name, phone) {
    closeClientDetail();
    openNewReservationModal();
    document.getElementById('resName').value = name;
    document.getElementById('resPhone').value = phone;
}

async function deleteClient(clientId, clientName) {
    if (!confirm(`¿Eliminar definitivamente el cliente "${clientName}"? Esta acción no se puede deshacer.`)) return;
    
    try {
        await apiDelete(`/api/clients/${clientId}`);
        showToast('Cliente eliminado', 'success');
        closeClientDetail();
        loadClientsList();
    } catch (err) {
        showToast('Error al eliminar cliente', 'error');
        console.error(err);
    }
}
