/* ═══════════════════════════════════════════════
   SEASON - Reports & Analytics
   ═══════════════════════════════════════════════ */

function localISODate(d) {
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

function initReportDates() {
    const today = new Date();
    const thirtyAgo = new Date(today);
    thirtyAgo.setDate(thirtyAgo.getDate() - 30);

    document.getElementById('reportFrom').value = localISODate(thirtyAgo);
    document.getElementById('reportTo').value = localISODate(today);
    loadReports();
}

async function loadReports() {
    const from = document.getElementById('reportFrom').value;
    const to = document.getElementById('reportTo').value;
    const qs = `from=${from}&to=${to}`;

    await Promise.all([
        loadOccupancyReport(qs),
        loadSourcesReport(qs),
        loadNoShowsReport(qs),
        loadTopClientsReport(qs),
        loadPopularTablesReport(qs),
        loadZonesReport(qs),
        loadHoursReport(qs),
        loadSummaryReport(),
    ]);
}

async function loadOccupancyReport(qs) {
    const data = await apiGet(`/api/reports/occupancy?${qs}`);
    const el = document.querySelector('#reportOccupancy .report-content');
    if (!data.length) { el.innerHTML = '<p style="color:#9ca3af">Sin datos</p>'; return; }

    const maxOcc = Math.max(...data.map(d => d.occupancy), 1);
    el.innerHTML = data.slice(-14).map(d => `
        <div class="report-bar">
            <div class="report-bar-label">${formatDate(d.date).slice(0, 5)} ${d.shift === 'comida' ? '☀' : '🌙'}</div>
            <div class="report-bar-track">
                <div class="report-bar-fill" style="width: ${Math.max(d.occupancy / maxOcc * 100, 5)}%; background: ${d.shift === 'comida' ? '#f59e0b' : '#3b82f6'}">
                    <span class="report-bar-value">${d.occupancy}% · ${d.guests}p</span>
                </div>
            </div>
        </div>
    `).join('');
}

async function loadSourcesReport(qs) {
    const data = await apiGet(`/api/reports/sources?${qs}`);
    const el = document.querySelector('#reportSources .report-content');
    if (!data.length) { el.innerHTML = '<p style="color:#9ca3af">Sin datos</p>'; return; }

    const total = data.reduce((s, d) => s + d.count, 0);
    const colors = { phone: '#3b82f6', whatsapp: '#22c55e', walk_in: '#8b5cf6', web: '#1a8a7d' };
    const labels = { phone: 'Teléfono', whatsapp: 'WhatsApp', walk_in: 'Walk-in', web: 'Web' };

    el.innerHTML = data.map(d => {
        const pct = total > 0 ? Math.round(d.count / total * 100) : 0;
        return `
            <div class="report-bar">
                <div class="report-bar-label">${labels[d.source] || d.source}</div>
                <div class="report-bar-track">
                    <div class="report-bar-fill" style="width: ${Math.max(pct, 5)}%; background: ${colors[d.source] || '#6b7280'}">
                        <span class="report-bar-value">${d.count} (${pct}%)</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

async function loadNoShowsReport(qs) {
    const data = await apiGet(`/api/reports/no-shows?${qs}`);
    const el = document.querySelector('#reportNoShows .report-content');

    el.innerHTML = `
        <div class="report-big-number" style="color: ${data.rate > 10 ? '#ef4444' : '#22c55e'}">${data.rate}%</div>
        <div class="report-big-label">Tasa de No Show</div>
        <div style="text-align:center; margin-top:12px; font-size:13px; color:#6b7280;">
            ${data.no_shows} de ${data.total_reservations} reservas
        </div>
    `;
}

async function loadTopClientsReport(qs) {
    const data = await apiGet(`/api/reports/clients?${qs}&limit=10`);
    const el = document.querySelector('#reportTopClients .report-content');
    if (!data.length) { el.innerHTML = '<p style="color:#9ca3af">Sin datos</p>'; return; }

    el.innerHTML = `
        <table class="report-table">
            <thead><tr><th>Cliente</th><th>Visitas</th><th>Comensales</th></tr></thead>
            <tbody>
                ${data.map(c => `
                    <tr>
                        <td>${c.name} ${c.vip ? '<span class="badge badge-vip">VIP</span>' : ''}</td>
                        <td><strong>${c.visits}</strong></td>
                        <td>${c.total_guests}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

async function loadPopularTablesReport(qs) {
    const data = await apiGet(`/api/reports/popular-tables?${qs}`);
    const el = document.querySelector('#reportPopularTables .report-content');
    if (!data.length) { el.innerHTML = '<p style="color:#9ca3af">Sin datos</p>'; return; }

    const max = Math.max(...data.map(d => d.times_reserved), 1);
    el.innerHTML = data.slice(0, 10).map(d => `
        <div class="report-bar">
            <div class="report-bar-label">Mesa ${d.table_number}</div>
            <div class="report-bar-track">
                <div class="report-bar-fill" style="width: ${d.times_reserved / max * 100}%">
                    <span class="report-bar-value">${d.times_reserved}x · ${zoneName(d.zone)}</span>
                </div>
            </div>
        </div>
    `).join('');
}

async function loadZonesReport(qs) {
    const data = await apiGet(`/api/reports/zones?${qs}`);
    const el = document.querySelector('#reportZones .report-content');
    if (!data.length) { el.innerHTML = '<p style="color:#9ca3af">Sin datos</p>'; return; }

    const colors = { exterior: '#22c55e', salon_principal: '#1a8a7d', salon_interior: '#f59e0b' };
    el.innerHTML = data.map(d => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid #f3f4f6;">
            <div>
                <div style="font-weight:600; color:#374151;">${zoneName(d.zone)}</div>
                <div style="font-size:12px; color:#9ca3af;">Cap. ${d.zone_capacity}p</div>
            </div>
            <div style="text-align:right;">
                <div style="font-weight:700; color:${colors[d.zone] || '#1a8a7d'}">${d.reservations} reservas</div>
                <div style="font-size:12px; color:#6b7280;">${d.guests} comensales</div>
            </div>
        </div>
    `).join('');
}

async function loadHoursReport(qs) {
    const data = await apiGet(`/api/reports/hours?${qs}`);
    const el = document.querySelector('#reportHours .report-content');
    if (!data.length) { el.innerHTML = '<p style="color:#9ca3af">Sin datos</p>'; return; }

    const max = Math.max(...data.map(d => d.count), 1);
    el.innerHTML = data.map(d => `
        <div class="report-bar">
            <div class="report-bar-label">${d.hour} ${d.shift === 'comida' ? '☀' : '🌙'}</div>
            <div class="report-bar-track">
                <div class="report-bar-fill" style="width: ${d.count / max * 100}%; background: ${d.shift === 'comida' ? '#f59e0b' : '#3b82f6'}">
                    <span class="report-bar-value">${d.count} res. · ${d.guests}p</span>
                </div>
            </div>
        </div>
    `).join('');
}

async function loadSummaryReport() {
    const data = await apiGet(`/api/reports/summary?date=${currentDate}`);
    const el = document.querySelector('#reportSummary .report-content');

    let html = '';
    for (const shift of ['comida', 'cena']) {
        const s = data[shift];
        if (!s) continue;
        const icon = shift === 'comida' ? '☀' : '🌙';
        html += `
            <div style="margin-bottom:16px;">
                <div style="font-weight:700; color:#374151; margin-bottom:8px;">${icon} ${shift.charAt(0).toUpperCase() + shift.slice(1)}</div>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:6px;">
                    <div style="background:#f0fdf4; padding:8px; border-radius:6px; text-align:center;">
                        <div style="font-size:20px; font-weight:700; color:#16a34a;">${s.total}</div>
                        <div style="font-size:11px; color:#6b7280;">Reservas</div>
                    </div>
                    <div style="background:#eff6ff; padding:8px; border-radius:6px; text-align:center;">
                        <div style="font-size:20px; font-weight:700; color:#3b82f6;">${s.guests}</div>
                        <div style="font-size:11px; color:#6b7280;">Comensales</div>
                    </div>
                    <div style="background:#fef2f2; padding:8px; border-radius:6px; text-align:center;">
                        <div style="font-size:20px; font-weight:700; color:#ef4444;">${s.cancelled}</div>
                        <div style="font-size:11px; color:#6b7280;">Canceladas</div>
                    </div>
                    <div style="background:#f5f0e6; padding:8px; border-radius:6px; text-align:center;">
                        <div style="font-size:20px; font-weight:700; color:#92400e;">${s.no_show}</div>
                        <div style="font-size:11px; color:#6b7280;">No Shows</div>
                    </div>
                </div>
            </div>
        `;
    }
    el.innerHTML = html || '<p style="color:#9ca3af">Sin datos para hoy</p>';
}

// ── WhatsApp Test Chat ──────────────────────────

async function sendWaTest() {
    const input = document.getElementById('waTestInput');
    const msg = input.value.trim();
    if (!msg) return;

    const chat = document.getElementById('waChatMessages');
    chat.innerHTML += `<div class="wa-msg wa-user">${msg}</div>`;
    input.value = '';

    try {
        const res = await apiPost('/api/whatsapp/test', { phone: '+34600000000', message: msg });
        chat.innerHTML += `<div class="wa-msg wa-bot">${res.reply}</div>`;
    } catch (e) {
        chat.innerHTML += `<div class="wa-msg wa-bot" style="color:#ef4444">Error de conexión</div>`;
    }

    chat.scrollTop = chat.scrollHeight;
}

document.getElementById('waTestInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendWaTest();
});

function copyWaLink() {
    const link = document.getElementById('waLink').textContent;
    navigator.clipboard.writeText(link).then(() => {
        showToast('Enlace WhatsApp copiado', 'success');
    }).catch(() => {
        prompt('Copia este enlace:', link);
    });
}
