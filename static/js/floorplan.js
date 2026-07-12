/* ═══════════════════════════════════════════════
   SEASON - Interactive Floor Plan (SVG)
   - Modo agrupar mesas (click multi-select + reservar grupo)
   - Drag-drop: arrastrar reserva → mesa
   - Mesas agrupadas se muestran del mismo color con línea uniéndolas
   ═══════════════════════════════════════════════ */

let TABLE_DEFS = [
    // ZONA EXTERIOR — fila única: 70, 50, 52, 54, 56, 58, 60, 62
    { n: 70, cap: 2, type: 'alta',   zone: 'ext', x:  2, y: 11, shape: 'rect', w: 9, h: 7 },
    { n: 50, cap: 2, type: 'normal', zone: 'ext', x: 13, y: 12, shape: 'rect', w: 7, h: 5 },
    { n: 52, cap: 2, type: 'normal', zone: 'ext', x: 22, y: 12, shape: 'rect', w: 7, h: 5 },
    { n: 54, cap: 2, type: 'normal', zone: 'ext', x: 31, y: 12, shape: 'rect', w: 7, h: 5 },
    { n: 56, cap: 2, type: 'normal', zone: 'ext', x: 40, y: 12, shape: 'rect', w: 7, h: 5 },
    { n: 58, cap: 2, type: 'normal', zone: 'ext', x: 49, y: 12, shape: 'rect', w: 7, h: 5 },
    { n: 60, cap: 4, type: 'normal', zone: 'ext', x: 59, y: 11, shape: 'rect', w: 9, h: 7 },
    { n: 62, cap: 4, type: 'normal', zone: 'ext', x: 70, y: 11, shape: 'rect', w: 9, h: 7 },

    // SALON PRINCIPAL — círculos (filas 1-4): 1,2,3,4,6,7,8,12,14 · rectángulos (filas 5-6)
    { n: 1,  cap: 4, type: 'normal', zone: 'sp', x:  7, y: 36, shape: 'circle', w: 8, h: 8 },
    { n: 2,  cap: 2, type: 'normal', zone: 'sp', x: 20, y: 36, shape: 'circle', w: 7, h: 7 },
    { n: 3,  cap: 2, type: 'normal', zone: 'sp', x: 32, y: 36, shape: 'circle', w: 7, h: 7 },
    { n: 6,  cap: 4, type: 'normal', zone: 'sp', x:  7, y: 48, shape: 'circle', w: 8, h: 8 },
    { n: 4,  cap: 4, type: 'normal', zone: 'sp', x: 22, y: 48, shape: 'circle', w: 8, h: 8 },
    { n: 7,  cap: 4, type: 'normal', zone: 'sp', x:  5, y: 59, shape: 'circle', w: 8, h: 8 },
    { n: 8,  cap: 4, type: 'normal', zone: 'sp', x: 17, y: 59, shape: 'circle', w: 8, h: 8 },
    { n: 9,  cap: 2, type: 'normal', zone: 'sp', x: 29, y: 60, shape: 'rect',   w: 7, h: 6 },
    { n: 10, cap: 2, type: 'normal', zone: 'sp', x: 39, y: 60, shape: 'rect',   w: 7, h: 6 },
    { n: 14, cap: 4, type: 'normal', zone: 'sp', x:  5, y: 70, shape: 'circle', w: 8, h: 8 },
    { n: 12, cap: 4, type: 'normal', zone: 'sp', x: 19, y: 70, shape: 'circle', w: 8, h: 8 },
    { n: 11, cap: 2, type: 'normal', zone: 'sp', x: 33, y: 71, shape: 'rect',   w: 7, h: 6 },
    { n: 15, cap: 4, type: 'normal', zone: 'sp', x:  7, y: 81, shape: 'rect',   w: 8, h: 7 },
    { n: 16, cap: 4, type: 'normal', zone: 'sp', x: 20, y: 81, shape: 'rect',   w: 8, h: 7 },
    { n: 17, cap: 4, type: 'normal', zone: 'sp', x: 33, y: 81, shape: 'rect',   w: 8, h: 7 },
    { n: 22, cap: 4, type: 'normal', zone: 'sp', x:  5, y: 91, shape: 'rect',   w: 8, h: 7 },
    { n: 20, cap: 4, type: 'normal', zone: 'sp', x: 18, y: 91, shape: 'rect',   w: 8, h: 7 },
    { n: 19, cap: 2, type: 'normal', zone: 'sp', x: 31, y: 91, shape: 'rect',   w: 7, h: 6 },
    { n: 18, cap: 4, type: 'normal', zone: 'sp', x: 42, y: 91, shape: 'rect',   w: 8, h: 7 },

    // SALON INTERIOR
    { n: 30, cap: 4, type: 'normal', zone: 'si', x: 58, y: 37, shape: 'rect', w: 8, h: 7 },
    { n: 32, cap: 4, type: 'normal', zone: 'si', x: 72, y: 37, shape: 'rect', w: 8, h: 7 },
    { n: 34, cap: 4, type: 'normal', zone: 'si', x: 62, y: 50, shape: 'rect', w: 8, h: 7 },
    { n: 36, cap: 4, type: 'normal', zone: 'si', x: 65, y: 65, shape: 'rect', w: 8, h: 7 },
    { n: 40, cap: 8, type: 'alta', zone: 'si', x: 66, y: 82, shape: 'rect', w: 16, h: 7 },
];

// Apply saved positions/capacities from localStorage
// v5 = círculos para mesas 1,2,3,4,6,7,8,12,14 (Salón Principal)
const _TABLE_DEFS_VERSION = 'v5';
(function _applySavedTableDefs() {
    try {
        if (localStorage.getItem('season_table_defs_version') !== _TABLE_DEFS_VERSION) {
            localStorage.removeItem('season_table_defs');
            localStorage.setItem('season_table_defs_version', _TABLE_DEFS_VERSION);
        }
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
let groupSelectedTables = [];

// ── Pending unassigned panel (floor plan) ─────────

let _planPendingOpen = true;

function _fpShortDate(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    const today = new Date();
    const todayStr = today.getFullYear() + '-' + String(today.getMonth()+1).padStart(2,'0') + '-' + String(today.getDate()).padStart(2,'0');
    if (dateStr === todayStr) return 'HOY';
    const days   = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
    const months = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
    return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`;
}

async function loadFloorPlanPending() {
    try {
        const data = await apiGet('/api/reservations/unassigned');
        renderWebReservationsPanel(data || []);
    } catch(e) {
        console.warn('Error cargando pendientes plano:', e);
    }
}

function renderWebReservationsPanel(items) {
    const panel = document.getElementById('webReservationsPanel');
    if (!panel) return;

    if (!items || items.length === 0) {
        panel.style.display = 'none';
        return;
    }

    const plural = items.length === 1 ? '' : 's';
    panel.style.display = '';
    panel.innerHTML = `
        <div class="fp-pending-header" onclick="_toggleFpPending()">
            <span class="fp-pending-title">
                <span class="fp-pending-dot"></span>
                Sin mesa asignada &mdash; <strong>${items.length}</strong> reserva${plural}
            </span>
            <span class="fp-pending-toggle" id="fpPendingToggle">▲</span>
        </div>
        <div class="fp-pending-list" id="fpPendingList">
            ${items.map(r => {
                const turno = r.shift === 'comida' ? '☀️ Comida' : '🌙 Cena';
                const safeName = (r.client_name || '').replace(/'/g, "\\'");
                const notes = r.notes ? ` · ${r.notes}` : '';
                return `
                <div class="fp-pending-card" id="fp-pending-card-${r.id}">
                    <div class="fp-pending-date">${_fpShortDate(r.date)}</div>
                    <div class="fp-pending-info">
                        <div class="fp-pending-name">${r.client_name}</div>
                        <div class="fp-pending-meta">${turno} · ${r.time} · ${r.guests}p${notes}</div>
                    </div>
                    <button class="fp-assign-btn" onclick="openEditReservation(${r.id})">Asignar mesa</button>
                    <button class="fp-cancel-btn" onclick="fpCancelPending(${r.id}, '${safeName}')" title="Cancelar">✕</button>
                </div>`;
            }).join('')}
        </div>`;

    // Restore collapse state
    if (!_planPendingOpen) {
        const list = document.getElementById('fpPendingList');
        const tog  = document.getElementById('fpPendingToggle');
        if (list) list.style.display = 'none';
        if (tog)  tog.classList.add('collapsed');
    }
}

function _toggleFpPending() {
    _planPendingOpen = !_planPendingOpen;
    const list = document.getElementById('fpPendingList');
    const tog  = document.getElementById('fpPendingToggle');
    if (list) list.style.display = _planPendingOpen ? '' : 'none';
    if (tog)  tog.classList.toggle('collapsed', !_planPendingOpen);
}

async function fpCancelPending(id, name) {
    if (!confirm(`¿Cancelar la reserva de ${name}?`)) return;
    const card = document.getElementById(`fp-pending-card-${id}`);
    if (card) { card.style.opacity = '0.4'; card.style.pointerEvents = 'none'; }
    try {
        await apiPut(`/api/reservations/${id}`, { status: 'cancelled' });
        if (card) card.remove();
        showToast('Reserva cancelada');
        // Reload panel to update count
        loadFloorPlanPending();
        debouncedRefresh();
    } catch(e) {
        showToast('Error al cancelar', 'error');
        if (card) { card.style.opacity = ''; card.style.pointerEvents = ''; }
    }
}

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

async function saveEditPlan() {
    // Save to localStorage (fast cache)
    const patches = {};
    TABLE_DEFS.forEach(def => {
        patches[def.n] = { x: def.x, y: def.y, w: def.w, h: def.h, cap: def.cap, type: def.type };
    });
    localStorage.setItem('season_table_defs', JSON.stringify(patches));
    showToast('Guardando plano…', 'success');

    // Persist positions and capacity to DB in parallel
    const saves = TABLE_DEFS
        .filter(def => tableDataMap[def.n]?.id)
        .map(def => {
            const id = tableDataMap[def.n].id;
            return apiPut(`/api/tables/${id}`, {
                pos_x: def.x, pos_y: def.y,
                capacity: def.cap, table_type: def.type,
            }).catch(() => {});
        });
    await Promise.all(saves);
    showToast('Plano guardado ✓', 'success');
}

function resetEditPlan() {
    showConfirmPopup('¿Restaurar el plano original? Se perderán todos los cambios guardados.', () => {
        localStorage.removeItem('season_table_defs');
        localStorage.removeItem('season_user_tables');
        location.reload();
    }, '🔄');
}

// ── Add / Delete tables ──────────────────────────

function showAddTableModal() {
    const usedNums = new Set(TABLE_DEFS.map(d => d.n));
    let suggest = 1;
    while (usedNums.has(suggest)) suggest++;

    let _newCap = 4;

    const title = document.getElementById('tableDetailTitle');
    const content = document.getElementById('tableDetailContent');
    title.textContent = '➕ Nueva Mesa';
    content.innerHTML = `
        <div style="margin-bottom:16px">
            <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:6px">Número de mesa</label>
            <input type="number" id="newTableNum" value="${suggest}" min="1" max="999"
                style="width:100%;padding:10px 12px;border:2px solid #1a8a7d;border-radius:10px;font-size:20px;font-weight:800;color:#1a8a7d;text-align:center">
        </div>

        <div style="margin-bottom:16px">
            <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:8px">Comensales (aforo)</label>
            <div style="display:flex;align-items:center;gap:12px">
                <button class="qo-cnt-btn" style="width:40px;height:40px;font-size:20px"
                    onclick="_newTableCapChange(-1)">−</button>
                <input type="number" id="newTableCap" value="4" min="1" max="20"
                    style="width:70px;text-align:center;font-size:24px;font-weight:800;border:2px solid #1a8a7d;border-radius:10px;padding:6px;color:#1a8a7d"
                    oninput="_newTableCapVal=Math.max(1,Math.min(20,+this.value||1))">
                <button class="qo-cnt-btn" style="width:40px;height:40px;font-size:20px"
                    onclick="_newTableCapChange(1)">+</button>
                <span style="font-size:13px;color:#6b7280">personas</span>
            </div>
        </div>

        <div style="margin-bottom:16px">
            <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:8px">Zona</label>
            <select id="newTableZone" style="width:100%;padding:10px 12px;border:2px solid #e5e7eb;border-radius:10px;font-size:14px;background:#fff">
                <option value="sp">Salón Principal</option>
                <option value="si">Salón Interior</option>
                <option value="ext">Zona Exterior</option>
            </select>
        </div>

        <div style="margin-bottom:20px">
            <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:8px">Tipo de mesa</label>
            <div style="display:flex;gap:8px">
                <label id="newTypeLblNormal" style="flex:1;display:flex;align-items:center;gap:8px;padding:10px 12px;border:2px solid #1a8a7d;border-radius:10px;cursor:pointer;background:#f0fdf9">
                    <input type="radio" name="newTableType" value="normal" checked
                        onchange="_newTypeChanged(this)"> 🪑 Normal
                </label>
                <label id="newTypeLblAlta" style="flex:1;display:flex;align-items:center;gap:8px;padding:10px 12px;border:2px solid #e5e7eb;border-radius:10px;cursor:pointer;background:#fff">
                    <input type="radio" name="newTableType" value="alta"
                        onchange="_newTypeChanged(this)"> 🍽️ Alta
                </label>
            </div>
        </div>

        <p style="font-size:11px;color:#9ca3af;margin-bottom:12px">
            La mesa aparecerá en el centro del plano. Arrástrala a su posición y guarda el plano.
        </p>

        <div style="display:flex;gap:8px">
            <button class="btn-primary" style="flex:1;padding:13px" onclick="confirmCreateTable()">
                ➕ Crear Mesa
            </button>
            <button class="btn-secondary" style="flex:1" onclick="closeModal('modalTableDetail')">Cancelar</button>
        </div>
    `;
    window._newTableCapVal = 4;
    openModal('modalTableDetail');
}

window._newTableCapVal = 4;
function _newTableCapChange(delta) {
    window._newTableCapVal = Math.max(1, Math.min(20, (window._newTableCapVal || 4) + delta));
    const inp = document.getElementById('newTableCap');
    if (inp) inp.value = window._newTableCapVal;
}
function _newTypeChanged(radio) {
    document.querySelectorAll('[name=newTableType]').forEach(r => {
        r.parentElement.style.borderColor = r.checked ? '#1a8a7d' : '#e5e7eb';
        r.parentElement.style.background = r.checked ? '#f0fdf9' : '#fff';
    });
}

async function confirmCreateTable() {
    const numEl = document.getElementById('newTableNum');
    const capEl = document.getElementById('newTableCap');
    const zoneEl = document.getElementById('newTableZone');
    const typeRadio = document.querySelector('input[name="newTableType"]:checked');

    const number = parseInt(numEl?.value);
    const capacity = parseInt(capEl?.value) || window._newTableCapVal || 4;
    const zone = zoneEl?.value || 'sp';
    const table_type = typeRadio?.value || 'normal';

    if (!number || number < 1) { showToast('Número de mesa inválido', 'error'); return; }
    if (TABLE_DEFS.find(d => d.n === number)) {
        showToast(`La mesa ${number} ya existe en el plano`, 'error'); return;
    }

    // Default position: center of SVG viewport
    const pos_x = 45, pos_y = 48;
    const sz = _tableSizeFromCap(capacity);

    closeModal('modalTableDetail');

    try {
        const created = await apiPost('/api/tables', { number, capacity, zone, table_type, pos_x, pos_y });

        // Add to TABLE_DEFS so it renders immediately
        TABLE_DEFS.push({ n: number, cap: capacity, type: table_type, zone, x: pos_x, y: pos_y, shape: 'rect', w: sz.w, h: sz.h });

        // Track user-created tables in localStorage (for cleanup on delete)
        const userTables = JSON.parse(localStorage.getItem('season_user_tables') || '[]');
        if (!userTables.includes(number)) userTables.push(number);
        localStorage.setItem('season_user_tables', JSON.stringify(userTables));

        showToast(`Mesa ${number} creada ✓ — arrástrala a su posición`, 'success');
        await loadFloorPlan();
    } catch (e) {
        showToast(e.message || 'Error al crear la mesa', 'error');
    }
}

function confirmDeleteTable(tableNumber) {
    const td = tableDataMap[tableNumber];
    if (!td?.id) { showToast('Mesa no encontrada en BD', 'error'); return; }

    showConfirmPopup(`¿Eliminar la mesa ${tableNumber} del plano?\n\nSi tiene reservas futuras no se podrá eliminar.`, async () => {
        try {
            await apiDelete(`/api/tables/${td.id}`);

            // Remove from TABLE_DEFS
            const idx = TABLE_DEFS.findIndex(d => d.n === tableNumber);
            if (idx >= 0) TABLE_DEFS.splice(idx, 1);

            // Remove from user-created list
            const userTables = JSON.parse(localStorage.getItem('season_user_tables') || '[]');
            const filtered = userTables.filter(n => n !== tableNumber);
            localStorage.setItem('season_user_tables', JSON.stringify(filtered));

            // Update localStorage patches
            const patches = JSON.parse(localStorage.getItem('season_table_defs') || '{}');
            delete patches[tableNumber];
            localStorage.setItem('season_table_defs', JSON.stringify(patches));

            showToast(`Mesa ${tableNumber} eliminada ✓`, 'success');
            await loadFloorPlan();
        } catch (e) {
            showToast(e.message || 'Error al eliminar la mesa', 'error');
        }
    }, '🗑️');
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

function _tableSizeFromCap(cap) {
    if (cap <= 2) return { w: 7, h: 5 };
    if (cap <= 4) return { w: 8, h: 7 };
    if (cap <= 6) return { w: 10, h: 7 };
    return { w: 16, h: 7 };
}

async function loadFloorPlan() {
    const data = await apiGet(`/api/tables/status?date=${currentDate}&shift=${currentShift}`);
    tableDataMap = {};
    const dbNumbers = new Set();
    let unassigned = null;
    data.forEach(t => {
        if (t._unassigned) { unassigned = t; return; }
        dbNumbers.add(t.number);
        tableDataMap[t.number] = t;
        const def = TABLE_DEFS.find(d => d.n === t.number);
        if (def) {
            // Sync positions & capacity from DB (non-zero values override hardcoded defaults)
            if (t.pos_x) def.x = t.pos_x;
            if (t.pos_y) def.y = t.pos_y;
            if (t.capacity) def.cap = t.capacity;
            if (t.table_type) def.type = t.table_type;
            if (t.zone) def.zone = t.zone;
        } else {
            // Table exists in DB but not in TABLE_DEFS (created via UI) → add it
            const sz = _tableSizeFromCap(t.capacity || 4);
            TABLE_DEFS.push({
                n: t.number, cap: t.capacity || 4,
                type: t.table_type || 'normal', zone: t.zone || 'sp',
                x: t.pos_x || 50, y: t.pos_y || 50,
                shape: 'rect', w: sz.w, h: sz.h,
            });
        }
    });
    // Remove from TABLE_DEFS user-created tables that are no longer in DB (deleted)
    const userCreated = JSON.parse(localStorage.getItem('season_user_tables') || '[]');
    for (let i = TABLE_DEFS.length - 1; i >= 0; i--) {
        if (userCreated.includes(TABLE_DEFS[i].n) && !dbNumbers.has(TABLE_DEFS[i].n)) {
            TABLE_DEFS.splice(i, 1);
        }
    }
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
    if (!_reservationGuard()) return;
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
    if (!_walkInGuard()) { closeQuickOccupy(); return; }
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

    // Pending panel is loaded independently via loadFloorPlanPending()

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

        let tableShape;
        if (def.shape === 'circle') {
            g.classList.add('shape-circle');
            tableShape = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            tableShape.setAttribute('cx', cx);
            tableShape.setAttribute('cy', cy);
            tableShape.setAttribute('r', Math.min(def.w, def.h) / 2);
            tableShape.classList.add('table-circle');
        } else {
            tableShape = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            tableShape.setAttribute('x', def.x);
            tableShape.setAttribute('y', def.y);
            tableShape.setAttribute('width', def.w);
            tableShape.setAttribute('height', def.h);
            tableShape.setAttribute('rx', '1');
            tableShape.classList.add(def.type === 'alta' ? 'table-alta' : 'table-rect');
        }
        if (def.type === 'alta') g.classList.add('shape-alta');
        if (groupInfo) {
            tableShape.setAttribute('stroke', groupInfo.color);
            tableShape.setAttribute('stroke-width', '0.5');
        }
        g.appendChild(tableShape);

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

            // Delete button (red X) in top-right corner of each table
            const delCx = def.x + def.w - 1.6;
            const delCy = def.y + 1.6;
            const delCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            delCircle.setAttribute('cx', delCx);
            delCircle.setAttribute('cy', delCy);
            delCircle.setAttribute('r', '2');
            delCircle.setAttribute('fill', '#ef4444');
            delCircle.setAttribute('stroke', 'white');
            delCircle.setAttribute('stroke-width', '0.4');
            delCircle.style.cursor = 'pointer';
            const delTxt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            delTxt.setAttribute('x', delCx);
            delTxt.setAttribute('y', delCy + 0.85);
            delTxt.setAttribute('text-anchor', 'middle');
            delTxt.setAttribute('font-size', '2.8');
            delTxt.setAttribute('fill', 'white');
            delTxt.setAttribute('font-weight', 'bold');
            delTxt.style.cursor = 'pointer';
            delTxt.style.pointerEvents = 'none';
            delTxt.textContent = '×';
            const stopAndDelete = (e) => { e.stopPropagation(); e.preventDefault(); confirmDeleteTable(def.n); };
            delCircle.addEventListener('click', stopAndDelete);
            delCircle.addEventListener('mousedown', e => e.stopPropagation());
            delCircle.addEventListener('touchend', stopAndDelete, { passive: false });
            g.appendChild(delCircle);
            g.appendChild(delTxt);
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
    const { x, y, w, h, cap, shape } = def;

    if (shape === 'circle') {
        const r = Math.min(w, h) / 2;
        const cxc = x + w / 2;
        const cyc = y + h / 2;
        const outerR = r + 1.5;
        let angles;
        if      (cap <= 2) angles = [0, 180];
        else if (cap === 4) angles = [45, 135, 225, 315];
        else if (cap === 6) angles = [0, 60, 120, 180, 240, 300];
        else                angles = [0, 45, 90, 135, 180, 225, 270, 315];
        return angles.map(deg => {
            const rad = (deg - 90) * Math.PI / 180;
            return [cxc + outerR * Math.cos(rad), cyc + outerR * Math.sin(rad)];
        });
    }

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
                html += `<button class="btn-secondary btn-sm" onclick="showMoveTablePicker(${r.id}, ${tableNumber})">🔀 Mesa</button>`;
                html += `<button class="btn-danger btn-sm" onclick="cancelFromPlan(${r.id})">✕ Cancelar</button>`;
            } else if (r.status === 'seated') {
                if (isQuickOccupy) {
                    html += `<button class="btn-free-table btn-sm" onclick="quickFreeTable(${td.id}, ${tableNumber})">🔓 Liberar</button>`;
                    html += `<button class="btn-secondary btn-sm" onclick="showMoveTablePicker(${r.id}, ${tableNumber})">🔀 Mesa</button>`;
                    html += `<button class="btn-danger btn-sm" onclick="cancelWalkIn(${r.id}, ${tableNumber})">✕</button>`;
                } else {
                    html += `<button class="btn-secondary btn-sm" onclick="completeFromPlan(${r.id})">✓ Completar</button>`;
                    html += `<button class="btn-secondary btn-sm" onclick="showMoveTablePicker(${r.id}, ${tableNumber})">🔀 Mesa</button>`;
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
    if (!_walkInGuard()) return;
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

    // Find the reservation being moved to know the guests count
    const td = tableDataMap[currentTableNumber];
    const allRes = td?.reservations || (td?.reservation ? [td.reservation] : []);
    const movingRes = allRes.find(r => r.id === resId) || td?.reservation;
    const guests = movingRes?.guests || 1;

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
            Selecciona la mesa destino (${guests} comensales). La reserva se moverá al instante.
        </p>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;max-height:280px;overflow-y:auto">
            ${freeTables.map(t => {
                const def = TABLE_DEFS.find(d => d.n === t.number);
                const cap = t.capacity || (def ? def.cap : 0);
                const zone = zoneName(t.zone || (def ? def.zone : ''));
                const tooSmall = cap > 0 && cap < guests;
                return tooSmall
                    ? `<button class="move-table-btn" disabled style="opacity:0.4;cursor:not-allowed" title="Aforo insuficiente (${cap}p)">
                        <div style="font-size:18px;font-weight:800;color:#9ca3af">${t.number}</div>
                        <div style="font-size:11px;color:#9ca3af">${cap}p · ${zone}</div>
                       </button>`
                    : `<button class="move-table-btn" onclick="moveReservationToTable(${resId}, ${t.id}, ${t.number}, ${currentTableNumber})">
                        <div style="font-size:18px;font-weight:800;color:#1a8a7d">${t.number}</div>
                        <div style="font-size:11px;color:#6b7280">${cap}p · ${zone}</div>
                       </button>`;
            }).join('')}
        </div>
        <button class="btn-secondary" style="width:100%;margin-top:12px" onclick="openTableDetail(${currentTableNumber})">← Volver</button>
    `;
}

async function moveReservationToTable(resId, newTableId, newTableNumber, oldTableNumber) {
    closeModal('modalTableDetail');

    // Find the correct reservation from the reservations array (not just primary)
    const td = tableDataMap[oldTableNumber];
    const allRes = td?.reservations || (td?.reservation ? [td.reservation] : []);
    const oldRes = allRes.find(r => r.id === resId) || td?.reservation;
    const originalStatus = oldRes?.status || 'confirmed';

    // Optimistic UI: free old table, mark new table occupied
    if (tableDataMap[oldTableNumber]) {
        const remaining = (tableDataMap[oldTableNumber].reservations || []).filter(r => r.id !== resId);
        tableDataMap[oldTableNumber] = {
            ...tableDataMap[oldTableNumber],
            status: remaining.length > 0 ? tableDataMap[oldTableNumber].status : 'free',
            reservation: remaining[0] || null,
            reservations: remaining,
        };
    }
    if (tableDataMap[newTableNumber] && oldRes) {
        tableDataMap[newTableNumber] = {
            ...tableDataMap[newTableNumber],
            status: originalStatus,
            reservation: { ...oldRes, table_numbers: [newTableNumber] },
            reservations: [{ ...oldRes, table_numbers: [newTableNumber] }],
        };
    }
    renderFloorPlan();

    try {
        await apiPut(`/api/reservations/${resId}/assign-tables`, { table_id: newTableId });
        showToast(`Mesa movida → Mesa ${newTableNumber} ✓`, 'success');
        await refreshAll();
    } catch (e) {
        showToast(e.message || 'Error al mover mesa', 'error');
        await refreshAll();
    }
}

// Keep old name as alias for backward compatibility with any remaining calls
async function moveWalkInToTable(resId, newTableId, newTableNumber, oldTableNumber) {
    return moveReservationToTable(resId, newTableId, newTableNumber, oldTableNumber);
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
    _applyOptimistic(resId, 'seated');
    closeModal('modalTableDetail');
    showToast('Mesa sentada ✓', 'success');
    try {
        await apiPut(`/api/reservations/${resId}/seat`);
    } catch (e) {
        showToast('Error al sentar mesa', 'error');
    }
    debouncedRefresh();
}

async function cancelFromPlan(resId) {
    _applyOptimistic(resId, 'free');
    closeModal('modalTableDetail');
    showToast('Reserva cancelada', 'success');
    try {
        await apiDelete(`/api/reservations/${resId}`);
    } catch (e) {
        showToast('Error al cancelar', 'error');
    }
    debouncedRefresh();
}

async function completeFromPlan(resId) {
    _applyOptimistic(resId, 'free');
    closeModal('modalTableDetail');
    showToast('Mesa completada ✓', 'success');
    try {
        await apiPut(`/api/reservations/${resId}/complete`);
    } catch (e) {
        showToast('Error al completar', 'error');
    }
    debouncedRefresh();
}

function deleteFromPlan(resId, name) {
    showConfirmPopup(`¿Eliminar definitivamente la reserva de ${name}?`, async () => {
        _applyOptimistic(resId, 'free');
        if (typeof optimisticRemove === 'function') optimisticRemove(resId);
        closeModal('modalTableDetail');
        showToast('Reserva eliminada');
        try {
            await apiDelete(`/api/reservations/${resId}/delete`);
        } catch (e) {
            showToast('Error al eliminar', 'error');
        }
        debouncedRefresh();
    }, '🗑️');
}

function editReservationFromPlan(resId) {
    closeModal('modalTableDetail');
    openEditReservation(resId);
}

function newReservationForTable(tableNumber, tableId) {
    closeModal('modalTableDetail');
    if (_reservationGuard()) openNewReservationModal([tableId]);
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
