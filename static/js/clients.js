/* ═══════════════════════════════════════════════
   SEASON - Client Database Management
   ═══════════════════════════════════════════════ */

let _allClients = [];
let _sortCol = 'name';
let _sortAsc = true;

async function loadClientsList() {
    const q = document.getElementById('searchClients')?.value || '';
    const url = q ? `/api/clients?search=${encodeURIComponent(q)}` : `/api/clients?all=1`;
    _allClients = await apiGet(url);
    renderClientsList(_allClients);
}

function renderClientsList(clients) {
    const onlyVip = document.getElementById('filterVip')?.checked;
    const onlyBlacklisted = document.getElementById('filterBlacklisted')?.checked;

    let list = clients;
    if (onlyVip) list = list.filter(c => c.vip);
    if (onlyBlacklisted) list = list.filter(c => c.blacklisted);

    // Sort
    list = [...list].sort((a, b) => {
        let va = a[_sortCol] ?? '';
        let vb = b[_sortCol] ?? '';
        if (typeof va === 'string') va = va.toLowerCase();
        if (typeof vb === 'string') vb = vb.toLowerCase();
        if (va < vb) return _sortAsc ? -1 : 1;
        if (va > vb) return _sortAsc ? 1 : -1;
        return 0;
    });

    // Update count
    const countEl = document.getElementById('clientsCount');
    if (countEl) countEl.textContent = `(${list.length} clientes)`;

    // Update sort indicators
    ['name','phone','email','visits_count','no_show_count','last_visit'].forEach(col => {
        const el = document.getElementById(`sort-${col}`);
        if (el) el.textContent = col === _sortCol ? (_sortAsc ? '▲' : '▼') : '';
    });

    const tbody = document.getElementById('clientsTableBody');
    if (!tbody) return;

    if (!list.length) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:32px;color:#6b7280;">No hay clientes</td></tr>`;
        return;
    }

    tbody.innerHTML = list.map(c => `
        <tr class="client-row" onclick="openClientDetail(${c.id})" style="cursor:pointer;">
            <td>
                <span class="client-row-name">${c.name}</span>
                ${c.vip ? ' <span class="badge badge-vip" style="font-size:10px;">VIP</span>' : ''}
                ${c.blacklisted ? ' <span class="badge badge-red" style="font-size:10px;">Bloq.</span>' : ''}
                ${c.allergies ? ' <span title="' + c.allergies + '" style="color:#ef4444;font-size:12px;">⚠</span>' : ''}
            </td>
            <td>${c.phone || '-'}</td>
            <td style="color:#6b7280;font-size:0.85rem;">${c.email || '-'}</td>
            <td style="text-align:center;">${c.visits_count || 0}</td>
            <td style="text-align:center;color:${(c.no_show_count||0)>0?'#ef4444':'inherit'};">${c.no_show_count || 0}</td>
            <td style="color:#6b7280;font-size:0.85rem;">${c.last_visit ? formatDate(c.last_visit) : '-'}</td>
            <td style="text-align:center;">${c.vip ? '⭐' : ''}</td>
        </tr>
    `).join('');
}

function sortClients(col) {
    if (_sortCol === col) {
        _sortAsc = !_sortAsc;
    } else {
        _sortCol = col;
        _sortAsc = true;
    }
    renderClientsList(_allClients);
}

function exportClientsExcel() {
    const onlyVip = document.getElementById('filterVip')?.checked;
    const onlyBlacklisted = document.getElementById('filterBlacklisted')?.checked;
    let list = _allClients;
    if (onlyVip) list = list.filter(c => c.vip);
    if (onlyBlacklisted) list = list.filter(c => c.blacklisted);

    const headers = ['Nombre','Teléfono','Email','Visitas','No Shows','Última Visita','VIP','Alergias','Preferencias','Notas'];
    const rows = list.map(c => [
        c.name,
        c.phone || '',
        c.email || '',
        c.visits_count || 0,
        c.no_show_count || 0,
        c.last_visit || '',
        c.vip ? 'Sí' : 'No',
        c.allergies || '',
        c.preferences || '',
        c.notes || '',
    ]);

    const csv = [headers, ...rows].map(r =>
        r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')
    ).join('\n');

    const bom = '﻿';
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clientes_season.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
