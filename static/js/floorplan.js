/* ═══════════════════════════════════════════════
   SEASON - Interactive Floor Plan (SVG)
   - Modo agrupar mesas (click multi-select + reservar grupo)
   - Drag-drop: arrastrar reserva → mesa
   - Mesas agrupadas se muestran del mismo color con línea uniéndolas
   ═══════════════════════════════════════════════ */

let TABLE_DEFS = [
    // ZONA EXTERIOR
    { n: 50, cap: 2, type: 'normal', zone: 'ext', x: 33, y: 10, shape: 'rect', w: 7, h: 5 },
    { n: 52, cap: 2, type: 'normal', zone: 'ext', x: 43, y: 10, shape: 'rect', w: 7, h: 5 },
    { n: 54, cap: 2, type: 'normal', zone: 'ext', x: 53, y: 10, shape: 'rect', w: 7, h: 5 },
    { n: 56, cap: 2, type: 'normal', zone: 'ext', x: 63, y: 10, shape: 'rect', w: 7, h: 5 },
    { n: 58, cap: 2, type: 'normal', zone: 'ext', x: 76, y: 14, shape: 'rect', w: 5, h: 7 },
    { n: 62, cap: 4, type: 'normal', zone: 'ext', x: 38, y: 19, shape: 'rect', w: 8, h: 6 },
    { n: 60, cap: 4, type: 'normal', zone: 'ext', x: 53, y: 19, shape: 'rect', w: 8, h: 6 },
    { n: 70, cap: 2, type: 'alta', zone: 'ext', x: 14, y: 14, shape: 'rect', w: 7, h: 5 },

    // SALON PRINCIPAL
    { n: 1, cap: 4, type: 'normal', zone: 'sp', x: 7, y: 37, shape: 'rect', w: 8, h: 7 },
    { n: 2, cap: 2, type: 'normal', zone: 'sp', x: 20, y: 37, shape: 'rect', w: 7, h: 6 },
    { n: 3, cap: 6, type: 'normal', zone: 'sp', x: 32, y: 37, shape: 'rect', w: 10, h: 7 },
    { n: 6, cap: 4, type: 'normal', zone: 'sp', x: 7, y: 49, shape: 'rect', w: 8, h: 7 },
    { n: 4, cap: 4, type: 'normal', zone: 'sp', x: 22, y: 49, shape: 'rect', w: 8, h: 7 },
    { n: 7, cap: 4, type: 'normal', zone: 'sp', x: 5, y: 60, shape: 'rect', w: 8, h: 7 },
    { n: 8, cap: 4, type: 'normal', zone: 'sp', x: 17, y: 60, shape: 'rect', w: 8, h: 7 },
    { n: 9, cap: 2, type: 'normal', zone: 'sp', x: 29, y: 60, shape: 'rect', w: 7, h: 6 },
    { n: 10, cap: 2, type: 'normal', zone: 'sp', x: 39, y: 60, shape: 'rect', w: 7, h: 6 },
    { n: 14, cap: 4, type: 'normal', zone: 'sp', x: 5, y: 71, shape: 'rect', w: 8, h: 7 },
    { n: 12, cap: 4, type: 'normal', zone: 'sp', x: 19, y: 71, shape: 'rect', w: 8, h: 7 },
    { n: 11, cap: 2, type: 'normal', zone: 'sp', x: 33, y: 71, shape: 'rect', w: 7, h: 6 },
    { n: 15, cap: 4, type: 'normal', zone: 'sp', x: 7, y: 81, shape: 'rect', w: 8, h: 7 },
    { n: 16, cap: 4, type: 'normal', zone: 'sp', x: 20, y: 81, shape: 'rect', w: 8, h: 7 },
    { n: 17, cap: 4, type: 'normal', zone: 'sp', x: 33, y: 81, shape: 'rect', w: 8, h: 7 },
    { n: 22, cap: 4, type: 'normal', zone: 'sp', x: 5, y: 91, shape: 'rect', w: 8, h: 7 },
    { n: 20, cap: 4, type: 'normal', zone: 'sp', x: 18, y: 91, shape: 'rect', w: 8, h: 7 },
    { n: 19, cap: 2, type: 'normal', zone: 'sp', x: 31, y: 91, shape: 'rect', w: 7, h: 6 },
    { n: 18, cap: 6, type: 'normal', zone: 'sp', x: 42, y: 91, shape: 'rect', w: 10, h: 7 },

    // SALON INTERIOR
    { n: 30, cap: 4, type: 'normal', zone: 'si', x: 58, y: 37, shape: 'rect', w: 8, h: 7 },
    { n: 82, cap: 4, type: 'normal', zone: 'si', x: 72, y: 37, shape: 'rect', w: 8, h: 7 },
    { n: 34, cap: 4, type: 'normal', zone: 'si', x: 62, y: 50, shape: 'rect', w: 8, h: 7 },
    { n: 36, cap: 4, type: 'normal', zone: 'si', x: 65, y: 65, shape: 'rect', w: 8, h: 7 },
    { n: 40, cap: 8, type: 'alta', zone: 'si', x: 66, y: 82, shape: 'rect', w: 16, h: 7 },
];

// Apply saved positions/capacities from localStorage
(function _applySavedTableDefs() {
    try {
        const saved = localStorage.getItem('season_table_defs');
        if (saved) {
            const patches = JSON.parse(saved);
            TABLE_DEFS.forEach(def => {
                if (patches[def.n]) Object.assign(def, patches[def.n]);
            });
        }
    } catch (e) {}
})();

let tableDataMap = {};
let groupMode = false;
let groupSelectedTables = []; // table numbers

// Color palette for group reservations (assigned by index)
const GROUP_COLORS = ['#a78bfa', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#ec4899', '#8b5cf6'];

// ── Floor Plan Edit Mode ──────────────────────────
let _editMode = false;
let _editDrag = null; // { defIdx, offX, offY }
let _editDidDrag = false; // true if mouse moved during drag (prevents click-to-edit after drag)
let _editCapTableNumber = null;
let _editCapValue = 4;

function toggleEditMode() {
    _editMode = !_editMode;
    const btn = document.getElementById('btnEditPlan');
    const bar = document.getElementById('editPlanBar');
    if (btn) btn.classList.toggle('active', _editMode);
    if (bar) bar.classList.toggle('hidden', !_editMode);
    const svg = document.getElementById('floorplanSVG');
    if (svg) svg.style.cursor = _editMode ? 'grab' : '';
    if (!_editMode) _editDrag = null;
    renderFloorPlan();
}

function saveEditPlan() {
    const patches = {};
    TABLE_DEFS.forEach(def => {
        patches[def.n] = { x: def.x, y: def.y, w: def.w, h: def.h, cap: def.cap, type: def.type };
    });
    localStorage.setItem('season_table_defs', JSON.stringify(patches));
    showToast('Plano guardado ✓', 'success');
}

function resetEditPlan() {
    if (!confirm('¿Restaurar el plano original? Se perderán todos los cambios guardados.')) return;
    localStorage.removeItem('season_table_defs');
    location.reload();
}

function openCapacityEditor(tableNumber) {
    const def = TABLE_DEFS.find(d => d.n === tableNumber);
    if (!def) return;
    // Use DB value if available, fallback to TABLE_DEFS
    const td = tableDataMap[tableNumber];
    const currentCap = (td?.capacity ?? def.cap) || def.cap;
    const currentType = (td?.table_type ?? def.type) || def.type;

    _editCapTableNumber = tableNumber;
    _editCapValue = currentCap;

    const title = document.getElementById('tableDetailTitle');
    const content = document.getElementById('tableDetailContent');
    title.textContent = `✏️ Configurar Mesa ${tableNumber}`;
    content.innerHTML = `
        <div style="background:#fff3cd;border-radius:8px;padding:10px 12px;font-size:12px;color:#92400e;margin-bottom:16px">
            ✏️ Modo edición — cambia la capacidad y guarda
        </div>

        <div style="margin-bottom:16px">
            <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:8px">
                Comensales (capacidad de la mesa)
            </label>
            <div style="display:flex;align-items:center;gap:12px">
                <button class="qo-cnt-btn" style="width:40px;height:40px;font-size:20px" onclick="editCapChange(-1)">−</button>
                <input type="number" id="editCapInput" value="${currentCap}" min="1" max="20"
                    style="width:70px;text-align:center;font-size:24px;font-weight:800;border:2px solid #1a8a7d;border-radius:10px;padding:6px;color:#1a8a7d"
                    oninput="_editCapValue=Math.max(1,Math.min(20,+this.value||1));document.getElementById('editCapVal').textContent=_editCapValue">
                <button class="qo-cnt-btn" style="width:40px;height:40px;font-size:20px" onclick="editCapChange(1)">+</button>
                <span style="color:#6b7280;font-size:13px">personas</span>
            </div>
            <span style="font-size:11px;color:#9ca3af" id="editCapVal" style="display:none">${currentCap}</span>
        </div>

        <div style="margin-bottom:20px">
            <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:8px">Tipo de mesa</label>
            <div style="display:flex;gap:8px">
                <label style="flex:1;display:flex;align-items:center;gap:8px;padding:10px 12px;border:2px solid ${currentType==='normal'?'#1a8a7d':'#e5e7eb'};border-radius:10px;cursor:pointer;background:${currentType==='normal'?'#f0fdf9':'#fff'}">
                    <input type="radio" name="editType" value="normal" ${currentType==='normal'?'checked':''} onchange="document.querySelectorAll('[name=editType]').forEach((r,i)=>{r.parentElement.style.borderColor=r.checked?'#1a8a7d':'#e5e7eb';r.parentElement.style.background=r.checked?'#f0fdf9':'#fff'})">
                    🪑 Normal
                </label>
                <label style="flex:1;display:flex;align-items:center;gap:8px;padding:10px 12px;border:2px solid ${currentType==='alta'?'#1a8a7d':'#e5e7eb'};border-radius:10px;cursor:pointer;background:${currentType==='alta'?'#f0fdf9':'#fff'}">
                    <input type="radio" name="editType" value="alta" ${currentType==='alta'?'checked':''} onchange="document.querySelectorAll('[name=editType]').forEach((r,i)=>{r.parentElement.style.borderColor=r.checked?'#1a8a7d':'#e5e7eb';r.parentElement.style.background=r.checked?'#f0fdf9':'#fff'})">
                    🍽️ Alta
                </label>
            </div>
        </div>

        <div style="display:flex;gap:8px">
            <button class="btn-primary" style="flex:1;padding:13px" onclick="saveCapacityEdit(${tableNumber})">
                💾 Guardar cambios
            </button>
            <button class="btn-secondary" style="flex:1" onclick="closeModal('modalTableDetail')">Cancelar</button>
        </div>
    `;
    openModal('modalTableDetail');
}

function editCapChange(delta) {
    _editCapValue = Math.max(1, Math.min(20, _editCapValue + delta));
    const inp = document.getElementById('editCapInput');
    if (inp) inp.value = _editCapValue;
    const el = document.getElementById('editCapVal');
    if (el) el.textContent = _editCapValue;
}

async function saveCapacityEdit(tableNumber) {
    const def = TABLE_DEFS.find(d => d.n === tableNumber);
    if (!def) return;
    // Read from typed input first (user may have typed a number directly)
    const inp = document.getElementById('editCapInput');
    if (inp) _editCapValue = Math.max(1, Math.min(20, parseInt(inp.value) || _editCapValue));
    const newCap = _editCapValue;
    const typeRadio = document.querySelector('input[name="editType"]:checked');
    const newType = typeRadio ? typeRadio.value : def.type;

    // Update in-memory TABLE_DEFS immediately
    def.cap = newCap;
    def.type = newType;

    // Also update tableDataMap so the modal reflects the new value right away
    if (tableDataMap[tableNumber]) {
        tableDataMap[tableNumber] = { ...tableDataMap[tableNumber], capacity: newCap, table_type: newType };
    }

    closeModal('modalTableDetail');
    renderFloorPlan();
    showToast(`Mesa ${tableNumber} · ${newCap}p guardando…`, 'success');

    // Persist to DB via API
    const td = tableDataMap[tableNumber];
    const tableId = td?.id;
    if (tableId) {
        try {
            await apiPut(`/api/tables/${tableId}`, { capacity: newCap, table_type: newType });
            showToast(`Mesa ${tableNumber} · ${newCap}p actualizada ✓`, 'success');
        } catch (e) {
            showToast(`Mesa ${tableNumber} guardada localmente (error API)`, 'error');
        }
    } else {
        showToast(`Mesa ${tableNumber} · ${newCap}p (guarda el plano para persistir)`, 'success');
    }
}

async function loadFloorPlan() {
    const data = await apiGet(`/api/tables/status?date=${currentDate}&shift=${currentShift}`);
    tableDataMap = {};
    let unassigned = null;
    data.forEach(t => {
        if (t._unassigned) {
            unassigned = t;
        } else {
            tableDataMap[t.number] = t;
        }
    });
    if (unassigned) tableDataMap._unassigned = unassigned;
    renderFloorPlan();
}

function toggleGroupMode() {
    groupMode = !groupMode;
    groupSelectedTables = [];
    const btn = document.getElementById('btnGroupMode');
    if (btn) {
        btn.classList.toggle('active', groupMode);
        btn.textContent = groupMode ? '✓ Modo Agrupar' : '🔗 Agrupar mesas';
    }
    document.getElementById('floorplanSVG')?.classList.toggle('group-mode', groupMode);
    renderFloorPlan();
    updateGroupBar();
}

function updateGroupBar() {
    let bar = document.getElementById('groupActionBar');
    if (!bar) return;
    if (groupSelectedTables.length === 0) {
        bar.classList.add('hidden');
        return;
    }
    bar.classList.remove('hidden');
    const totalCap = groupSelectedTables.reduce((s, n) => {
        const t = TABLE_DEFS.find(x => x.n === n);
        return s + (t ? t.cap : 0);
    }, 0);
    bar.innerHTML = `
        <div class="group-bar-info">
            <strong>${groupSelectedTables.length} mesas</strong>
            seleccionadas
            <span class="group-cap">${totalCap} plazas</span>
            <span class="group-tables">${groupSelectedTables.join(' + ')}</span>
        </div>
        <div class="group-bar-actions">
            <button class="btn-secondary btn-sm" onclick="clearGroupSelection()">Limpiar</button>
            <button class="btn-primary btn-sm" onclick="reserveGroup()">+ Reservar grupo</button>
        </div>
    `;
}

function clearGroupSelection() {
    groupSelectedTables = [];
    renderFloorPlan();
    updateGroupBar();
}

function reserveGroup() {
    if (groupSelectedTables.length === 0) return;
    // Convert table numbers to table IDs
    const tableIds = groupSelectedTables
        .map(n => tableDataMap[n]?.id)
        .filter(Boolean);
    if (tableIds.length === 0) {
        showToast('No se pudieron resolver IDs de mesas', 'error');
        return;
    }
    openNewReservationModal(tableIds);
    // Exit group mode
    groupMode = false;
    groupSelectedTables = [];
    const btn = document.getElementById('btnGroupMode');
    if (btn) {
        btn.classList.remove('active');
        btn.textContent = '🔗 Agrupar mesas';
    }
    document.getElementById('floorplanSVG')?.classList.remove('group-mode');
    updateGroupBar();
}

function handleTableClick(tableNumber) {
    if (groupMode) {
        const idx = groupSelectedTables.indexOf(tableNumber);
        if (idx >= 0) {
            groupSelectedTables.splice(idx, 1);
        } else {
            groupSelectedTables.push(tableNumber);
        }
        renderFloorPlan();
        updateGroupBar();
    } else {
        openTableDetail(tableNumber);
    }
}

// ── Quick Occupy Popover ────────────────────────

let _qoGuests = 2;
let _qoTableNumber = null;

function showQuickOccupyPopover(tableNumber) {
    _qoTableNumber = tableNumber;
    const td = tableDataMap[tableNumber];
    if (!td) return;

    _qoGuests = Math.min(2, td.capacity || 2);

    // Position popover near the table in the SVG
    const svg = document.getElementById('floorplanSVG');
    const def = (typeof TABLE_DEFS !== 'undefined') ? TABLE_DEFS.find(d => d.n === tableNumber) : null;
    let popX = 50, popY = 50; // defaults (%)

    if (def && svg) {
        const svgRect = svg.getBoundingClientRect();
        const vb = svg.viewBox.baseVal;
        // Convert SVG coords to page coords
        const svgCenterX = def.x + def.w / 2;
        const svgCenterY = def.y + def.h / 2;
        const scaleX = svgRect.width / vb.width;
        const scaleY = svgRect.height / vb.height;
        const pageX = svgRect.left + svgCenterX * scaleX;
        const pageY = svgRect.top + svgCenterY * scaleY + window.scrollY;

        const pop = document.getElementById('quickOccupyPopover');
        pop.style.left = (pageX - 90) + 'px';
        pop.style.top = (pageY - 140) + 'px';
        pop.style.right = 'auto';
    }

    renderQuickOccupyPopover(td);
    const pop = document.getElementById('quickOccupyPopover');
    pop.classList.remove('hidden');

    // Close on outside click
    setTimeout(() => {
        document.addEventListener('click', _closeQoOnOutside, { once: false });
    }, 10);
}

function _closeQoOnOutside(e) {
    const pop = document.getElementById('quickOccupyPopover');
    if (pop && !pop.contains(e.target)) {
        closeQuickOccupy();
        document.removeEventListener('click', _closeQoOnOutside);
    }
}

function closeQuickOccupy() {
    document.getElementById('quickOccupyPopover')?.classList.add('hidden');
    document.removeEventListener('click', _closeQoOnOutside);
    _qoTableNumber = null;
}

function renderQuickOccupyPopover(td) {
    const def = TABLE_DEFS.find(d => d.n === (td.number || _qoTableNumber));
    const cap = td.capacity ?? (def ? def.cap : 4);
    const zone = td.zone ?? (def ? def.zone : '');
    const pop = document.getElementById('quickOccupyPopover');
    if (!pop) return;
    pop.innerHTML = `
        <div class="qo-header">
            <span class="qo-title">Mesa ${td.number || _qoTableNumber}</span>
            <span class="qo-zone">${zoneName(zone)} · ${cap}p max</span>
            <button class="qo-close" onclick="closeQuickOccupy()">✕</button>
        </div>
        <div class="qo-body">
            <div class="qo-question">¿Cuántas personas?</div>
            <div class="qo-counter">
                <button class="qo-cnt-btn" onclick="qoChangeGuests(-1)">−</button>
                <span class="qo-cnt-val" id="qoGuestsVal">${_qoGuests}</span>
                <button class="qo-cnt-btn" onclick="qoChangeGuests(1)">+</button>
            </div>
            <button class="qo-occupy-btn" onclick="quickOccupyConfirm()">
                🟢 Ocupar mesa
            </button>
            <button class="qo-details-link" onclick="closeQuickOccupy(); openTableDetail(${td.number})">
                Ver detalles / Reservar →
            </button>
        </div>
    `;
}

function qoChangeGuests(delta) {
    const td = tableDataMap[_qoTableNumber];
    const cap = td ? td.capacity : 14;
    _qoGuests = Math.max(1, Math.min(cap, _qoGuests + delta));
    const el = document.getElementById('qoGuestsVal');
    if (el) el.textContent = _qoGuests;
}

async function quickOccupyConfirm() {
    const td = tableDataMap[_qoTableNumber];
    if (!td) return;

    // Optimistic: mark occupied on map immediately
    tableDataMap[_qoTableNumber] = {
        ...td,
        status: 'seated',
        reservation: {
            id: -1,
            client_name: 'Walk-in',
            guests: _qoGuests,
            time: new Date().toTimeString().slice(0,5),
            status: 'seated',
            source: 'walk_in',
            is_grouped: false,
            table_numbers: [td.number],
        }
    };
    closeQuickOccupy();
    renderFloorPlan();

    try {
        await apiPost(`/api/tables/${td.id}/quick-occupy`, {
            guests: _qoGuests,
            shift: currentShift,
        });
        showToast(`Mesa ${td.number} ocupada · ${_qoGuests}p`, 'success');
        await refreshAll();
    } catch (e) {
        showToast('Error al ocupar mesa', 'error');
        await refreshAll(); // restore correct state
    }
}

/* Build map: tableId → reservation_id (to identify groups of tables sharing a reservation) */
function buildReservationGroupsMap() {
    const map = new Map(); // tableNumber -> {resId, color, tables: [numbers]}
    const resIdToTables = new Map(); // resId -> [tableNumbers]

    Object.values(tableDataMap).forEach(td => {
        if (td.reservation && td.reservation.is_grouped) {
            const resId = td.reservation.id;
            if (!resIdToTables.has(resId)) resIdToTables.set(resId, []);
            resIdToTables.get(resId).push(td.number);
        }
    });

    let colorIdx = 0;
    resIdToTables.forEach((tables, resId) => {
        const color = GROUP_COLORS[colorIdx % GROUP_COLORS.length];
        colorIdx++;
        tables.forEach(tnum => map.set(tnum, { resId, color, tables }));
    });
    return map;
}

function _svgCoords(e, svg) {
    const rect = svg.getBoundingClientRect();
    const vb = svg.viewBox.baseVal;
    // Support both mouse and touch events
    const src = (e.touches && e.touches.length) ? e.touches[0]
              : (e.changedTouches && e.changedTouches.length) ? e.changedTouches[0]
              : e;
    return {
        x: (src.clientX - rect.left) / rect.width * vb.width,
        y: (src.clientY - rect.top) / rect.height * vb.height,
    };
}

function renderFloorPlan() {
    const svg = document.getElementById('floorplanSVG');
    svg.querySelectorAll('.table-group, .group-link-line, .unassigned-reservations-box').forEach(g => g.remove());

    // Edit mode: wire up SVG-level drag listeners (mouse + touch)
    if (_editMode) {
        const onMove = (e) => {
            if (!_editDrag) return;
            if (e.cancelable) e.preventDefault();
            const pt = _svgCoords(e, svg);
            const def = TABLE_DEFS[_editDrag.defIdx];
            const newX = Math.max(0, Math.round((pt.x - _editDrag.offX) * 2) / 2);
            const newY = Math.max(0, Math.round((pt.y - _editDrag.offY) * 2) / 2);
            if (Math.abs(newX - _editDrag.origX) > 0.5 || Math.abs(newY - _editDrag.origY) > 0.5) {
                _editDidDrag = true;
            }
            def.x = newX;
            def.y = newY;
            svg.querySelectorAll('.table-group').forEach(g => {
                if (+g.dataset.tableNumber === def.n) {
                    g.setAttribute('transform', `translate(${def.x - _editDrag.origX},${def.y - _editDrag.origY})`);
                }
            });
        };
        const onUp = () => {
            if (!_editDrag) return;
            const wasDrag = _editDidDrag;
            const tableNum = TABLE_DEFS[_editDrag.defIdx]?.n;
            _editDrag = null;
            svg.style.cursor = 'grab';
            if (wasDrag) {
                renderFloorPlan(); // redraw after reposition
            } else if (tableNum != null) {
                openCapacityEditor(tableNum); // simple tap/click → edit capacity
            }
        };
        svg.onmousemove   = onMove;
        svg.onmouseup     = onUp;
        svg.onmouseleave  = () => { if (_editDrag) { _editDrag = null; renderFloorPlan(); } };
        svg.ontouchmove   = onMove;
        svg.ontouchend    = onUp;
        svg.style.cursor  = 'grab';
    } else {
        svg.onmousemove  = null;
        svg.onmouseup    = null;
        svg.onmouseleave = null;
        svg.ontouchmove  = null;
        svg.ontouchend   = null;
    }

    const groupsMap = buildReservationGroupsMap();

    // Draw lines connecting tables in same reservation group
    const drawnPairs = new Set();
    groupsMap.forEach((info, tnum) => {
        info.tables.forEach(otherNum => {
            if (otherNum === tnum) return;
            const pairKey = [tnum, otherNum].sort().join('-');
            if (drawnPairs.has(pairKey)) return;
            drawnPairs.add(pairKey);
            const t1 = TABLE_DEFS.find(t => t.n === tnum);
            const t2 = TABLE_DEFS.find(t => t.n === otherNum);
            if (!t1 || !t2) return;
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', t1.x + t1.w/2);
            line.setAttribute('y1', t1.y + t1.h/2);
            line.setAttribute('x2', t2.x + t2.w/2);
            line.setAttribute('y2', t2.y + t2.h/2);
            line.setAttribute('stroke', info.color);
            line.setAttribute('stroke-width', '0.6');
            line.setAttribute('stroke-dasharray', '0.5,0.5');
            line.setAttribute('opacity', '0.7');
            line.classList.add('group-link-line');
            svg.appendChild(line);
        });
    });

    // Unassigned reservations panel
    if (tableDataMap._unassigned && tableDataMap._unassigned.unassignedReservations.length > 0) {
        const unassignedBox = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        unassignedBox.classList.add('unassigned-reservations-box');

        const items = tableDataMap._unassigned.unassignedReservations;
        const boxHeight = Math.max(8, 5 + items.length * 1.5);
        const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        bg.setAttribute('x', '2');
        bg.setAttribute('y', '2');
        bg.setAttribute('width', '22');
        bg.setAttribute('height', boxHeight);
        bg.setAttribute('fill', '#fff7ed');
        bg.setAttribute('stroke', '#f59e0b');
        bg.setAttribute('stroke-width', '0.3');
        bg.setAttribute('rx', '0.5');
        unassignedBox.appendChild(bg);

        const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        title.setAttribute('x', '3');
        title.setAttribute('y', '4');
        title.setAttribute('font-size', '1.2');
        title.setAttribute('font-weight', 'bold');
        title.setAttribute('fill', '#92400e');
        title.textContent = `📋 Por asignar (${items.length})`;
        unassignedBox.appendChild(title);

        let yPos = 5.8;
        items.slice(0, 6).forEach(r => {
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', '3.5');
            text.setAttribute('y', yPos);
            text.setAttribute('font-size', '0.9');
            text.setAttribute('fill', '#7c2d12');
            text.style.cursor = 'pointer';
            text.textContent = `• ${r.client_name.substring(0, 18)} (${r.guests}p) ${r.time}`;
            text.addEventListener('click', () => openEditReservation(r.id));
            unassignedBox.appendChild(text);
            yPos += 1.5;
        });
        svg.appendChild(unassignedBox);
    }

    TABLE_DEFS.forEach(def => {
        const td = tableDataMap[def.n] || {};
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.classList.add('table-group');
        if (td.status && td.status !== 'free') {
            g.classList.add('status-' + td.status);
        }
        const groupInfo = groupsMap.get(def.n);
        if (groupInfo) {
            g.classList.add('is-group-table');
            g.dataset.groupColor = groupInfo.color;
        }
        if (groupMode && groupSelectedTables.includes(def.n)) {
            g.classList.add('group-selected');
        }
        g.dataset.tableNumber = def.n;
        g.dataset.tableId = td.id || '';

        const cx = def.x + def.w / 2;
        const cy = def.y + def.h / 2;

        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', def.x);
        rect.setAttribute('y', def.y);
        rect.setAttribute('width', def.w);
        rect.setAttribute('height', def.h);
        rect.setAttribute('rx', '1');
        rect.classList.add('table-rect');
        if (groupInfo) {
            rect.setAttribute('stroke', groupInfo.color);
            rect.setAttribute('stroke-width', '0.5');
        }
        g.appendChild(rect);

        drawChairs(g, def);

        const num = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        num.setAttribute('x', cx);
        num.setAttribute('y', cy - 0.5);
        num.classList.add('table-number');
        num.textContent = def.n;
        g.appendChild(num);

        const capLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        capLabel.setAttribute('x', cx);
        capLabel.setAttribute('y', cy + 2.3);
        capLabel.classList.add('table-capacity');
        capLabel.textContent = def.cap + 'p';
        g.appendChild(capLabel);

        // Blocked overlay: lock icon + diagonal stripes
        if (td.blocked) {
            const lockText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            lockText.setAttribute('x', cx);
            lockText.setAttribute('y', def.y + def.h - 1.2);
            lockText.setAttribute('text-anchor', 'middle');
            lockText.setAttribute('font-size', '3');
            lockText.textContent = '🔒';
            g.appendChild(lockText);
        }

        if (def.type === 'alta') {
            const altaLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            altaLabel.setAttribute('x', cx);
            altaLabel.setAttribute('y', def.y - 0.8);
            altaLabel.classList.add('table-type-label');
            altaLabel.textContent = 'alta';
            g.appendChild(altaLabel);
        }

        if (td.reservation) {
            const r = td.reservation;
            const nameText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            nameText.setAttribute('x', cx);
            nameText.setAttribute('y', def.y + def.h + 2);
            nameText.classList.add('table-client-name');
            nameText.textContent = r.client_name.length > 12
                ? r.client_name.substring(0, 11) + '…'
                : r.client_name;
            g.appendChild(nameText);

            const timeText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            timeText.setAttribute('x', cx);
            timeText.setAttribute('y', def.y + def.h + 3.8);
            timeText.classList.add('table-time-label');
            timeText.textContent = r.time + ' · ' + r.guests + 'p';
            g.appendChild(timeText);
        }

        if (_editMode) {
            g.style.cursor = 'grab';
            const onDragStart = (e) => {
                e.preventDefault();
                e.stopPropagation();
                _editDidDrag = false;
                const pt = _svgCoords(e, svg);
                _editDrag = {
                    defIdx: TABLE_DEFS.indexOf(def),
                    offX: pt.x - def.x,
                    offY: pt.y - def.y,
                    origX: def.x,
                    origY: def.y,
                };
                svg.style.cursor = 'grabbing';
            };
            g.addEventListener('mousedown', onDragStart);
            g.addEventListener('touchstart', onDragStart, { passive: false });
        } else {
            g.addEventListener('click', () => handleTableClick(def.n));
        }

        // Drag-drop receptor: accept a reservation card dropped on this table
        g.addEventListener('dragover', (e) => {
            const tid = e.dataTransfer?.getData('text/reservation-id');
            // dataTransfer types not always readable on dragover, so be permissive
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            g.classList.add('drop-target');
        });
        g.addEventListener('dragleave', () => g.classList.remove('drop-target'));
        g.addEventListener('drop', (e) => {
            e.preventDefault();
            g.classList.remove('drop-target');
            const reservationId = e.dataTransfer.getData('text/reservation-id');
            if (reservationId && td.id) {
                assignReservationToTable(reservationId, td.id);
            }
        });

        svg.appendChild(g);
    });
}

function drawChairs(g, def) {
    const r = 0.8;
    const positions = getChairPositions(def);
    positions.forEach(([cx, cy]) => {
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', cx);
        circle.setAttribute('cy', cy);
        circle.setAttribute('r', r);
        circle.classList.add('chair');
        g.appendChild(circle);
    });
}

function getChairPositions(def) {
    const { x, y, w, h, cap } = def;
    const positions = [];
    const pad = 1.4;

    if (cap === 2) {
        if (w >= h) {
            positions.push([x + w * 0.35, y - pad]);
            positions.push([x + w * 0.65, y + h + pad]);
        } else {
            positions.push([x - pad, y + h * 0.5]);
            positions.push([x + w + pad, y + h * 0.5]);
        }
    } else if (cap === 4) {
        positions.push([x + w * 0.35, y - pad]);
        positions.push([x + w * 0.65, y - pad]);
        positions.push([x + w * 0.35, y + h + pad]);
        positions.push([x + w * 0.65, y + h + pad]);
    } else if (cap === 6) {
        positions.push([x + w * 0.25, y - pad]);
        positions.push([x + w * 0.5, y - pad]);
        positions.push([x + w * 0.75, y - pad]);
        positions.push([x + w * 0.25, y + h + pad]);
        positions.push([x + w * 0.5, y + h + pad]);
        positions.push([x + w * 0.75, y + h + pad]);
    } else if (cap === 8) {
        positions.push([x + w * 0.2, y - pad]);
        positions.push([x + w * 0.4, y - pad]);
        positions.push([x + w * 0.6, y - pad]);
        positions.push([x + w * 0.8, y - pad]);
        positions.push([x + w * 0.2, y + h + pad]);
        positions.push([x + w * 0.4, y + h + pad]);
        positions.push([x + w * 0.6, y + h + pad]);
        positions.push([x + w * 0.8, y + h + pad]);
    }
    return positions;
}

function openTableDetail(tableNumber) {
    const td = tableDataMap[tableNumber];
    if (!td) return;

    // TABLE_DEFS always has correct capacity/zone even if DB doesn't return them
    const def = TABLE_DEFS.find(d => d.n === tableNumber);
    const tdCap   = td.capacity  ?? (def ? def.cap  : 4);
    const tdZone  = td.zone      ?? (def ? def.zone  : '');
    const tdType  = td.table_type ?? (def ? def.type  : 'normal');

    const isBlocked = td.blocked === true;
    // Initialise inline-edit guests counter from current reservation (if any)
    _ieGuests = td.reservation ? td.reservation.guests : Math.min(2, tdCap ?? 2);

    const title = document.getElementById('tableDetailTitle');
    const content = document.getElementById('tableDetailContent');
    title.textContent = `Mesa ${tableNumber} · ${zoneName(tdZone)}`;
    _qopGuests = Math.min(2, tdCap); // reset counter on each open

    let html = `
        <div class="detail-section">
            <div class="detail-row"><span class="label">Capacidad</span><span class="value">${tdCap} personas</span></div>
            <div class="detail-row"><span class="label">Tipo</span><span class="value">${tdType === 'alta' ? 'Mesa Alta' : 'Normal'}</span></div>
            <div class="detail-row"><span class="label">Estado</span>${
                isBlocked
                    ? '<span class="badge" style="background:#f3f4f6;color:#374151;border:1px solid #d1d5db">🔒 Congelada</span>'
                    : td.status === 'free'
                        ? '<span class="badge badge-green">Libre</span>'
                        : statusBadge(td.status)
            }</div>
        </div>

        <!-- Acciones de configuración -->
        <div style="display:flex;gap:8px;margin-bottom:12px">
            <button class="btn-secondary btn-sm" style="flex:1" onclick="closeModal('modalTableDetail');openCapacityEditor(${tableNumber})">
                ✏️ Cambiar capacidad
            </button>
            <button class="${isBlocked ? 'btn-unblock' : 'btn-block'} btn-sm" style="flex:1"
                onclick="toggleTableBlocked(${td.id}, ${tableNumber}, ${isBlocked})">
                ${isBlocked ? '🔓 Descongelar' : '🔒 Congelar mesa'}
            </button>
        </div>
    `;

    const allRes = td.reservations || (td.reservation ? [td.reservation] : []);

    if (allRes.length > 0) {
        // ── Show ALL sittings for this table in this shift ──
        allRes.forEach((r, idx) => {
            const isQuickOccupy = r.source === 'walk_in' && r.client_name === 'Walk-in';
            const safeName  = r.client_name.replace(/"/g, '&quot;');
            const safePhone = (r.client_phone || '').replace(/"/g, '&quot;');
            const safeNotes = (r.notes || '').replace(/"/g, '&quot;');
            const isFirst   = idx === 0;

            html += `
            <div class="detail-section" style="${idx > 0 ? 'margin-top:12px;border-top:1px solid #f3f4f6;padding-top:12px' : ''}">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
                    <h4 style="margin:0;font-size:13px">
                        ${allRes.length > 1 ? `<span style="background:#e0f2fe;color:#0369a1;border-radius:10px;padding:1px 7px;font-size:11px;margin-right:4px">${idx+1}º turno</span>` : 'Reserva activa'}
                        ${r.is_grouped ? '<span class="badge badge-group">GRUPO ' + r.table_numbers.join('+') + '</span>' : ''}
                    </h4>
                    <span style="font-size:11px;color:#6b7280">${r.time} · ${r.duration_minutes||120}min · ${sourceBadge(r.source)}</span>
                </div>

                <div class="inline-edit-form">
                    <div class="ie-row">
                        <label class="ie-label">Nombre</label>
                        <input class="ie-input" id="ieResName_${r.id}" value="${safeName}" placeholder="Nombre del cliente">
                    </div>
                    <div class="ie-row">
                        <label class="ie-label">Teléfono</label>
                        <input class="ie-input" id="ieResPhone_${r.id}" value="${safePhone}" type="tel" placeholder="—">
                    </div>
                    <div class="ie-row">
                        <label class="ie-label">Comensales</label>
                        <div style="display:flex;align-items:center;gap:8px">
                            <button class="qo-cnt-btn" style="width:32px;height:32px;font-size:16px"
                                onclick="document.getElementById('ieGuestsVal_${r.id}').dataset.v=Math.max(1,+(document.getElementById('ieGuestsVal_${r.id}').dataset.v||${r.guests})-1);document.getElementById('ieGuestsVal_${r.id}').textContent=document.getElementById('ieGuestsVal_${r.id}').dataset.v">−</button>
                            <span id="ieGuestsVal_${r.id}" data-v="${r.guests}"
                                style="font-size:18px;font-weight:800;color:#1a8a7d;min-width:24px;text-align:center">${r.guests}</span>
                            <button class="qo-cnt-btn" style="width:32px;height:32px;font-size:16px"
                                onclick="document.getElementById('ieGuestsVal_${r.id}').dataset.v=Math.min(${Math.min(tdCap+4,14)},+(document.getElementById('ieGuestsVal_${r.id}').dataset.v||${r.guests})+1);document.getElementById('ieGuestsVal_${r.id}').textContent=document.getElementById('ieGuestsVal_${r.id}').dataset.v">+</button>
                            <span style="font-size:12px;color:#9ca3af">/ ${tdCap}p aforo</span>
                        </div>
                    </div>
                    <div class="ie-row">
                        <label class="ie-label">Notas</label>
                        <input class="ie-input" id="ieResNotes_${r.id}" value="${safeNotes}" placeholder="Alergias, preferencias…">
                    </div>
                </div>

                <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">
                    <button class="btn-primary btn-sm" style="flex:1" onclick="saveInlineReservationV2(${r.id}, ${tableNumber})">
                        💾 Guardar
                    </button>
            `;
            if (r.status === 'confirmed') {
                html += `<button class="btn-secondary btn-sm" onclick="seatFromPlan(${r.id})">✓ Sentar</button>`;
                html += `<button class="btn-danger btn-sm" onclick="cancelFromPlan(${r.id})">✕ Cancelar</button>`;
            } else if (r.status === 'seated') {
                if (isQuickOccupy) {
                    html += `<button class="btn-free-table btn-sm" onclick="quickFreeTable(${td.id}, ${tableNumber})">🔓 Liberar</button>`;
                    html += `<button class="btn-secondary btn-sm" onclick="showMoveTablePicker(${r.id}, ${tableNumber})">🔀</button>`;
                    html += `<button class="btn-danger btn-sm" onclick="cancelWalkIn(${r.id}, ${tableNumber})">✕</button>`;
                } else {
                    html += `<button class="btn-secondary btn-sm" onclick="completeFromPlan(${r.id})">✓ Completar</button>`;
                }
            }
            if (!isQuickOccupy || r.status !== 'seated') {
                html += `<button class="btn-danger btn-sm" onclick="deleteFromPlan(${r.id},'${r.client_name.replace(/'/g,"\\'")}')">🗑</button>`;
            }
            html += `</div></div>`;
        });

        // ── Button to add another sitting ──
        html += `
            <div style="margin-top:12px">
                <button class="btn-add-sitting" onclick="newReservationForTable(${td.number}, ${td.id})">
                    ➕ Añadir otro turno en esta mesa
                </button>
            </div>
        `;
    } else if (isBlocked) {
        // BLOCKED TABLE — no reservations allowed
        html += `
            <div style="background:#f3f4f6;border-radius:10px;padding:16px;text-align:center;color:#6b7280">
                <div style="font-size:24px;margin-bottom:6px">🔒</div>
                <div style="font-weight:600;color:#374151;margin-bottom:4px">Mesa congelada</div>
                <div style="font-size:12px">No acepta reservas ni ocupación directa.<br>Pulsa <strong>Descongelar</strong> para habilitarla.</div>
            </div>
        `;
    } else {
        // FREE TABLE — show quick occupy + create reservation options
        const cap = tdCap;  // already resolved from TABLE_DEFS fallback above
        const defaultGuests = Math.min(2, cap);
        const hardMax = Math.min(cap + 4, 14);
        html += `
            <div class="quick-occupy-panel" id="qoPanelInModal">
                <div class="qop-title">⚡ Ocupar ahora</div>
                <div class="qop-subtitle">Sin reserva — solo marcar mesa ocupada</div>
                <div class="qop-counter">
                    <button class="qo-cnt-btn" onclick="qopChange(-1, ${cap})">−</button>
                    <span class="qo-cnt-val" id="qopVal">${_qopGuests}</span>
                    <span class="qop-pax">personas</span>
                    <button class="qo-cnt-btn" onclick="qopChange(1, ${cap})">+</button>
                </div>
                <div id="qopOvercapNote" style="font-size:11px;color:#f97316;text-align:center;min-height:14px;margin-bottom:4px">
                    ${_qopGuests > cap ? `⚠️ Supera aforo (${cap}p) — silla extra` : ''}
                </div>
                <button class="qop-occupy-btn" onclick="quickOccupyFromModal(${td.id}, ${td.number})">
                    🟢 Ocupar mesa
                </button>
            </div>
            <div class="qop-divider"><span>o</span></div>
            <div style="padding: 0 0 4px;">
                <button class="btn-primary" style="width:100%" onclick="newReservationForTable(${td.number}, ${td.id})">
                    📋 Crear reserva completa
                </button>
            </div>
        `;
    }

    content.innerHTML = html;
    openModal('modalTableDetail');
}

// ── Quick Occupy (inline in modal) ──────────────

let _qopGuests = 2;

function qopChange(delta, maxCap) {
    // Allow up to 4 extra seats above table capacity (silla añadida), max 14
    const hardMax = Math.min(maxCap + 4, 14);
    _qopGuests = Math.max(1, Math.min(hardMax, (_qopGuests || 2) + delta));
    const el = document.getElementById('qopVal');
    if (el) {
        el.textContent = _qopGuests;
        el.style.color = _qopGuests > maxCap ? '#f97316' : '';
    }
    const note = document.getElementById('qopOvercapNote');
    if (note) note.textContent = _qopGuests > maxCap ? `⚠️ Supera aforo (${maxCap}p) — silla extra` : '';
}

async function quickOccupyFromModal(tableId, tableNumber) {
    const guests = _qopGuests || 2;
    closeModal('modalTableDetail');

    // Optimistic update
    if (tableDataMap[tableNumber]) {
        tableDataMap[tableNumber] = {
            ...tableDataMap[tableNumber],
            status: 'seated',
            reservation: {
                id: -1, client_name: 'Walk-in', guests,
                time: new Date().toTimeString().slice(0, 5),
                status: 'seated', source: 'walk_in', is_grouped: false,
                table_numbers: [tableNumber],
            }
        };
    }
    renderFloorPlan();

    try {
        await apiPost(`/api/tables/${tableId}/quick-occupy`, { guests, shift: currentShift });
        showToast(`Mesa ${tableNumber} ocupada · ${guests}p`, 'success');
        refreshAll();
    } catch (e) {
        showToast('Error al ocupar mesa', 'error');
        refreshAll();
    }
}

// ── Cancel Walk-in ─────────────────────────────

async function cancelWalkIn(resId, tableNumber) {
    closeModal('modalTableDetail');
    if (tableDataMap[tableNumber]) {
        tableDataMap[tableNumber] = { ...tableDataMap[tableNumber], status: 'free', reservation: null };
    }
    renderFloorPlan();
    try {
        await apiDelete(`/api/reservations/${resId}`);
        showToast('Reserva walk-in cancelada', 'success');
        await refreshAll();
    } catch (e) {
        showToast('Error al cancelar', 'error');
        await refreshAll();
    }
}

// ── Move Walk-in to Another Table ──────────────

function showMoveTablePicker(resId, currentTableNumber) {
    const content = document.getElementById('tableDetailContent');
    const title = document.getElementById('tableDetailTitle');
    title.textContent = '🔀 Cambiar mesa';

    const freeTables = Object.values(tableDataMap)
        .filter(t => t && t.id && t.status === 'free' && t.number !== currentTableNumber)
        .sort((a, b) => a.number - b.number);

    if (freeTables.length === 0) {
        content.innerHTML = `
            <div style="padding:20px;text-align:center;color:#6b7280">No hay mesas libres disponibles</div>
            <button class="btn-secondary" style="width:100%;margin-top:8px" onclick="openTableDetail(${currentTableNumber})">← Volver</button>
        `;
        return;
    }

    content.innerHTML = `
        <p style="color:#6b7280;font-size:12px;margin-bottom:12px">
            Selecciona la mesa destino. La reserva walk-in se moverá al instante.
        </p>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;max-height:280px;overflow-y:auto">
            ${freeTables.map(t => {
                const def = TABLE_DEFS.find(d => d.n === t.number);
                const cap = t.capacity || (def ? def.cap : '?');
                const zone = zoneName(t.zone || (def ? def.zone : ''));
                return `
                <button class="move-table-btn" onclick="moveWalkInToTable(${resId}, ${t.id}, ${t.number}, ${currentTableNumber})">
                    <div style="font-size:18px;font-weight:800;color:#1a8a7d">${t.number}</div>
                    <div style="font-size:11px;color:#6b7280">${cap}p · ${zone}</div>
                </button>`;
            }).join('')}
        </div>
        <button class="btn-secondary" style="width:100%;margin-top:12px" onclick="openTableDetail(${currentTableNumber})">← Volver</button>
    `;
}

async function moveWalkInToTable(resId, newTableId, newTableNumber, oldTableNumber) {
    closeModal('modalTableDetail');

    // Optimistic: free old, seat new
    const oldRes = tableDataMap[oldTableNumber]?.reservation;
    if (tableDataMap[oldTableNumber]) {
        tableDataMap[oldTableNumber] = { ...tableDataMap[oldTableNumber], status: 'free', reservation: null };
    }
    if (tableDataMap[newTableNumber] && oldRes) {
        tableDataMap[newTableNumber] = {
            ...tableDataMap[newTableNumber],
            status: 'seated',
            reservation: { ...oldRes, table_numbers: [newTableNumber] },
        };
    }
    renderFloorPlan();

    try {
        await apiPut(`/api/reservations/${resId}/assign-tables`, { table_id: newTableId });
        showToast(`Mesa movida → Mesa ${newTableNumber} ✓`, 'success');
        await refreshAll();
    } catch (e) {
        showToast('Error al mover mesa', 'error');
        await refreshAll();
    }
}

// ── Quick Free Table ────────────────────────────

async function quickFreeTable(tableId, tableNumber) {
    closeModal('modalTableDetail');

    // Optimistic: mark free immediately
    if (tableDataMap[tableNumber]) {
        tableDataMap[tableNumber] = { ...tableDataMap[tableNumber], status: 'free', reservation: null };
    }
    renderFloorPlan();

    try {
        await apiPut(`/api/tables/${tableId}/quick-free`, { shift: currentShift });
        showToast(`Mesa ${tableNumber} liberada`, 'success');
        await refreshAll();
    } catch (e) {
        showToast('Error al liberar mesa', 'error');
        await refreshAll();
    }
}

// ── Optimistic update: cambia la UI instantáneamente, la API confirma en segundo plano ──
function _applyOptimistic(resId, newStatus) {
    for (const key of Object.keys(tableDataMap)) {
        const td = tableDataMap[key];
        if (td && td.reservation && td.reservation.id === resId) {
            if (newStatus === 'free') {
                tableDataMap[key] = { ...td, status: 'free', reservation: null };
            } else {
                tableDataMap[key] = {
                    ...td,
                    status: newStatus,
                    reservation: { ...td.reservation, status: newStatus }
                };
            }
            break;
        }
    }
    renderFloorPlan();
}

async function seatFromPlan(resId) {
    _applyOptimistic(resId, 'seated');   // ← INSTANTE: mesa verde ya
    closeModal('modalTableDetail');
    showToast('Mesa sentada ✓', 'success');
    try {
        await apiPut(`/api/reservations/${resId}/seat`);
    } catch (e) {
        showToast('Error al sentar mesa', 'error');
    }
    loadFloorPlan(); // sincroniza desde servidor (sin debounce de 500ms)
}

async function cancelFromPlan(resId) {
    _applyOptimistic(resId, 'free');     // ← INSTANTE: mesa libre ya
    closeModal('modalTableDetail');
    showToast('Reserva cancelada', 'success');
    try {
        await apiDelete(`/api/reservations/${resId}`);
    } catch (e) {
        showToast('Error al cancelar', 'error');
    }
    loadFloorPlan();
}

async function completeFromPlan(resId) {
    _applyOptimistic(resId, 'free');     // ← INSTANTE: mesa libre ya
    closeModal('modalTableDetail');
    showToast('Mesa completada ✓', 'success');
    try {
        await apiPut(`/api/reservations/${resId}/complete`);
    } catch (e) {
        showToast('Error al completar', 'error');
    }
    loadFloorPlan();
}

async function deleteFromPlan(resId, name) {
    if (!confirm(`¿Eliminar definitivamente la reserva de ${name}?`)) return;
    _applyOptimistic(resId, 'free');     // ← INSTANTE: mesa libre ya
    closeModal('modalTableDetail');
    try {
        await apiDelete(`/api/reservations/${resId}/delete`);
        showToast('Reserva eliminada');
    } catch (e) {
        showToast('Error al eliminar', 'error');
    }
    loadFloorPlan();
}

function editReservationFromPlan(resId) {
    closeModal('modalTableDetail');
    openEditReservation(resId);
}

function newReservationForTable(tableNumber, tableId) {
    closeModal('modalTableDetail');
    openNewReservationModal([tableId]);
}

// ── Inline reservation editing ────────────────────

let _ieGuests = 1;

function ieGuestsChange(delta, hardMax) {
    _ieGuests = Math.max(1, Math.min(hardMax, _ieGuests + delta));
    const el = document.getElementById('ieGuestsVal');
    if (el) el.textContent = _ieGuests;
}

async function saveInlineReservation(resId, tableNumber) {
    return saveInlineReservationV2(resId, tableNumber);
}

async function saveInlineReservationV2(resId, tableNumber) {
    const name   = document.getElementById(`ieResName_${resId}`)?.value.trim();
    const phone  = document.getElementById(`ieResPhone_${resId}`)?.value.trim();
    const gEl    = document.getElementById(`ieGuestsVal_${resId}`);
    const guests = gEl ? (parseInt(gEl.dataset.v) || parseInt(gEl.textContent)) : null;
    const notes  = document.getElementById(`ieResNotes_${resId}`)?.value.trim();

    if (!name) { showToast('El nombre no puede estar vacío', 'error'); return; }

    const btn = document.querySelector(`[onclick="saveInlineReservationV2(${resId}, ${tableNumber})"]`);
    if (btn) { btn.disabled = true; btn.textContent = 'Guardando…'; }

    try {
        const payload = { client_name: name, client_phone: phone, notes };
        if (guests) payload.guests = guests;
        await apiPut(`/api/reservations/${resId}`, payload);
        showToast(`Mesa ${tableNumber} · turno actualizado ✓`, 'success');
        closeModal('modalTableDetail');
        loadFloorPlan();
    } catch (e) {
        showToast(e.message || 'Error al guardar', 'error');
        if (btn) { btn.disabled = false; btn.textContent = '💾 Guardar'; }
    }
}

async function toggleTableBlocked(tableId, tableNumber, currentlyBlocked) {
    const newBlocked = !currentlyBlocked;
    const label = newBlocked ? 'congelada 🔒' : 'descongelada 🔓';
    try {
        await apiPut(`/api/tables/${tableId}`, { blocked: newBlocked });
        showToast(`Mesa ${tableNumber} ${label}`, 'success');
        closeModal('modalTableDetail');
        loadFloorPlan();
    } catch (e) {
        showToast('Error al cambiar estado de la mesa', 'error');
    }
}
