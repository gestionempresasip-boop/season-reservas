/* ═══════════════════════════════════════════════
   SEASON - Reservations Management
   Multi-mesa + bug fix comensales + drag-drop + conflict detection
   ═══════════════════════════════════════════════ */

let allReservations = [];
let selectedTableIds = []; // For multi-table selection in form

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

    container.innerHTML = items.map(r => {
        const tablesLabel = (r.table_numbers && r.table_numbers.length > 0)
            ? (r.is_grouped ? `Mesas ${r.table_numbers.join(' + ')}` : `Mesa ${r.table_numbers[0]}`)
            : '';
        return `
        <div class="reservation-card ${r.is_grouped ? 'is-grouped' : ''}" data-id="${r.id}" draggable="true">
            <div class="res-time">${r.time}</div>
            <div class="res-info">
                <div class="res-name">
                    ${r.client_name}
                    ${r.client && r.client.vip ? '<span class="badge badge-vip">VIP</span>' : ''}
                    ${r.is_grouped ? '<span class="badge badge-group">GRUPO</span>' : ''}
                </div>
                <div class="res-details">
                    ${r.guests} comensales &middot; ${sourceBadge(r.source)}
                    ${r.notes ? ' &middot; ' + r.notes : ''}
                </div>
            </div>
            ${tablesLabel ? `<div class="res-table">${tablesLabel}</div>` : '<div class="res-table" style="opacity:0.4">Sin mesa</div>'}
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
        `;
    }).join('');

    container.querySelectorAll('.reservation-card').forEach(card => {
        card.addEventListener('click', () => {
            openEditReservation(parseInt(card.dataset.id));
        });
        // Drag-drop: drag reservation card → table on floor plan
        card.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/reservation-id', card.dataset.id);
            e.dataTransfer.effectAllowed = 'move';
            card.classList.add('dragging');
        });
        card.addEventListener('dragend', () => card.classList.remove('dragging'));
    });
}

// ── Search & Filter ─────────────────────────────

document.getElementById('searchReservas')?.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    const filtered = allReservations.filter(r =>
        r.client_name.toLowerCase().includes(q) ||
        (r.client_phone || '').includes(q)
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

function openNewReservationModal(preselectedTableIds) {
    document.getElementById('modalReservationTitle').textContent = 'Nueva Reserva';
    document.getElementById('resEditId').value = '';
    document.getElementById('formReservation').reset();
    selectedTableIds = (preselectedTableIds || []).map(Number);

    const today = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('resDate');
    dateInput.setAttribute('min', today);
    dateInput.value = currentDate < today ? today : currentDate;

    document.getElementById('resShift').value = currentShift;

    // Intelligent time defaults
    const now = new Date();
    const nowH = now.getHours();
    const nowM = now.getMinutes();
    let defaultTime;
    if (dateInput.value === today) {
        if (currentShift === 'comida') {
            if (nowH < 13) defaultTime = '14:00';
            else if (nowH < 16) {
                const nextM = nowM < 30 ? '30' : '00';
                const nextH = nowM < 30 ? nowH : nowH + 1;
                defaultTime = String(nextH).padStart(2, '0') + ':' + nextM;
            } else defaultTime = '14:00';
        } else {
            if (nowH < 19) defaultTime = '20:00';
            else if (nowH < 23) {
                const nextM = nowM < 30 ? '30' : '00';
                const nextH = nowM < 30 ? nowH : nowH + 1;
                defaultTime = String(nextH).padStart(2, '0') + ':' + nextM;
            } else defaultTime = '20:00';
        }
    } else {
        defaultTime = currentShift === 'comida' ? '14:00' : '20:00';
    }
    document.getElementById('resTime').value = defaultTime;

    // If preselected tables, auto-set guests to fit total capacity (if > current)
    if (selectedTableIds.length > 0 && typeof tableDataMap !== 'undefined') {
        const totalCap = selectedTableIds.reduce((sum, tid) => {
            const t = Object.values(tableDataMap).find(x => x.id == tid);
            return sum + (t ? t.capacity : 0);
        }, 0);
        // Default guests = totalCap (user can change)
        if (totalCap > 0) {
            document.getElementById('resGuests').value = Math.min(totalCap, 14);
        }
    }

    loadAvailableTables();
    openModal('modalReservation');
}

async function openEditReservation(resId) {
    let r = allReservations.find(x => x.id === resId);
    if (!r) {
        const data = await apiGet(`/api/reservations?date=${currentDate}&shift=${currentShift}&all=true`);
        allReservations = data;
        r = data.find(x => x.id === resId);
        if (!r) return;
    }
    fillEditForm(r);
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
    const durInput = document.getElementById('resDuration');
    if (durInput) durInput.value = r.duration_minutes || 120;

    // Multi-table: set selectedTableIds
    selectedTableIds = (r.table_ids || (r.table_id ? [r.table_id] : [])).map(Number);

    loadAvailableTables();
    openModal('modalReservation');
}

/**
 * Load tables for selection in the form.
 * FIXED BUG: preserves selected tables when changing guests/time.
 * If a previously selected table no longer fits (capacity), shows warning but keeps it.
 */
async function loadAvailableTables() {
    const d = document.getElementById('resDate').value || currentDate;
    const s = document.getElementById('resShift').value || currentShift;
    const g = parseInt(document.getElementById('resGuests').value) || 2;
    const time = document.getElementById('resTime').value;
    const dur = parseInt(document.getElementById('resDuration')?.value || 120);
    const editId = document.getElementById('resEditId').value;

    const container = document.getElementById('tablePickerContainer');
    if (!container) return;

    // Build URL with time + duration + exclude_id (so editing doesn't conflict with itself)
    let url = `/api/tables/available?date=${d}&shift=${s}&guests=1`;
    if (time) url += `&time=${time}&duration=${dur}`;
    if (editId) url += `&exclude_reservation_id=${editId}`;

    let availableTables = [];
    try {
        availableTables = await apiGet(url);
    } catch (e) {
        console.warn('Error cargando mesas disponibles:', e);
        // Fallback to local data
        availableTables = (typeof tableDataMap !== 'undefined')
            ? Object.values(tableDataMap).filter(t => t.status === 'free' && t.id)
            : [];
    }

    // Always include currently selected tables (even if not "available" in API response)
    const availableIds = new Set(availableTables.map(t => t.id));
    selectedTableIds.forEach(tid => {
        if (!availableIds.has(tid)) {
            // Find this table in tableDataMap or fetch
            const t = Object.values(tableDataMap || {}).find(x => x.id == tid);
            if (t) {
                availableTables.push({...t, _selected_preserved: true});
            }
        }
    });

    renderTablePicker(container, availableTables, g);
}

function renderTablePicker(container, tables, guestsNeeded) {
    // Sort tables by zone then number
    const sorted = [...tables].sort((a, b) => {
        if (a.zone !== b.zone) return (a.zone || '').localeCompare(b.zone || '');
        return (a.number || 0) - (b.number || 0);
    });

    const totalSelectedCap = selectedTableIds.reduce((sum, tid) => {
        const t = sorted.find(x => x.id == tid);
        return sum + (t ? t.capacity : 0);
    }, 0);

    const capacityWarning = (selectedTableIds.length > 0 && totalSelectedCap < guestsNeeded)
        ? `<div class="capacity-warning">⚠️ Capacidad seleccionada (${totalSelectedCap}) menor que comensales (${guestsNeeded}). Añade más mesas.</div>`
        : '';

    const capacityOk = (selectedTableIds.length > 0 && totalSelectedCap >= guestsNeeded)
        ? `<div class="capacity-ok">✓ ${totalSelectedCap} plazas para ${guestsNeeded} comensales</div>`
        : '';

    container.innerHTML = `
        <div class="table-picker-header">
            <div class="table-picker-info">
                ${selectedTableIds.length === 0
                    ? '<span class="hint">Clic en mesas para seleccionar (puedes elegir varias)</span>'
                    : `<span class="selected-summary">${selectedTableIds.length} mesa${selectedTableIds.length>1?'s':''} · ${totalSelectedCap} plazas</span>`
                }
            </div>
            ${selectedTableIds.length > 0 ? `<button type="button" class="btn-secondary btn-sm" onclick="clearSelectedTables()">Quitar todas</button>` : ''}
        </div>
        ${capacityWarning}
        ${capacityOk}
        <div class="table-picker-grid">
            ${sorted.map(t => {
                const isSelected = selectedTableIds.includes(t.id);
                const preservedWarn = t._selected_preserved ? '⚠' : '';
                const tooSmall = t.capacity < guestsNeeded && !isSelected;
                return `
                    <button type="button"
                            class="table-pick-btn ${isSelected ? 'selected' : ''} ${tooSmall ? 'too-small' : ''} zone-${t.zone}"
                            onclick="toggleTableSelection(${t.id})"
                            data-table-id="${t.id}">
                        <div class="t-num">${t.number}${preservedWarn}</div>
                        <div class="t-cap">${t.capacity}p</div>
                        <div class="t-zone">${zoneShort(t.zone)}</div>
                    </button>
                `;
            }).join('')}
        </div>
    `;
}

function zoneShort(zone) {
    return ({
        'exterior': 'EXT',
        'salon_principal': 'PRI',
        'salon_interior': 'INT',
        'ext': 'EXT',
        'sp': 'PRI',
        'si': 'INT',
    })[zone] || zone || '';
}

function toggleTableSelection(tableId) {
    tableId = Number(tableId);
    const idx = selectedTableIds.indexOf(tableId);
    if (idx >= 0) {
        selectedTableIds.splice(idx, 1);
    } else {
        selectedTableIds.push(tableId);
    }
    loadAvailableTables();
}

function clearSelectedTables() {
    selectedTableIds = [];
    loadAvailableTables();
}

// Reload table picker when guests/time/shift/date changes (PRESERVES selection)
document.getElementById('resGuests')?.addEventListener('input', () => loadAvailableTables());
document.getElementById('resShift')?.addEventListener('change', () => loadAvailableTables());
document.getElementById('resDate')?.addEventListener('change', () => loadAvailableTables());
document.getElementById('resTime')?.addEventListener('change', () => loadAvailableTables());
document.getElementById('resDuration')?.addEventListener('change', () => loadAvailableTables());

function validateReservationDateTime(resDate, resTime, isEdit) {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    if (resDate < today) {
        showToast('No se pueden hacer reservas en fechas pasadas', 'error');
        return false;
    }
    if (resDate === today && resTime) {
        const [h, m] = resTime.split(':').map(Number);
        const resMinutes = h * 60 + m;
        const nowMinutes = now.getHours() * 60 + now.getMinutes();
        if (!isEdit && resMinutes < nowMinutes - 15) {
            showToast('La hora de la reserva ya ha pasado', 'error');
            return false;
        }
    }
    return true;
}

async function submitReservation(e) {
    e.preventDefault();
    const editId = document.getElementById('resEditId').value;
    const resDate = document.getElementById('resDate').value;
    const resTime = document.getElementById('resTime').value;

    if (!validateReservationDateTime(resDate, resTime, !!editId)) return;

    const data = {
        client_name: document.getElementById('resName').value.trim(),
        client_phone: document.getElementById('resPhone').value.trim(),
        date: resDate,
        shift: document.getElementById('resShift').value,
        time: resTime,
        guests: parseInt(document.getElementById('resGuests').value),
        source: document.getElementById('resSource').value,
        notes: document.getElementById('resNotes').value,
        table_ids: selectedTableIds.length > 0 ? selectedTableIds : null,
        table_id: null,  // explicit: managed via table_ids
        duration_minutes: parseInt(document.getElementById('resDuration')?.value || 120),
    };

    try {
        if (editId) {
            await apiPut(`/api/reservations/${editId}`, data);
            showToast('Reserva actualizada', 'success');
        } else {
            await apiPost('/api/reservations', data);
            showToast(selectedTableIds.length > 1 ? `Reserva creada con ${selectedTableIds.length} mesas` : 'Reserva creada', 'success');
        }
        closeModal('modalReservation');
        if (typeof loadFloorPlan === 'function') await loadFloorPlan();
        refreshAll();
    } catch (error) {
        showToast(error.message || 'Error al guardar reserva', 'error');
    }
}

// ── Quick Actions ───────────────────────────────

async function quickSeat(resId) {
    await apiPut(`/api/reservations/${resId}/seat`);
    showToast('Mesa sentada', 'success');
    if (typeof loadFloorPlan === 'function') await loadFloorPlan();
    refreshAll();
}

async function quickComplete(resId) {
    await apiPut(`/api/reservations/${resId}/complete`);
    showToast('Mesa completada', 'success');
    if (typeof loadFloorPlan === 'function') await loadFloorPlan();
    refreshAll();
}

async function quickNoShow(resId) {
    await apiPut(`/api/reservations/${resId}/noshow`);
    showToast('Marcado como No Show', 'error');
    if (typeof loadFloorPlan === 'function') await loadFloorPlan();
    refreshAll();
}

async function quickDelete(resId, name) {
    if (!confirm(`¿Eliminar definitivamente la reserva de ${name}?`)) return;
    try {
        await apiDelete(`/api/reservations/${resId}/delete`);
        showToast('Reserva eliminada', 'error');
        if (typeof loadFloorPlan === 'function') await loadFloorPlan();
        refreshAll();
    } catch (error) {
        showToast('Error al eliminar reserva', 'error');
    }
}

// ── Drag-drop: drop reservation card on a table ─────────────────────

async function assignReservationToTable(reservationId, tableId) {
    try {
        await apiPut(`/api/reservations/${reservationId}/assign-tables`, { table_ids: [tableId] });
        showToast('Mesa asignada', 'success');
        if (typeof loadFloorPlan === 'function') await loadFloorPlan();
        refreshAll();
    } catch (e) {
        showToast(e.message || 'Error al asignar mesa', 'error');
    }
}

async function assignReservationToTables(reservationId, tableIds) {
    try {
        await apiPut(`/api/reservations/${reservationId}/assign-tables`, { table_ids: tableIds });
        showToast(`${tableIds.length} mesas asignadas`, 'success');
        if (typeof loadFloorPlan === 'function') await loadFloorPlan();
        refreshAll();
    } catch (e) {
        showToast(e.message || 'Error al asignar mesas', 'error');
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

// Global search bar (top)
async function performGlobalSearch(query) {
    if (!query || query.length < 2) {
        document.getElementById('globalSearchResults')?.classList.add('hidden');
        return;
    }
    try {
        const results = await apiGet(`/api/search/reservations?q=${encodeURIComponent(query)}`);
        const box = document.getElementById('globalSearchResults');
        if (!box) return;
        if (results.length === 0) {
            box.innerHTML = '<div class="search-empty">Sin resultados</div>';
        } else {
            box.innerHTML = results.slice(0, 12).map(r => `
                <div class="global-search-item" onclick="jumpToReservation('${r.date}','${r.shift}',${r.id})">
                    <div class="gs-date">${r.date} ${r.time}</div>
                    <div class="gs-name">${r.client_name}</div>
                    <div class="gs-meta">${r.guests}p · ${statusBadge(r.status)}</div>
                </div>
            `).join('');
        }
        box.classList.remove('hidden');
    } catch (e) { console.warn(e); }
}

function jumpToReservation(d, shift, resId) {
    currentDate = d;
    currentShift = shift;
    // Update UI
    document.getElementById('datePicker').value = d;
    document.querySelectorAll('.shift-btn').forEach(b => b.classList.toggle('active', b.dataset.shift === shift));
    document.getElementById('globalSearchResults')?.classList.add('hidden');
    document.getElementById('globalSearchInput').value = '';
    refreshAll().then(() => openEditReservation(resId));
}

let globalSearchTimer;
document.addEventListener('DOMContentLoaded', () => {
    const inp = document.getElementById('globalSearchInput');
    if (inp) {
        inp.addEventListener('input', (e) => {
            clearTimeout(globalSearchTimer);
            globalSearchTimer = setTimeout(() => performGlobalSearch(e.target.value.trim()), 250);
        });
        inp.addEventListener('blur', () => {
            setTimeout(() => document.getElementById('globalSearchResults')?.classList.add('hidden'), 200);
        });
    }
});

// Export CSV
function exportReservationsCSV() {
    const from = prompt('Desde (YYYY-MM-DD):', new Date().toISOString().split('T')[0]);
    if (!from) return;
    const to = prompt('Hasta (YYYY-MM-DD):', new Date().toISOString().split('T')[0]);
    if (!to) return;
    window.location.href = `/api/export/reservations.csv?from=${from}&to=${to}`;
}
