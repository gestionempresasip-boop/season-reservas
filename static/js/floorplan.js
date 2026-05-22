/* ═══════════════════════════════════════════════
   SEASON - Interactive Floor Plan (SVG)
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

async function loadFloorPlan() {
    const data = await apiGet(`/api/tables/status?date=${currentDate}&shift=${currentShift}`);
    tableDataMap = {};
    data.forEach(t => { tableDataMap[t.number] = t; });
    renderFloorPlan();
}

function renderFloorPlan() {
    const svg = document.getElementById('floorplanSVG');
    svg.querySelectorAll('.table-group').forEach(g => g.remove());

    TABLE_DEFS.forEach(def => {
        const td = tableDataMap[def.n] || {};
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.classList.add('table-group');
        if (td.status && td.status !== 'free') {
            g.classList.add('status-' + td.status);
        }
        g.dataset.tableNumber = def.n;

        const cx = def.x + def.w / 2;
        const cy = def.y + def.h / 2;

        // Table body
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', def.x);
        rect.setAttribute('y', def.y);
        rect.setAttribute('width', def.w);
        rect.setAttribute('height', def.h);
        rect.setAttribute('rx', '1');
        rect.classList.add('table-rect');
        g.appendChild(rect);

        // Chairs
        drawChairs(g, def);

        // Table number
        const num = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        num.setAttribute('x', cx);
        num.setAttribute('y', cy - 0.5);
        num.classList.add('table-number');
        num.textContent = def.n;
        g.appendChild(num);

        // Capacity label
        const capLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        capLabel.setAttribute('x', cx);
        capLabel.setAttribute('y', cy + 2.3);
        capLabel.classList.add('table-capacity');
        capLabel.textContent = def.cap + 'p';
        g.appendChild(capLabel);

        // Alta label
        if (def.type === 'alta') {
            const altaLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            altaLabel.setAttribute('x', cx);
            altaLabel.setAttribute('y', def.y - 0.8);
            altaLabel.classList.add('table-type-label');
            altaLabel.textContent = 'alta';
            g.appendChild(altaLabel);
        }

        // Reservation info overlay
        if (td.reservation) {
            const r = td.reservation;
            const nameText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            nameText.setAttribute('x', cx);
            nameText.setAttribute('y', def.y + def.h + 2);
            nameText.classList.add('table-client-name');
            nameText.textContent = r.client_name.length > 12
                ? r.client_name.substring(0, 11) + '...'
                : r.client_name;
            g.appendChild(nameText);

            const timeText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            timeText.setAttribute('x', cx);
            timeText.setAttribute('y', def.y + def.h + 3.8);
            timeText.classList.add('table-time-label');
            timeText.textContent = r.time + ' · ' + r.guests + 'p';
            g.appendChild(timeText);
        }

        g.addEventListener('click', () => openTableDetail(def.n));
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
                <h4>Reserva Activa</h4>
                <div class="detail-row"><span class="label">Cliente</span><span class="value">${r.client_name}</span></div>
                <div class="detail-row"><span class="label">Hora</span><span class="value">${r.time}</span></div>
                <div class="detail-row"><span class="label">Comensales</span><span class="value">${r.guests}</span></div>
                <div class="detail-row"><span class="label">Origen</span>${sourceBadge(r.source)}</div>
                ${r.notes ? `<div class="detail-row"><span class="label">Notas</span><span class="value">${r.notes}</span></div>` : ''}
            </div>
            <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px;">
        `;
        if (r.status === 'confirmed') {
            html += `<button class="btn-primary btn-sm" onclick="seatFromPlan(${r.id})">Sentar</button>`;
            html += `<button class="btn-secondary btn-sm" onclick="editReservationFromPlan(${r.id})">Editar</button>`;
            html += `<button class="btn-danger btn-sm" onclick="cancelFromPlan(${r.id})">Cancelar</button>`;
        } else if (r.status === 'seated') {
            html += `<button class="btn-primary btn-sm" onclick="completeFromPlan(${r.id})">Completar</button>`;
        }
        html += `<button class="btn-danger btn-sm" onclick="deleteFromPlan(${r.id}, '${r.client_name.replace(/'/g, "\\'")}')">Eliminar</button>`;
        html += `</div>`;
    } else {
        html += `
            <div style="margin-top: 16px;">
                <button class="btn-primary" onclick="newReservationForTable(${td.number}, ${td.id})">Reservar esta mesa</button>
            </div>
        `;
    }

    content.innerHTML = html;
    openModal('modalTableDetail');
}

async function seatFromPlan(resId) {
    await apiPut(`/api/reservations/${resId}/seat`);
    closeModal('modalTableDetail');
    refreshAll();
    showToast('Mesa sentada', 'success');
}

async function cancelFromPlan(resId) {
    await apiDelete(`/api/reservations/${resId}`);
    closeModal('modalTableDetail');
    refreshAll();
    showToast('Reserva cancelada');
}

async function completeFromPlan(resId) {
    await apiPut(`/api/reservations/${resId}/complete`);
    closeModal('modalTableDetail');
    refreshAll();
    showToast('Mesa completada', 'success');
}

async function deleteFromPlan(resId, name) {
    if (!confirm(`¿Eliminar definitivamente la reserva de ${name}?`)) return;
    await apiDelete(`/api/reservations/${resId}/delete`);
    closeModal('modalTableDetail');
    refreshAll();
    showToast('Reserva eliminada', 'error');
}

function editReservationFromPlan(resId) {
    closeModal('modalTableDetail');
    openEditReservation(resId);
}

function newReservationForTable(tableNumber, tableId) {
    closeModal('modalTableDetail');
    openNewReservationModal();
    document.getElementById('resDate').value = currentDate;
    document.getElementById('resShift').value = currentShift;
    setTimeout(async () => {
        const select = document.getElementById('resTable');
        
        // Recargar opciones disponibles
        const d = currentDate;
        const s = currentShift;
        const g = parseInt(document.getElementById('resGuests').value) || 2;
        const tables = await apiGet(`/api/tables/available?date=${d}&shift=${s}&guests=${g}`);
        
        // Limpiar opciones
        select.innerHTML = '<option value="">Asignar después</option>';
        
        // Llenar con mesas disponibles
        tables.forEach(t => {
            if (t.capacity >= g) {
                const opt = document.createElement('option');
                opt.value = t.id;
                opt.textContent = `Mesa ${t.number} (${zoneName(t.zone)}) · ${t.capacity}p`;
                if (t.id == tableId) opt.selected = true;
                select.appendChild(opt);
            }
        });
        
        // Cambiar foco al campo de nombre
        document.getElementById('resName').focus();
    }, 200);
}
