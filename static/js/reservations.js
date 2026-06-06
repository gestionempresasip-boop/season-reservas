/* ═══════════════════════════════════════════════
   SEASON - Reservations Management
   Multi-mesa + bug fix comensales + drag-drop + conflict detection
   ═══════════════════════════════════════════════ */

let allReservations = [];
let selectedTableIds = []; // For multi-table selection in form
let _cachedAvailableTables = []; // Cache from API, only re-fetched on date/time/shift/duration change
let _lastFetchKey = ''; // Used to detect when we need to refetch

// Walk-in state
let wiSelectedTableIds = [];
let _wiCachedTables = [];
let _wiLastFetchKey = '';
let _wiGuests = 2;

// Resolve table capacity from multiple possible sources
function getTableCapacity(tableId) {
    tableId = Number(tableId);
    // 1) From cached available tables (most reliable, has full data)
    const cached = _cachedAvailableTables.find(t => t.id === tableId);
    if (cached) return cached.capacity;
    // 2) From tableDataMap (may be slim, may have capacity)
    if (typeof tableDataMap !== 'undefined') {
        const t = Object.values(tableDataMap).find(x => x.id === tableId);
        if (t && t.capacity) return t.capacity;
        // Lookup by number if id missing
        if (t && t.number !== undefined && typeof TABLE_DEFS !== 'undefined') {
            const def = TABLE_DEFS.find(d => d.n === t.number);
            if (def) return def.cap;
        }
    }
    // 3) From TABLE_DEFS by id-mapped number (best effort)
    if (typeof tableDataMap !== 'undefined' && typeof TABLE_DEFS !== 'undefined') {
        const t = Object.values(tableDataMap).find(x => x.id === tableId);
        if (t) {
            const def = TABLE_DEFS.find(d => d.n === t.number);
            if (def) return def.cap;
        }
    }
    return 0;
}

function getTableInfo(tableId) {
    tableId = Number(tableId);
    const cached = _cachedAvailableTables.find(t => t.id === tableId);
    if (cached) return cached;
    if (typeof tableDataMap !== 'undefined') {
        const t = Object.values(tableDataMap).find(x => x.id === tableId);
        if (t) {
            // Enrich with TABLE_DEFS info if needed
            if (!t.capacity && typeof TABLE_DEFS !== 'undefined') {
                const def = TABLE_DEFS.find(d => d.n === t.number);
                if (def) return { ...t, capacity: def.cap, zone: t.zone || zoneFromShort(def.zone), table_type: def.type };
            }
            return t;
        }
    }
    return null;
}

function zoneFromShort(z) {
    return ({ 'ext': 'exterior', 'sp': 'salon_principal', 'si': 'salon_interior' })[z] || z;
}

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
    if (selectedTableIds.length > 0) {
        const totalCap = selectedTableIds.reduce((sum, tid) => sum + getTableCapacity(tid), 0);
        if (totalCap > 0) {
            document.getElementById('resGuests').value = Math.min(totalCap, 14);
        }
    }

    _lastFetchKey = '';  // force fetch with new params
    _cachedAvailableTables = [];  // clear cache (force rebuild from local + API)
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

    _lastFetchKey = '';  // force fetch
    _cachedAvailableTables = [];
    loadAvailableTables();
    openModal('modalReservation');
}

/**
 * Build local snapshot of tables from TABLE_DEFS + tableDataMap.
 * Used for INSTANT render before API responds.
 */
function buildLocalTableList() {
    if (typeof TABLE_DEFS === 'undefined') return [];
    const zoneMap = { 'ext': 'exterior', 'sp': 'salon_principal', 'si': 'salon_interior' };
    return TABLE_DEFS.map(def => {
        const td = (typeof tableDataMap !== 'undefined') ? tableDataMap[def.n] : null;
        return {
            id: td?.id || null,
            number: def.n,
            capacity: def.cap,
            zone: zoneMap[def.zone] || def.zone,
            table_type: def.type,
            _local: true,
            _occupied: td?.status && td.status !== 'free',
        };
    }).filter(t => t.id);  // require id to be selectable
}

/**
 * Load tables for selection in the form.
 * FIXED BUG: preserves selected tables when changing guests/time.
 * - Renders INSTANTLY from local TABLE_DEFS + tableDataMap (sub-50ms).
 * - Then refines in the background with API time-window-aware data.
 * - Selected tables ALWAYS persist regardless of capacity changes.
 */
async function loadAvailableTables(forceFetch) {
    const container = document.getElementById('tablePickerContainer');
    if (!container) return;

    const d = document.getElementById('resDate').value || currentDate;
    const s = document.getElementById('resShift').value || currentShift;
    const g = parseInt(document.getElementById('resGuests').value) || 2;
    const time = document.getElementById('resTime').value;
    const dur = parseInt(document.getElementById('resDuration')?.value || 120);
    const editId = document.getElementById('resEditId').value;

    // 1) INSTANT: render from local TABLE_DEFS + tableDataMap
    if (_cachedAvailableTables.length === 0) {
        const localList = buildLocalTableList();
        // Exclude tables already occupied in tableDataMap (rough filter)
        _cachedAvailableTables = localList.filter(t => !t._occupied);
    }
    renderFromCache(container, g);

    // 2) BACKGROUND: refine with time-aware API
    const fetchKey = `${d}|${s}|${time}|${dur}|${editId}`;
    const needsFetch = forceFetch || fetchKey !== _lastFetchKey;
    if (needsFetch) {
        _lastFetchKey = fetchKey;
        let url = `/api/tables/available?date=${d}&shift=${s}&guests=1`;
        if (time) url += `&time=${time}&duration=${dur}`;
        if (editId) url += `&exclude_reservation_id=${editId}`;
        try {
            const apiTables = await apiGet(url);
            // Merge: prefer API data (has full info + time-window aware)
            _cachedAvailableTables = apiTables;
            renderFromCache(container, parseInt(document.getElementById('resGuests').value) || g);
        } catch (e) {
            console.warn('Error API mesas:', e);
            // Keep local data
        }
    }
}

/** Render picker from current cache + selectedTableIds. */
function renderFromCache(container, guestsNeeded) {
    const availableIds = new Set(_cachedAvailableTables.map(t => t.id));
    const allTables = [..._cachedAvailableTables];
    // Add preserved selected tables (even if not in available list due to conflict/capacity)
    selectedTableIds.forEach(tid => {
        if (!availableIds.has(tid)) {
            const info = getTableInfo(tid);
            if (info) {
                allTables.push({
                    ...info,
                    _selected_preserved: true,
                    capacity: info.capacity || getTableCapacity(tid) || 2,
                });
            }
        }
    });
    renderTablePicker(container, allTables, guestsNeeded);
}

function renderTablePicker(container, tables, guestsNeeded) {
    const hasDefs = typeof TABLE_DEFS !== 'undefined' && TABLE_DEFS.length > 0;
    if (!hasDefs) {
        renderTablePickerGrid(container, tables, guestsNeeded);
        return;
    }

    const byNumber = new Map(tables.map(t => [t.number, t]));

    const totalSelectedCap = selectedTableIds.reduce((sum, tid) => {
        const t = tables.find(x => x.id == tid);
        return sum + (t?.capacity || getTableCapacity(tid) || 2);
    }, 0);

    const capacityWarning = (selectedTableIds.length > 0 && totalSelectedCap < guestsNeeded)
        ? `<div class="capacity-warning">⚠️ Capacidad seleccionada (${totalSelectedCap}) menor que comensales (${guestsNeeded}). Añade más mesas.</div>`
        : '';
    const capacityOk = (selectedTableIds.length > 0 && totalSelectedCap >= guestsNeeded)
        ? `<div class="capacity-ok">✓ ${totalSelectedCap} plazas para ${guestsNeeded} comensales</div>`
        : '';

    const tablesSVG = TABLE_DEFS.map(def => {
        const avail = byNumber.get(def.n);
        const tableId = avail?.id;
        const isSelected = tableId ? selectedTableIds.includes(tableId) : false;
        const isUnavailable = !avail;
        const tooSmall = avail && !avail._selected_preserved && avail.capacity < guestsNeeded && !isSelected;
        const isPreserved = avail?._selected_preserved;

        const cx = def.x + def.w / 2;
        const cy = def.y + def.h / 2;

        let groupCls = 'tp-tg';
        if (isSelected) groupCls += ' tp-sel';
        else if (isUnavailable) groupCls += ' tp-unavail';
        else if (tooSmall) groupCls += ' tp-small';
        if (isPreserved) groupCls += ' tp-preserved';

        const clickAttr = (tableId && !isUnavailable) ? `onclick="toggleTableSelection(${tableId})"` : '';

        return `<g class="${groupCls}" ${clickAttr}>
            <rect x="${def.x}" y="${def.y}" width="${def.w}" height="${def.h}" rx="1" class="tp-rect"/>
            ${_pickerChairs(def)}
            <text x="${cx}" y="${cy - 0.3}" class="tp-num">${def.n}</text>
            <text x="${cx}" y="${cy + 2.2}" class="tp-cap">${def.cap}p</text>
        </g>`;
    }).join('');

    container.innerHTML = `
        <div class="table-picker-header">
            <div class="table-picker-info">
                ${selectedTableIds.length === 0
                    ? '<span class="hint">Toca una mesa para seleccionar (puedes elegir varias)</span>'
                    : `<span class="selected-summary">${selectedTableIds.length} mesa${selectedTableIds.length > 1 ? 's' : ''} · ${totalSelectedCap} plazas</span>`
                }
            </div>
            ${selectedTableIds.length > 0 ? `<button type="button" class="btn-secondary btn-sm" onclick="clearSelectedTables()">Quitar todas</button>` : ''}
        </div>
        ${capacityWarning}${capacityOk}
        <div class="tp-svg-wrap">
            <svg class="tp-svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
                <rect x="1" y="1" width="98" height="28" rx="1.5" fill="#f0f7f5" stroke="#1a8a7d" stroke-width="0.3" stroke-dasharray="1,0.5"/>
                <text x="82" y="4" class="zone-label">EXTERIOR</text>
                <rect x="1" y="30" width="52" height="69" rx="1.5" fill="#ffffff" stroke="#d0d0d0" stroke-width="0.3"/>
                <text x="5" y="33" class="zone-label">SALÓN PRINCIPAL</text>
                <rect x="54" y="30" width="35" height="54" rx="1.5" fill="#faf8f3" stroke="#d0d0d0" stroke-width="0.3"/>
                <text x="58" y="33" class="zone-label">SALÓN INTERIOR</text>
                <rect x="90" y="60" width="9" height="30" rx="1" fill="#f5f0e6" stroke="#c5b896" stroke-width="0.3"/>
                <text x="94.5" y="71" class="cava-letter">C</text>
                <text x="94.5" y="75" class="cava-letter">A</text>
                <text x="94.5" y="79" class="cava-letter">V</text>
                <text x="94.5" y="83" class="cava-letter">A</text>
                ${tablesSVG}
            </svg>
        </div>
        <div class="tp-legend">
            <span class="tp-leg-item"><span class="tp-leg-dot tp-leg-avail"></span> Disponible</span>
            <span class="tp-leg-item"><span class="tp-leg-dot tp-leg-sel"></span> Seleccionada</span>
            <span class="tp-leg-item"><span class="tp-leg-dot tp-leg-unavail"></span> Ocupada</span>
        </div>
    `;
}

function _pickerChairs(def) {
    if (typeof getChairPositions !== 'function') return '';
    return getChairPositions(def).map(([cx, cy]) =>
        `<circle cx="${cx}" cy="${cy}" r="0.8" class="tp-chair"/>`
    ).join('');
}

function renderTablePickerGrid(container, tables, guestsNeeded) {
    const sorted = [...tables].sort((a, b) => {
        if (a.zone !== b.zone) return (a.zone || '').localeCompare(b.zone || '');
        return (a.number || 0) - (b.number || 0);
    });
    const totalSelectedCap = selectedTableIds.reduce((sum, tid) => {
        const t = sorted.find(x => x.id == tid);
        return sum + (t && t.capacity ? t.capacity : getTableCapacity(tid));
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
        ${capacityWarning}${capacityOk}
        <div class="table-picker-grid">
            ${sorted.map(t => {
                const isSelected = selectedTableIds.includes(t.id);
                const tooSmall = t.capacity < guestsNeeded && !isSelected;
                return `<button type="button"
                    class="table-pick-btn ${isSelected ? 'selected' : ''} ${tooSmall ? 'too-small' : ''} zone-${t.zone}"
                    onclick="toggleTableSelection(${t.id})"
                    data-table-id="${t.id}">
                    <div class="t-num">${t.number}${t._selected_preserved ? '⚠' : ''}</div>
                    <div class="t-cap">${t.capacity}p</div>
                    <div class="t-zone">${zoneShort(t.zone)}</div>
                </button>`;
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
    // FAST: no re-fetch, just re-render from cache (instant)
    loadAvailableTables(false);
}

function clearSelectedTables() {
    selectedTableIds = [];
    loadAvailableTables(false);
}

// Reload table picker when guests/time/shift/date changes (PRESERVES selection)
// Only date/time/shift/duration trigger API refetch. Guests just re-render warning.
document.getElementById('resGuests')?.addEventListener('input', () => loadAvailableTables(false));
document.getElementById('resShift')?.addEventListener('change', () => loadAvailableTables(true));
document.getElementById('resDate')?.addEventListener('change', () => loadAvailableTables(true));
document.getElementById('resTime')?.addEventListener('change', () => loadAvailableTables(true));
document.getElementById('resDuration')?.addEventListener('change', () => loadAvailableTables(true));

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

// ══════════════════════════════════════════════════
//  WALK-IN  — entrada directa sin reserva previa
// ══════════════════════════════════════════════════

function openWalkInModal() {
    // Reset state
    wiSelectedTableIds = [];
    _wiCachedTables = [];
    _wiLastFetchKey = '';
    _wiGuests = 2;

    // Fill info bar
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const dayStr = now.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
    const shiftName = currentShift === 'comida' ? 'Comida' : 'Cena';
    document.getElementById('wiInfoDate').textContent = dayStr.charAt(0).toUpperCase() + dayStr.slice(1);
    document.getElementById('wiInfoShift').textContent = shiftName;
    document.getElementById('wiInfoTime').textContent = `${hh}:${mm}`;
    document.getElementById('wiGuestsNum').textContent = '2';
    document.getElementById('wiNotes').value = '';
    document.getElementById('wiTablePickerContainer').innerHTML =
        '<div style="padding:20px;text-align:center;color:#9ca3af;font-size:13px">Cargando mesas…</div>';

    openModal('modalWalkIn');
    _loadWiTables(true);
}

function wiChangeGuests(delta) {
    _wiGuests = Math.max(1, Math.min(20, _wiGuests + delta));
    document.getElementById('wiGuestsNum').textContent = _wiGuests;
    _renderWiPicker(document.getElementById('wiTablePickerContainer'), _wiCachedTables, _wiGuests);
}

async function _loadWiTables(forceFetch) {
    const container = document.getElementById('wiTablePickerContainer');
    if (!container) return;

    // Instant render from local TABLE_DEFS
    if (_wiCachedTables.length === 0) {
        _wiCachedTables = buildLocalTableList().filter(t => !t._occupied);
    }
    _renderWiPicker(container, _wiCachedTables, _wiGuests);

    // Refine with API
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    const fetchKey = `${currentDate}|${currentShift}|${time.slice(0,4)}`; // round to 10 min
    if (forceFetch || fetchKey !== _wiLastFetchKey) {
        _wiLastFetchKey = fetchKey;
        try {
            const apiTables = await apiGet(
                `/api/tables/available?date=${currentDate}&shift=${currentShift}&guests=1&time=${time}&duration=120`
            );
            _wiCachedTables = apiTables;
            _renderWiPicker(
                document.getElementById('wiTablePickerContainer'),
                _wiCachedTables,
                _wiGuests
            );
        } catch (e) {
            console.warn('Walk-in: error cargando mesas', e);
        }
    }
}

function _renderWiPicker(container, tables, guestsNeeded) {
    if (!container) return;
    if (typeof TABLE_DEFS === 'undefined' || !TABLE_DEFS.length) return;

    const byNumber = new Map(tables.map(t => [t.number, t]));
    const totalCap = wiSelectedTableIds.reduce((sum, tid) => {
        const t = tables.find(x => x.id == tid);
        return sum + (t?.capacity || getTableCapacity(tid) || 2);
    }, 0);

    const capWarning = (wiSelectedTableIds.length > 0 && totalCap < guestsNeeded)
        ? `<div class="capacity-warning">⚠️ Capacidad (${totalCap}p) menor que comensales (${guestsNeeded}). Añade más mesas.</div>` : '';
    const capOk = (wiSelectedTableIds.length > 0 && totalCap >= guestsNeeded)
        ? `<div class="capacity-ok">✓ ${totalCap} plazas para ${guestsNeeded} comensales</div>` : '';

    const tablesSVG = TABLE_DEFS.map(def => {
        const avail = byNumber.get(def.n);
        const tableId = avail?.id;
        const isSelected = tableId ? wiSelectedTableIds.includes(tableId) : false;
        const isUnavailable = !avail;
        const tooSmall = avail && avail.capacity < guestsNeeded && !isSelected;

        const cx = def.x + def.w / 2;
        const cy = def.y + def.h / 2;
        let groupCls = 'tp-tg';
        if (isSelected)       groupCls += ' tp-sel';
        else if (isUnavailable) groupCls += ' tp-unavail';
        else if (tooSmall)    groupCls += ' tp-small';

        const clickAttr = (tableId && !isUnavailable) ? `onclick="toggleWiTable(${tableId})"` : '';

        return `<g class="${groupCls}" ${clickAttr}>
            <rect x="${def.x}" y="${def.y}" width="${def.w}" height="${def.h}" rx="1" class="tp-rect"/>
            ${_pickerChairs(def)}
            <text x="${cx}" y="${cy - 0.3}" class="tp-num">${def.n}</text>
            <text x="${cx}" y="${cy + 2.2}" class="tp-cap">${def.cap}p</text>
        </g>`;
    }).join('');

    container.innerHTML = `
        <div class="table-picker-header">
            <div class="table-picker-info">
                ${wiSelectedTableIds.length === 0
                    ? '<span class="hint">Toca una mesa para asignar</span>'
                    : `<span class="selected-summary">${wiSelectedTableIds.length} mesa${wiSelectedTableIds.length > 1 ? 's' : ''} · ${totalCap} plazas</span>`
                }
            </div>
            ${wiSelectedTableIds.length > 0
                ? `<button type="button" class="btn-secondary btn-sm" onclick="clearWiTables()">Quitar todas</button>` : ''}
        </div>
        ${capWarning}${capOk}
        <div class="tp-svg-wrap">
            <svg class="tp-svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
                <rect x="1" y="1" width="98" height="28" rx="1.5" fill="#f0f7f5" stroke="#1a8a7d" stroke-width="0.3" stroke-dasharray="1,0.5"/>
                <text x="82" y="4" class="zone-label">EXTERIOR</text>
                <rect x="1" y="30" width="52" height="69" rx="1.5" fill="#ffffff" stroke="#d0d0d0" stroke-width="0.3"/>
                <text x="5" y="33" class="zone-label">SALÓN PRINCIPAL</text>
                <rect x="54" y="30" width="35" height="54" rx="1.5" fill="#faf8f3" stroke="#d0d0d0" stroke-width="0.3"/>
                <text x="58" y="33" class="zone-label">SALÓN INTERIOR</text>
                <rect x="90" y="60" width="9" height="30" rx="1" fill="#f5f0e6" stroke="#c5b896" stroke-width="0.3"/>
                <text x="94.5" y="71" class="cava-letter">C</text>
                <text x="94.5" y="75" class="cava-letter">A</text>
                <text x="94.5" y="79" class="cava-letter">V</text>
                <text x="94.5" y="83" class="cava-letter">A</text>
                ${tablesSVG}
            </svg>
        </div>
        <div class="tp-legend">
            <span class="tp-leg-item"><span class="tp-leg-dot tp-leg-avail"></span> Disponible</span>
            <span class="tp-leg-item"><span class="tp-leg-dot tp-leg-sel"></span> Seleccionada</span>
            <span class="tp-leg-item"><span class="tp-leg-dot tp-leg-unavail"></span> Ocupada</span>
        </div>
    `;
}

function toggleWiTable(tableId) {
    tableId = Number(tableId);
    const idx = wiSelectedTableIds.indexOf(tableId);
    if (idx >= 0) wiSelectedTableIds.splice(idx, 1);
    else wiSelectedTableIds.push(tableId);
    _renderWiPicker(document.getElementById('wiTablePickerContainer'), _wiCachedTables, _wiGuests);
}

function clearWiTables() {
    wiSelectedTableIds = [];
    _renderWiPicker(document.getElementById('wiTablePickerContainer'), _wiCachedTables, _wiGuests);
}

async function submitWalkIn() {
    if (wiSelectedTableIds.length === 0) {
        showToast('Selecciona al menos una mesa', 'error');
        return;
    }

    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');

    const payload = {
        client_name: 'Walk-in',
        client_phone: '',
        date: currentDate,
        shift: currentShift,
        time: `${hh}:${mm}`,
        guests: _wiGuests,
        table_ids: wiSelectedTableIds,
        source: 'walk_in',
        duration_minutes: 120,
        notes: document.getElementById('wiNotes').value.trim(),
    };

    const btn = document.querySelector('.btn-walkin-lg');
    if (btn) { btn.disabled = true; btn.textContent = 'Guardando…'; }

    try {
        const res = await apiPost('/api/reservations', payload);
        // Immediately seat (mark as occupied)
        await apiPut(`/api/reservations/${res.id}/seat`, {});
        closeModal('modalWalkIn');
        showToast('✅ Walk-in sentado correctamente', 'success');
        if (typeof loadFloorPlan === 'function') await loadFloorPlan();
    } catch (e) {
        showToast('Error: ' + (e.message || 'No se pudo crear el walk-in'), 'error');
        if (btn) { btn.disabled = false; btn.textContent = '🪑 Sentar ahora'; }
    }
}

// Export CSV
function exportReservationsCSV() {
    const from = prompt('Desde (YYYY-MM-DD):', new Date().toISOString().split('T')[0]);
    if (!from) return;
    const to = prompt('Hasta (YYYY-MM-DD):', new Date().toISOString().split('T')[0]);
    if (!to) return;
    window.location.href = `/api/export/reservations.csv?from=${from}&to=${to}`;
}
