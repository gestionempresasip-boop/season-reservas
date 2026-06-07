/* ═══════════════════════════════════════════════
   SEASON - Interactive Floor Plan (SVG)
   - Modo agrupar mesas (click multi-select + reservar grupo)
   - Drag-drop: arrastrar reserva → mesa
   - Mesas agrupadas se muestran del mismo color con línea uniéndolas
   ═══════════════════════════════════════════════ */

const TABLE_DEFS = [
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

let tableDataMap = {};
let groupMode = false;
let groupSelectedTables = []; // table numbers

// Color palette for group reservations (assigned by index)
const GROUP_COLORS = ['#a78bfa', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#ec4899', '#8b5cf6'];

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
    const cap = td.capacity || 4;
    const pop = document.getElementById('quickOccupyPopover');
    if (!pop) return;
    pop.innerHTML = `
        <div class="qo-header">
            <span class="qo-title">Mesa ${td.number}</span>
            <span class="qo-zone">${zoneName(td.zone)} · ${cap}p max</span>
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

function renderFloorPlan() {
    const svg = document.getElementById('floorplanSVG');
    svg.querySelectorAll('.table-group, .group-link-line, .unassigned-reservations-box').forEach(g => g.remove());

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

        g.addEventListener('click', () => handleTableClick(def.n));

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

    const title = document.getElementById('tableDetailTitle');
    const content = document.getElementById('tableDetailContent');
    title.textContent = `Mesa ${td.number} · ${zoneName(td.zone)}`;
    _qopGuests = Math.min(2, td.capacity || 4); // reset counter on each open

    let html = `
        <div class="detail-section">
            <div class="detail-row"><span class="label">Capacidad</span><span class="value">${td.capacity} personas</span></div>
            <div class="detail-row"><span class="label">Tipo</span><span class="value">${td.table_type === 'alta' ? 'Mesa Alta' : 'Normal'}</span></div>
            <div class="detail-row"><span class="label">Estado</span>${td.status === 'free' ? '<span class="badge badge-green">Libre</span>' : statusBadge(td.status)}</div>
        </div>
    `;

    if (td.reservation) {
        const r = td.reservation;
        html += `
            <div class="detail-section">
                <h4>Reserva Activa ${r.is_grouped ? '<span class="badge badge-group">GRUPO ' + r.table_numbers.join('+') + '</span>' : ''}</h4>
                <div class="detail-row"><span class="label">Cliente</span><span class="value">${r.client_name}</span></div>
                <div class="detail-row"><span class="label">Teléfono</span><span class="value">${r.client_phone || '—'}</span></div>
                <div class="detail-row"><span class="label">Hora</span><span class="value">${r.time}</span></div>
                <div class="detail-row"><span class="label">Comensales</span><span class="value">${r.guests}</span></div>
                <div class="detail-row"><span class="label">Duración</span><span class="value">${r.duration_minutes || 120} min</span></div>
                <div class="detail-row"><span class="label">Origen</span>${sourceBadge(r.source)}</div>
                ${r.notes ? `<div class="detail-row"><span class="label">Notas</span><span class="value">${r.notes}</span></div>` : ''}
            </div>
            <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px;">
        `;
        const isQuickOccupy = r.source === 'walk_in' && r.client_name === 'Walk-in';

        if (r.status === 'confirmed') {
            html += `<button class="btn-primary btn-sm" onclick="seatFromPlan(${r.id})">Sentar</button>`;
            html += `<button class="btn-secondary btn-sm" onclick="editReservationFromPlan(${r.id})">Editar</button>`;
            html += `<button class="btn-danger btn-sm" onclick="cancelFromPlan(${r.id})">Cancelar</button>`;
        } else if (r.status === 'seated') {
            if (isQuickOccupy) {
                // Quick-occupy: show big "Liberar mesa" button
                html += `<button class="btn-free-table" onclick="quickFreeTable(${td.id}, ${tableNumber})">
                    🔓 Liberar mesa
                </button>`;
            } else {
                html += `<button class="btn-primary btn-sm" onclick="completeFromPlan(${r.id})">Completar</button>`;
                html += `<button class="btn-secondary btn-sm" onclick="editReservationFromPlan(${r.id})">Editar</button>`;
            }
        }
        if (!isQuickOccupy || r.status !== 'seated') {
            html += `<button class="btn-danger btn-sm" onclick="deleteFromPlan(${r.id}, '${r.client_name.replace(/'/g, "\\'")}')">Eliminar</button>`;
        }
        html += `</div>`;
    } else {
        // FREE TABLE — show quick occupy + create reservation options
        const cap = td.capacity || 4;
        const defaultGuests = Math.min(2, cap);
        html += `
            <div class="quick-occupy-panel" id="qoPanelInModal">
                <div class="qop-title">⚡ Ocupar ahora</div>
                <div class="qop-subtitle">Sin reserva — solo marcar mesa ocupada</div>
                <div class="qop-counter">
                    <button class="qo-cnt-btn" onclick="qopChange(-1, ${cap})">−</button>
                    <span class="qo-cnt-val" id="qopVal">2</span>
                    <span class="qop-pax">personas</span>
                    <button class="qo-cnt-btn" onclick="qopChange(1, ${cap})">+</button>
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
    _qopGuests = Math.max(1, Math.min(maxCap, (_qopGuests || 2) + delta));
    const el = document.getElementById('qopVal');
    if (el) el.textContent = _qopGuests;
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
