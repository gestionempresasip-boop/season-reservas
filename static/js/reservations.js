/* ═══════════════════════════════════════════════
   SEASON - Reservations Management
   ═══════════════════════════════════════════════ */

let allReservations = [];

async function loadReservationsList() {
    const data = await apiGet(`/api/reservations?date=${currentDate}&shift=${currentShift}&all=true`);
    allReservations = data;
    renderReservationsList(data);
}

function renderReservationsList(items) {
    const container = document.getElementById('reservationsList');

    if (!items.length) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">&#128211;</div>
                <div class="empty-state-text">No hay reservas para este turno</div>
            </div>`;
        return;
    }

    container.innerHTML = items.map(r => `
        <div class="reservation-card" data-id="${r.id}">
            <div class="res-time">${r.time}</div>
            <div class="res-info">
                <div class="res-name">
                    ${r.client_name}
                    ${r.client && r.client.vip ? '<span class="badge badge-vip">VIP</span>' : ''}
                </div>
                <div class="res-details">
                    ${r.guests} comensales &middot; ${sourceBadge(r.source)}
                    ${r.notes ? ' &middot; ' + r.notes : ''}
                </div>
            </div>
            ${r.table_number ? `<div class="res-table">Mesa ${r.table_number}</div>` : '<div class="res-table" style="opacity:0.4">Sin mesa</div>'}
            <div>${statusBadge(r.status)}</div>
            <div class="res-actions">
                ${r.status === 'confirmed' ? `
                    <button class="btn-primary btn-sm" onclick="event.stopPropagation(); quickSeat(${r.id})">Sentar</button>
                    <button class="btn-danger btn-sm" onclick="event.stopPropagation(); quickNoShow(${r.id})">No Show</button>
                ` : ''}
                ${r.status === 'seated' ? `
                    <button class="btn-primary btn-sm" onclick="event.stopPropagation(); quickComplete(${r.id})">Completar</button>
                ` : ''}
                <button class="btn-secondary btn-sm" style="color:#ef4444; border-color:#ef4444;" onclick="event.stopPropagation(); quickDelete(${r.id}, '${r.client_name.replace(/'/g, "\\'")}')">Eliminar</button>
            </div>
        </div>
    `).join('');

    container.querySelectorAll('.reservation-card').forEach(card => {
        card.addEventListener('click', () => {
            openEditReservation(parseInt(card.dataset.id));
        });
    });
}

// ── Search & Filter ─────────────────────────────

document.getElementById('searchReservas')?.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    const filtered = allReservations.filter(r =>
        r.client_name.toLowerCase().includes(q) ||
        r.client_phone.includes(q)
    );
    renderReservationsList(filtered);
});

document.getElementById('filterStatus')?.addEventListener('change', (e) => {
    const val = e.target.value;
    if (val === 'all') {
        renderReservationsList(allReservations);
    } else {
        renderReservationsList(allReservations.filter(r => r.status === val));
    }
});

// ── New Reservation ─────────────────────────────

function openNewReservationModal() {
    document.getElementById('modalReservationTitle').textContent = 'Nueva Reserva';
    document.getElementById('resEditId').value = '';
    document.getElementById('formReservation').reset();
    document.getElementById('resDate').value = currentDate;
    document.getElementById('resShift').value = currentShift;

    const now = new Date();
    if (currentShift === 'comida') {
        document.getElementById('resTime').value = '14:00';
    } else {
        document.getElementById('resTime').value = '20:00';
    }

    loadAvailableTables();
    openModal('modalReservation');
}

async function openEditReservation(resId) {
    const res = allReservations.find(r => r.id === resId);
    if (!res) {
        const data = await apiGet(`/api/reservations?date=${currentDate}&shift=${currentShift}&all=true`);
        allReservations = data;
        const r = data.find(x => x.id === resId);
        if (!r) return;
        fillEditForm(r);
    } else {
        fillEditForm(res);
    }
}

function fillEditForm(r) {
    document.getElementById('modalReservationTitle').textContent = 'Editar Reserva #' + r.id;
    document.getElementById('resEditId').value = r.id;
    document.getElementById('resName').value = r.client_name;
    document.getElementById('resPhone').value = r.client_phone || '';
    document.getElementById('resDate').value = r.date;
    document.getElementById('resShift').value = r.shift;
    document.getElementById('resTime').value = r.time;
    document.getElementById('resGuests').value = r.guests;
    document.getElementById('resSource').value = r.source;
    document.getElementById('resNotes').value = r.notes || '';

    loadAvailableTables().then(() => {
        if (r.table_id) {
            const select = document.getElementById('resTable');
            let found = false;
            for (let opt of select.options) {
                if (opt.value == r.table_id) { opt.selected = true; found = true; break; }
            }
            if (!found) {
                const opt = document.createElement('option');
                opt.value = r.table_id;
                opt.textContent = `Mesa ${r.table_number} (${zoneName(r.table_zone)}) - actual`;
                opt.selected = true;
                select.appendChild(opt);
            }
        }
    });

    openModal('modalReservation');
}

async function loadAvailableTables() {
    const d = document.getElementById('resDate').value || currentDate;
    const s = document.getElementById('resShift').value || currentShift;
    const g = parseInt(document.getElementById('resGuests').value) || 2;
    const select = document.getElementById('resTable');

    // Primero: llenar con datos locales de tableDataMap (instantáneo)
    fillTableSelect(select, g);

    // Luego: intentar cargar desde API para datos más frescos
    try {
        const tables = await apiGet(`/api/tables/available?date=${d}&shift=${s}&guests=${g}`);
        select.innerHTML = '<option value="">Asignar después</option>';

        tables.forEach(t => {
            if (t.capacity >= g) {
                const opt = document.createElement('option');
                opt.value = t.id;
                opt.textContent = `Mesa ${t.number} (${zoneName(t.zone)}) · ${t.capacity}p${t.table_type === 'alta' ? ' · Alta' : ''}`;
                select.appendChild(opt);
            }
        });

        if (g > 6) {
            const optgroup = document.createElement('optgroup');
            optgroup.label = '── Combinar mesas ──';
            for (let i = 0; i < tables.length; i++) {
                for (let j = i + 1; j < tables.length; j++) {
                    const t1 = tables[i], t2 = tables[j];
                    const combined = t1.capacity + t2.capacity;
                    if (combined >= g) {
                        const opt = document.createElement('option');
                        opt.value = `${t1.id},${t2.id}`;
                        opt.textContent = `Mesas ${t1.number} + ${t2.number} (${combined}p)`;
                        optgroup.appendChild(opt);
                    }
                }
            }
            if (optgroup.children.length > 0) select.appendChild(optgroup);
        }
    } catch (e) {
        console.warn('⚠️ Usando datos locales para mesas:', e.message);
    }
}

function fillTableSelect(select, guests) {
    select.innerHTML = '<option value="">Asignar después</option>';
    // Usar tableDataMap del floorplan (ya cargado en memoria)
    if (typeof tableDataMap !== 'undefined' && Object.keys(tableDataMap).length > 0) {
        Object.values(tableDataMap)
            .filter(t => t.status === 'free' && t.capacity >= guests)
            .sort((a, b) => a.number - b.number)
            .forEach(t => {
                const opt = document.createElement('option');
                opt.value = t.id;
                opt.textContent = `Mesa ${t.number} (${zoneName(t.zone)}) · ${t.capacity}p${t.table_type === 'alta' ? ' · Alta' : ''}`;
                select.appendChild(opt);
            });
    }
}

document.getElementById('resGuests')?.addEventListener('change', loadAvailableTables);
document.getElementById('resShift')?.addEventListener('change', loadAvailableTables);
document.getElementById('resDate')?.addEventListener('change', loadAvailableTables);

async function submitReservation(e) {
    e.preventDefault();
    const editId = document.getElementById('resEditId').value;
    const tableVal = document.getElementById('resTable').value;
    
    // Detectar si son múltiples mesas
    const tableIds = tableVal ? tableVal.split(',').map(x => x.trim()) : [null];
    
    const baseData = {
        client_name: document.getElementById('resName').value,
        client_phone: document.getElementById('resPhone').value,
        date: document.getElementById('resDate').value,
        shift: document.getElementById('resShift').value,
        time: document.getElementById('resTime').value,
        guests: parseInt(document.getElementById('resGuests').value),
        source: document.getElementById('resSource').value,
        notes: document.getElementById('resNotes').value,
    };

    if (editId) {
        const data = { ...baseData, table_id: tableVal || null };
        await apiPut(`/api/reservations/${editId}`, data);
        showToast('Reserva actualizada', 'success');
    } else {
        // Crear una reserva para cada mesa si son múltiples
        for (const tid of tableIds) {
            const data = { ...baseData, table_id: tid || null };
            await apiPost('/api/reservations', data);
        }
        if (tableIds.length > 1) {
            showToast(`Reserva para ${tableIds.length} mesas creada`, 'success');
        } else {
            showToast('Reserva creada', 'success');
        }
    }

    closeModal('modalReservation');
    refreshAll();
}

// ── Quick Actions ───────────────────────────────

async function quickSeat(resId) {
    await apiPut(`/api/reservations/${resId}/seat`);
    showToast('Mesa sentada', 'success');
    refreshAll();
}

async function quickComplete(resId) {
    await apiPut(`/api/reservations/${resId}/complete`);
    showToast('Mesa completada', 'success');
    refreshAll();
}

async function quickNoShow(resId) {
    await apiPut(`/api/reservations/${resId}/noshow`);
    showToast('Marcado como No Show', 'error');
    refreshAll();
}

async function quickDelete(resId, name) {
    if (!confirm(`¿Eliminar definitivamente la reserva de ${name}? Esta acción no se puede deshacer.`)) return;

    try {
        await apiDelete(`/api/reservations/${resId}/delete`);
        showToast('Reserva eliminada', 'error');
        refreshAll();
    } catch (error) {
        showToast('Error al eliminar reserva', 'error');
        console.error(error);
    }
}


// Selector visual de mesas
async function openTableSelector() {
    const modal = document.getElementById('modalTableSelector');
    if (!modal) {
        console.warn('Modal de selector no encontrado');
        return;
    }
    
    const d = document.getElementById('resDate').value || currentDate;
    const s = document.getElementById('resShift').value || currentShift;
    const g = parseInt(document.getElementById('resGuests').value) || 2;
    
    const tables = await apiGet(`/api/tables/available?date=${d}&shift=${s}&guests=${g}`);
    const container = document.getElementById('tableSelectorGrid');
    
    container.innerHTML = '';
    
    // Mostrar todas las mesas disponibles
    tables.forEach(t => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'table-selector-btn';
        btn.innerHTML = `<div class="table-num">${t.number}</div><div class="table-cap">${t.capacity}p</div>`;
        btn.onclick = (e) => {
            e.preventDefault();
            selectTableFromModal(t.id, t.number);
            closeModal('modalTableSelector');
        };
        container.appendChild(btn);
    });
    
    openModal('modalTableSelector');
}

function selectTableFromModal(tableId, tableNumber) {
    const select = document.getElementById('resTable');
    for (let opt of select.options) {
        if (opt.value == tableId) {
            opt.selected = true;
            showToast(`Mesa ${tableNumber} seleccionada`, 'success');
            break;
        }
    }
}

// ── Client Autocomplete ─────────────────────────

let searchTimeout;
document.getElementById('resName')?.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    const val = e.target.value.trim();
    if (val.length < 2) {
        document.getElementById('clientSuggestions').classList.add('hidden');
        return;
    }
    searchTimeout = setTimeout(async () => {
        const clients = await apiGet(`/api/clients?search=${encodeURIComponent(val)}`);
        const box = document.getElementById('clientSuggestions');
        if (clients.length === 0) {
            box.classList.add('hidden');
            return;
        }
        box.innerHTML = clients.slice(0, 5).map(c => `
            <div class="suggestion-item" data-phone="${c.phone}" data-name="${c.name}">
                <span class="suggestion-name">${c.name} ${c.vip ? '⭐' : ''}</span>
                <span class="suggestion-phone">${c.phone}</span>
            </div>
        `).join('');
        box.classList.remove('hidden');
        box.querySelectorAll('.suggestion-item').forEach(item => {
            item.addEventListener('click', () => {
                document.getElementById('resName').value = item.dataset.name;
                document.getElementById('resPhone').value = item.dataset.phone;
                box.classList.add('hidden');
            });
        });
    }, 300);
});

document.addEventListener('click', (e) => {
    if (!e.target.closest('.form-group')) {
        document.getElementById('clientSuggestions')?.classList.add('hidden');
    }
});
