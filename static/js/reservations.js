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

// ── Bulk select state ────────────────────────────
let _selectMode = false;
let _selectedResIds = new Set();

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

// ── Day view state ───────────────────────────────
let _dayData = { comida: [], cena: [], stats: {} };

async function loadReservationsList() {
    try {
        const data = await apiGet(`/api/reservations/day?date=${currentDate}`);
        _dayData = data;
        allReservations = [...(data.comida || []), ...(data.cena || [])];
        updateDayStats(data.stats || {});
        applyDayFilters();
    } catch (e) {
        // fallback: load by shift as before
        const data = await apiGet(`/api/reservations?date=${currentDate}&shift=${currentShift}&all=true`);
        allReservations = data;
        _dayData = { comida: currentShift === 'comida' ? data : [], cena: currentShift === 'cena' ? data : [], stats: {} };
        applyDayFilters();
    }
}

function updateDayStats(stats) {
    const months = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
    const d = new Date(currentDate + 'T12:00:00');
    const today = new Date(); today.setHours(12,0,0,0);
    const label = d.getTime() === today.getTime() ? 'HOY' : `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
    const el = document.getElementById('dayViewDateLabel');
    if (el) el.textContent = label;

    const setEl = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    setEl('dayStat_comida_res', stats.comida_total ?? '—');
    setEl('dayStat_comida_guests', (stats.comida_guests ?? '—') + ' p');
    setEl('dayStat_cena_res', stats.cena_total ?? '—');
    setEl('dayStat_cena_guests', (stats.cena_guests ?? '—') + ' p');
    const total = (stats.comida_total || 0) + (stats.cena_total || 0);
    setEl('dayStat_total', total + ' reservas hoy');
}

function applyDayFilters() {
    const q = (document.getElementById('searchReservas')?.value || '').toLowerCase();
    const status = document.getElementById('filterStatus')?.value || 'all';
    const shiftFilter = document.getElementById('filterShiftDay')?.value || 'all';

    function filterList(list) {
        return list.filter(r => {
            const matchQ = !q ||
                r.client_name.toLowerCase().includes(q) ||
                (r.client_phone || '').includes(q) ||
                (r.table_numbers || []).some(n => String(n).includes(q));
            const matchStatus = status === 'all' || r.status === status;
            return matchQ && matchStatus;
        });
    }

    const comida = shiftFilter === 'cena' ? [] : filterList(_dayData.comida || []);
    const cena = shiftFilter === 'comida' ? [] : filterList(_dayData.cena || []);
    renderDayTimeline(comida, cena);
}

function renderDayTimeline(comida, cena) {
    // Exit select mode on re-render (date/shift change)
    if (_selectMode) toggleSelectMode();
    const container = document.getElementById('reservationsList');
    if (!comida.length && !cena.length) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📋</div>
                <div class="empty-state-text">No hay reservas para este día</div>
                <button class="btn-primary" style="margin-top:16px" onclick="openNewReservationModal()">+ Nueva Reserva</button>
            </div>`;
        return;
    }

    let html = '';
    if (comida.length) {
        html += `<div class="shift-block shift-block-comida">
            <div class="shift-block-header">
                <span class="shift-block-icon">☀️</span>
                <span class="shift-block-name">COMIDA</span>
                <span class="shift-block-count">${comida.length} res · ${comida.reduce((s,r)=>s+r.guests,0)} p</span>
            </div>
            <div class="shift-cards">${comida.map(r => renderResCard(r)).join('')}</div>
        </div>`;
    }
    if (cena.length) {
        html += `<div class="shift-block shift-block-cena">
            <div class="shift-block-header">
                <span class="shift-block-icon">🌙</span>
                <span class="shift-block-name">CENA</span>
                <span class="shift-block-count">${cena.length} res · ${cena.reduce((s,r)=>s+r.guests,0)} p</span>
            </div>
            <div class="shift-cards">${cena.map(r => renderResCard(r)).join('')}</div>
        </div>`;
    }
    container.innerHTML = html;

    // Attach event listeners
    container.querySelectorAll('.reservation-card').forEach(card => {
        const id = parseInt(card.dataset.id);
        card.addEventListener('click', (e) => {
            if (_selectMode) {
                e.stopPropagation();
                _toggleResSelection(id, card);
            } else {
                openEditReservation(id);
            }
        });
        card.addEventListener('dragstart', (e) => {
            if (_selectMode) { e.preventDefault(); return; }
            e.dataTransfer.setData('text/reservation-id', card.dataset.id);
            e.dataTransfer.effectAllowed = 'move';
            card.classList.add('dragging');
        });
        card.addEventListener('dragend', () => card.classList.remove('dragging'));
    });
}

function renderResCard(r) {
    const tablesLabel = (r.table_numbers && r.table_numbers.length > 0)
        ? (r.is_grouped ? `Mesas ${r.table_numbers.join(' + ')}` : `Mesa ${r.table_numbers[0]}`)
        : null;

    // Status color accent
    const statusAccents = {
        confirmed: 'accent-confirmed',
        seated: 'accent-seated',
        completed: 'accent-completed',
        cancelled: 'accent-cancelled',
        no_show: 'accent-noshow',
    };
    const accent = statusAccents[r.status] || '';

    return `
    <div class="reservation-card rc-day ${accent} ${r.is_grouped ? 'is-grouped' : ''}" data-id="${r.id}" draggable="true">
        <div class="rc-checkbox" aria-hidden="true"></div>
        <div class="rc-time-col">
            <div class="rc-time">${r.time}</div>
            <div class="rc-duration">${r.duration_minutes || 120}′</div>
        </div>
        <div class="rc-main">
            <div class="rc-name-row">
                <span class="rc-name">${r.client_name}</span>
                ${r.client && r.client.vip ? '<span class="badge badge-vip">VIP</span>' : ''}
                ${r.is_grouped ? '<span class="badge badge-group">GRUPO</span>' : ''}
                ${statusBadge(r.status)}
            </div>
            <div class="rc-meta">
                <span class="rc-guests">👥 ${r.guests} pers.</span>
                ${tablesLabel ? `<span class="rc-table-tag">🪑 ${tablesLabel}</span>` : '<span class="rc-table-tag rc-no-table">Sin mesa</span>'}
                ${sourceBadge(r.source)}
                ${r.client_phone ? `<span class="rc-phone">📞 ${r.client_phone}</span>` : ''}
            </div>
            ${r.notes ? `<div class="rc-notes">💬 ${r.notes}</div>` : ''}
        </div>
        <div class="rc-actions">
            ${r.status === 'confirmed' ? `
                <button class="rc-btn rc-btn-seat" onclick="event.stopPropagation(); quickSeat(${r.id})" title="Sentar">✓ Sentar</button>
                <button class="rc-btn rc-btn-noshow" onclick="event.stopPropagation(); quickNoShow(${r.id})" title="No Show">✗ N/S</button>
            ` : ''}
            ${r.status === 'seated' ? `
                <button class="rc-btn rc-btn-complete" onclick="event.stopPropagation(); quickComplete(${r.id})" title="Completar">✓ Completar</button>
            ` : ''}
            <button class="rc-btn rc-btn-edit" onclick="event.stopPropagation(); openEditReservation(${r.id})" title="Editar">✎</button>
            <button class="rc-btn rc-btn-delete" onclick="event.stopPropagation(); quickDelete(${r.id}, '${r.client_name.replace(/'/g, "\\'")}')" title="Eliminar">🗑</button>
        </div>
    </div>`;
}

// ── Search & Filter ─────────────────────────────

document.getElementById('searchReservas')?.addEventListener('input', applyDayFilters);
document.getElementById('filterStatus')?.addEventListener('change', applyDayFilters);
document.getElementById('filterShiftDay')?.addEventListener('change', applyDayFilters);

// Legacy renderReservationsList kept for refreshAll compatibility
function renderReservationsList(items) {
    allReservations = items;
    // Re-split into shifts for day view
    _dayData.comida = items.filter(r => r.shift === 'comida');
    _dayData.cena = items.filter(r => r.shift === 'cena');
    applyDayFilters();
}

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
        try {
            r = await apiGet(`/api/reservations/${resId}`);
        } catch(e) {
            console.warn('openEditReservation: not found', resId);
            return;
        }
    }
    if (!r) return;
    fillEditForm(r);
}

function fillEditForm(r) {
    document.getElementById('modalReservationTitle').textContent = 'Editar Reserva #' + r.id;
    document.getElementById('resEditId').value = r.id;
    document.getElementById('resName').value = r.client_name;
    document.getElementById('resPhone').value = r.client_phone || '';
    // Remove min constraint so past-dated reservations can be edited
    const dateInput = document.getElementById('resDate');
    dateInput.removeAttribute('min');
    dateInput.value = r.date;
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

// ── Guests counter +/- ──────────────────────────
function changeGuests(delta) {
    const input = document.getElementById('resGuests');
    if (!input) return;
    const current = parseInt(input.value) || 2;
    const next = Math.min(20, Math.max(1, current + delta));
    input.value = next;
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
    // Allow editing reservations on past dates
    if (!isEdit && resDate < today) {
        showToast('No se pueden crear reservas en fechas pasadas', 'error');
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
        table_id: null,
        duration_minutes: parseInt(document.getElementById('resDuration')?.value || 120),
    };

    // ── Optimistic INSTANT UI ────────────────────────────────────────────
    // Update the list, close the modal and toast BEFORE the network request,
    // so saving feels instant regardless of DB round-trip latency (Frankfurt).
    // The real server object reconciles the row on success; on error we roll
    // back and tell the user it was NOT saved.
    const optimistic = _buildOptimisticReservation(data, editId);
    const tempId = optimistic.id;
    const prevAll = allReservations.slice();

    if (editId) {
        const idx = allReservations.findIndex(r => r.id === Number(editId));
        if (idx >= 0) allReservations[idx] = optimistic; else allReservations.push(optimistic);
    } else {
        allReservations.push(optimistic);
    }
    _dayData[optimistic.shift] = allReservations.filter(r => r.shift === optimistic.shift);
    applyDayFilters();
    closeModal('modalReservation');
    showToast(
        editId ? 'Reserva actualizada'
               : (selectedTableIds.length > 1 ? `Reserva creada con ${selectedTableIds.length} mesas` : 'Reserva creada'),
        'success'
    );

    try {
        const saved = editId
            ? await apiPut(`/api/reservations/${editId}`, data)
            : await apiPost('/api/reservations', data);

        // Reconcile the optimistic row with the authoritative server object
        const i = allReservations.findIndex(r => r.id === tempId);
        if (i >= 0) allReservations[i] = saved; else allReservations.push(saved);
        _dayData[saved.shift] = allReservations.filter(r => r.shift === saved.shift);
        applyDayFilters();

        // Sync floor plan in background (no-await)
        if (typeof loadFloorPlan === 'function') loadFloorPlan();
    } catch (error) {
        // Roll back the optimistic change — the reservation was NOT saved
        allReservations = prevAll;
        _dayData.comida = allReservations.filter(r => r.shift === 'comida');
        _dayData.cena = allReservations.filter(r => r.shift === 'cena');
        applyDayFilters();
        if (typeof loadFloorPlan === 'function') loadFloorPlan();
        showToast(error.message || 'No se pudo guardar la reserva', 'error');
    }
}

/** Build a provisional reservation object from the form data + table cache,
 *  shaped like the API's to_dict() so the list can render it instantly. */
function _buildOptimisticReservation(data, editId) {
    const ids = (data.table_ids || []).map(Number);
    const infos = ids.map(id => (typeof getTableInfo === 'function' ? getTableInfo(id) : null)).filter(Boolean);
    const numbers = infos.map(i => i.number);
    const totalCap = infos.reduce((s, i) => s + (i.capacity || 0), 0);
    const base = editId ? (allReservations.find(r => r.id === Number(editId)) || {}) : {};
    return {
        ...base,
        id: editId ? Number(editId) : `tmp_${Date.now()}`,
        _optimistic: true,
        client_name: data.client_name,
        client_phone: data.client_phone,
        date: data.date,
        shift: data.shift,
        time: data.time,
        guests: data.guests,
        source: data.source,
        notes: data.notes,
        status: base.status || 'confirmed',
        table_id: ids[0] || null,
        table_ids: ids,
        table_number: numbers[0] || null,
        table_numbers: numbers,
        is_grouped: ids.length > 1,
        total_capacity: totalCap,
        duration_minutes: data.duration_minutes,
    };
}

// ── Quick Actions ───────────────────────────────

async function quickSeat(resId) {
    if (typeof _applyOptimistic === 'function') _applyOptimistic(resId, 'seated');
    showToast('Mesa sentada ✓', 'success');
    try { await apiPut(`/api/reservations/${resId}/seat`); } catch (e) { showToast('Error', 'error'); }
    debouncedRefresh();
}

async function quickComplete(resId) {
    if (typeof _applyOptimistic === 'function') _applyOptimistic(resId, 'free');
    showToast('Mesa completada ✓', 'success');
    try { await apiPut(`/api/reservations/${resId}/complete`); } catch (e) { showToast('Error', 'error'); }
    debouncedRefresh();
}

async function quickNoShow(resId) {
    if (typeof _applyOptimistic === 'function') _applyOptimistic(resId, 'free');
    showToast('Marcado como No Show', 'error');
    try { await apiPut(`/api/reservations/${resId}/noshow`); } catch (e) { showToast('Error', 'error'); }
    debouncedRefresh();
}

async function quickDelete(resId, name) {
    if (!confirm(`¿Eliminar definitivamente la reserva de ${name}?`)) return;
    if (typeof _applyOptimistic === 'function') _applyOptimistic(resId, 'free');
    if (typeof optimisticRemove === 'function') optimisticRemove(resId);
    showToast('Reserva eliminada');
    try {
        await apiDelete(`/api/reservations/${resId}/delete`);
    } catch (error) {
        showToast('Error al eliminar reserva', 'error');
    }
    debouncedRefresh();
}

// ── Bulk Select ─────────────────────────────────

function toggleSelectMode() {
    _selectMode = !_selectMode;
    _selectedResIds.clear();

    const btn = document.getElementById('btnSelectMode');
    const bar = document.getElementById('bulkBar');
    const list = document.getElementById('reservationsList');

    if (_selectMode) {
        btn.classList.add('active');
        btn.textContent = '✕ Cancelar';
        bar.classList.remove('hidden');
        list.classList.add('select-mode');
    } else {
        btn.classList.remove('active');
        btn.textContent = '☑ Seleccionar';
        bar.classList.add('hidden');
        list.classList.remove('select-mode');
        // Clear selected state on cards
        list.querySelectorAll('.reservation-card.rc-selected').forEach(c => c.classList.remove('rc-selected'));
    }
    _updateBulkBar();
}

function _toggleResSelection(id, card) {
    if (_selectedResIds.has(id)) {
        _selectedResIds.delete(id);
        card.classList.remove('rc-selected');
    } else {
        _selectedResIds.add(id);
        card.classList.add('rc-selected');
    }
    _updateBulkBar();
}

function _updateBulkBar() {
    const n = _selectedResIds.size;
    const countEl = document.getElementById('bulkCount');
    const deleteBtn = document.getElementById('btnBulkDelete');
    const selectAllBtn = document.getElementById('btnSelectAll');
    if (countEl) countEl.textContent = n === 1 ? '1 seleccionada' : `${n} seleccionadas`;
    if (deleteBtn) deleteBtn.disabled = n === 0;

    // Toggle "Seleccionar todo" / "Deseleccionar todo"
    const total = document.getElementById('reservationsList')
        ?.querySelectorAll('.reservation-card').length || 0;
    if (selectAllBtn) selectAllBtn.textContent = n === total && total > 0 ? 'Deseleccionar todo' : 'Seleccionar todo';
}

function bulkSelectAll() {
    const cards = document.getElementById('reservationsList')
        ?.querySelectorAll('.reservation-card') || [];
    const total = cards.length;
    const allSelected = _selectedResIds.size === total && total > 0;

    _selectedResIds.clear();
    cards.forEach(card => {
        card.classList.remove('rc-selected');
        if (!allSelected) {
            const id = parseInt(card.dataset.id);
            _selectedResIds.add(id);
            card.classList.add('rc-selected');
        }
    });
    _updateBulkBar();
}

async function bulkDelete() {
    const ids = [..._selectedResIds];
    if (ids.length === 0) return;
    if (!confirm(`¿Eliminar definitivamente ${ids.length} reserva${ids.length > 1 ? 's' : ''}? Esta acción no se puede deshacer.`)) return;

    const deleteBtn = document.getElementById('btnBulkDelete');
    if (deleteBtn) { deleteBtn.disabled = true; deleteBtn.textContent = 'Eliminando…'; }

    let ok = 0, fail = 0;
    for (const id of ids) {
        try {
            await apiDelete(`/api/reservations/${id}/delete`);
            ok++;
        } catch (e) {
            fail++;
        }
    }

    if (fail === 0) {
        showToast(`${ok} reserva${ok > 1 ? 's' : ''} eliminada${ok > 1 ? 's' : ''} ✓`, 'success');
    } else {
        showToast(`${ok} eliminadas, ${fail} con error`, 'error');
    }

    toggleSelectMode(); // exit select mode
    if (typeof loadFloorPlan === 'function') loadFloorPlan();
    refreshAll();
}

// ── Drag-drop: drop reservation card on a table ─────────────────────

async function assignReservationToTable(reservationId, tableId) {
    try {
        await apiPut(`/api/reservations/${reservationId}/assign-tables`, { table_ids: [tableId] });
        showToast('Mesa asignada', 'success');
    } catch (e) {
        showToast(e.message || 'Error al asignar mesa', 'error');
    }
    if (typeof loadFloorPlan === 'function') loadFloorPlan();
    refreshAll();
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
