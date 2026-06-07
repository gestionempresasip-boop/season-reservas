/* ═══════════════════════════════════════════════
   SEASON - Reports & Analytics v2
   KPIs con comparativa, heatmap, tendencia, presets
   ═══════════════════════════════════════════════ */

let _reportPreset = 30; // active preset in days

function localISODate(d) {
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

function initReportDates() {
    const today = new Date();
    const thirtyAgo = new Date(today);
    thirtyAgo.setDate(thirtyAgo.getDate() - 30);
    const fromEl = document.getElementById('reportFrom');
    const toEl = document.getElementById('reportTo');
    if (fromEl) fromEl.value = localISODate(thirtyAgo);
    if (toEl) toEl.value = localISODate(today);
    setReportPreset(30);
}

function setReportPreset(preset) {
    _reportPreset = preset;
    // Update active button
    document.querySelectorAll('.preset-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.preset == preset);
    });

    const customRange = document.getElementById('reportCustomRange');
    if (preset === 'custom') {
        if (customRange) customRange.style.display = 'flex';
        return; // wait for user to click Apply
    }
    if (customRange) customRange.style.display = 'none';

    const today = new Date();
    const from = new Date(today);
    from.setDate(from.getDate() - Number(preset) + 1);

    const fromEl = document.getElementById('reportFrom');
    const toEl = document.getElementById('reportTo');
    if (fromEl) fromEl.value = localISODate(from);
    if (toEl) toEl.value = localISODate(today);

    loadReports();
}

async function loadReports() {
    const from = document.getElementById('reportFrom')?.value;
    const to = document.getElementById('reportTo')?.value;
    if (!from || !to) return;
    const qs = `from=${from}&to=${to}`;

    // Load all in parallel — errors per card, never global
    await Promise.all([
        loadKPI(qs).catch(e => console.warn('KPI:', e?.message)),
        loadTrendReport(qs).catch(e => console.warn('Trend:', e?.message)),
        loadHeatmapReport(qs).catch(e => console.warn('Heatmap:', e?.message)),
        loadSourcesReport(qs).catch(e => console.warn('Sources:', e?.message)),
        loadZonesReport(qs).catch(e => console.warn('Zones:', e?.message)),
        loadHoursReport(qs).catch(e => console.warn('Hours:', e?.message)),
        loadNoShowsReport(qs).catch(e => console.warn('NoShows:', e?.message)),
        loadTopClientsReport(qs).catch(e => console.warn('Clients:', e?.message)),
        loadPopularTablesReport(qs).catch(e => console.warn('Tables:', e?.message)),
        loadSummaryReport().catch(e => console.warn('Summary:', e?.message)),
    ]);
}

// ── KPI Strip ────────────────────────────────────

async function loadKPI(qs) {
    const data = await apiGet(`/api/reports/kpi?${qs}`);
    const curr = data.current;
    const changes = data.changes;

    function renderKPI(id, value, change, suffix='', invert=false) {
        const card = document.getElementById(id);
        if (!card) return;
        const valEl = card.querySelector('.kpi-value');
        const chEl = card.querySelector('.kpi-change');
        if (valEl) valEl.textContent = value + suffix;

        if (chEl && change !== null && change !== undefined) {
            const up = change > 0;
            const good = invert ? !up : up; // invert=true means lower is better (no-show)
            const arrow = up ? '▲' : '▼';
            const color = good ? '#16a34a' : '#ef4444';
            chEl.innerHTML = `<span style="color:${color}">${arrow} ${Math.abs(change)}% vs período anterior</span>`;
        } else if (chEl) {
            chEl.innerHTML = '<span style="color:#9ca3af">— sin período previo</span>';
        }
    }

    renderKPI('kpiReservas', curr.total, changes.total);
    renderKPI('kpiComensales', curr.guests, changes.guests);
    renderKPI('kpiOcupacion', curr.occupancy_avg, changes.occupancy_avg, '%');
    renderKPI('kpiNoShow', curr.no_show_rate, changes.no_show_rate, '%', true);
    renderKPI('kpiAvgGuests', curr.avg_guests, null, ' p');
}

// ── Trend Chart ──────────────────────────────────

async function loadTrendReport(qs) {
    const data = await apiGet(`/api/reports/trend?${qs}`);
    const el = document.querySelector('#reportTrend .report-content');
    const subtitle = document.getElementById('trendSubtitle');
    if (!el) return;

    if (!data.length) {
        el.innerHTML = '<p style="color:#9ca3af;padding:16px">Sin datos en este período</p>';
        return;
    }

    const maxGuests = Math.max(...data.map(d => d.guests), 1);
    const maxOcc = Math.max(...data.map(d => d.occupancy), 1);

    if (subtitle) subtitle.textContent = `${data.length} días · máx. ${maxOcc}% ocupación`;

    // SVG trend chart
    const W = 600, H = 120, PAD = 32;
    const points = data.map((d, i) => {
        const x = PAD + (i / (data.length - 1 || 1)) * (W - PAD * 2);
        const y = H - PAD - ((d.occupancy / maxOcc) * (H - PAD * 2));
        return { x, y, d };
    });

    const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    const areaD = `M ${points[0].x.toFixed(1)} ${H - PAD} ` + points.map(p => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') + ` L ${points[points.length-1].x.toFixed(1)} ${H - PAD} Z`;

    // X axis labels (show up to 10)
    const step = Math.ceil(data.length / 10);
    const labels = data.map((d, i) => {
        if (i % step !== 0 && i !== data.length - 1) return '';
        const dt = new Date(d.date + 'T12:00:00');
        return `${dt.getDate()}/${dt.getMonth() + 1}`;
    });

    const xLabels = points.map((p, i) => labels[i] ? `<text x="${p.x.toFixed(1)}" y="${H - 4}" text-anchor="middle" font-size="9" fill="#9ca3af">${labels[i]}</text>` : '').join('');

    // Dots for data points
    const dots = points.map(p => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3" fill="#1a8a7d" stroke="white" stroke-width="1.5">
        <title>${p.d.date}: ${p.d.occupancy}% · ${p.d.reservations} res · ${p.d.guests}p</title>
    </circle>`).join('');

    el.innerHTML = `
        <div style="overflow-x:auto">
            <svg viewBox="0 0 ${W} ${H}" style="width:100%;min-width:300px;height:${H}px">
                <defs>
                    <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="#1a8a7d" stop-opacity="0.3"/>
                        <stop offset="100%" stop-color="#1a8a7d" stop-opacity="0.02"/>
                    </linearGradient>
                </defs>
                <!-- Grid lines -->
                ${[25,50,75,100].map(pct => {
                    const gy = H - PAD - (pct / 100 * (H - PAD * 2));
                    return `<line x1="${PAD}" y1="${gy.toFixed(1)}" x2="${W - PAD}" y2="${gy.toFixed(1)}" stroke="#f3f4f6" stroke-width="1"/>
                    <text x="${PAD - 4}" y="${(gy + 3).toFixed(1)}" text-anchor="end" font-size="9" fill="#d1d5db">${pct}%</text>`;
                }).join('')}
                <!-- Area -->
                <path d="${areaD}" fill="url(#trendGrad)"/>
                <!-- Line -->
                <path d="${pathD}" fill="none" stroke="#1a8a7d" stroke-width="2" stroke-linejoin="round"/>
                <!-- Dots -->
                ${dots}
                <!-- X labels -->
                ${xLabels}
            </svg>
        </div>
        <div style="display:flex;gap:16px;margin-top:8px;font-size:12px;color:#6b7280;flex-wrap:wrap">
            <span>📊 <strong>${data.reduce((s,d) => s+d.reservations, 0)}</strong> reservas totales</span>
            <span>👥 <strong>${data.reduce((s,d) => s+d.guests, 0)}</strong> comensales</span>
            <span>📈 Media <strong>${(data.reduce((s,d) => s+d.occupancy, 0) / data.length).toFixed(1)}%</strong> ocupación</span>
        </div>
    `;
}

// ── Heatmap ──────────────────────────────────────

async function loadHeatmapReport(qs) {
    const data = await apiGet(`/api/reports/heatmap?${qs}`);
    const el = document.querySelector('#reportHeatmap .report-content');
    if (!el) return;

    const maxVal = Math.max(...data.flatMap(d => [d.comida, d.cena]), 1);

    function heatColor(val) {
        const intensity = val / maxVal;
        if (intensity === 0) return '#f9fafb';
        const r = Math.round(26 + (intensity * (239 - 26)));
        const g = Math.round(138 + (intensity * (68 - 138)));
        const b = Math.round(125 + (intensity * (68 - 125)));
        return `rgb(${r},${g},${b})`;
    }

    function textColor(val) {
        return (val / maxVal) > 0.4 ? 'white' : '#374151';
    }

    el.innerHTML = `
        <div class="heatmap-grid">
            <div class="heatmap-label"></div>
            ${data.map(d => `<div class="heatmap-day-header">${d.day}</div>`).join('')}
            <div class="heatmap-shift-label">☀️ Comida</div>
            ${data.map(d => `
                <div class="heatmap-cell" style="background:${heatColor(d.comida)};color:${textColor(d.comida)}" title="${d.day} comida: ${d.comida} reservas">
                    ${d.comida || ''}
                </div>`).join('')}
            <div class="heatmap-shift-label">🌙 Cena</div>
            ${data.map(d => `
                <div class="heatmap-cell" style="background:${heatColor(d.cena)};color:${textColor(d.cena)}" title="${d.day} cena: ${d.cena} reservas">
                    ${d.cena || ''}
                </div>`).join('')}
        </div>
        <div style="display:flex;align-items:center;gap:8px;margin-top:12px;font-size:11px;color:#9ca3af">
            <span>Menos</span>
            <div style="display:flex;gap:2px">
                ${[0.1,0.3,0.5,0.7,0.9,1.0].map(i => `<div style="width:20px;height:12px;border-radius:2px;background:${heatColor(Math.round(i*maxVal))}"></div>`).join('')}
            </div>
            <span>Más reservas</span>
        </div>
    `;
}

// ── Sources ──────────────────────────────────────

async function loadSourcesReport(qs) {
    const data = await apiGet(`/api/reports/sources?${qs}`);
    const el = document.querySelector('#reportSources .report-content');
    if (!el) return;
    if (!data.length) { el.innerHTML = '<p style="color:#9ca3af">Sin datos</p>'; return; }

    const total = data.reduce((s, d) => s + d.count, 0);
    const colors = { phone: '#3b82f6', whatsapp: '#22c55e', walk_in: '#8b5cf6', web: '#1a8a7d' };
    const labels = { phone: '📞 Teléfono', whatsapp: '💬 WhatsApp', walk_in: '🚶 Walk-in', web: '🌐 Web' };
    const icons = { phone: '📞', whatsapp: '💬', walk_in: '🚶', web: '🌐' };

    el.innerHTML = data.map(d => {
        const pct = total > 0 ? Math.round(d.count / total * 100) : 0;
        return `
            <div class="report-bar">
                <div class="report-bar-label">${labels[d.source] || d.source}</div>
                <div class="report-bar-track">
                    <div class="report-bar-fill" style="width:${Math.max(pct, 4)}%;background:${colors[d.source] || '#6b7280'}">
                        <span class="report-bar-value">${d.count} · ${pct}%</span>
                    </div>
                </div>
            </div>`;
    }).join('') + `<div style="text-align:center;margin-top:12px;font-size:12px;color:#9ca3af">Total: <strong>${total}</strong> reservas</div>`;
}

// ── Zones ────────────────────────────────────────

async function loadZonesReport(qs) {
    const data = await apiGet(`/api/reports/zones?${qs}`);
    const el = document.querySelector('#reportZones .report-content');
    if (!el) return;
    if (!data.length) { el.innerHTML = '<p style="color:#9ca3af">Sin datos</p>'; return; }

    const colors = { exterior: '#22c55e', salon_principal: '#1a8a7d', salon_interior: '#f59e0b' };
    const icons = { exterior: '🌿', salon_principal: '🏛', salon_interior: '🪑' };
    const maxGuests = Math.max(...data.map(d => d.guests), 1);

    el.innerHTML = data.map(d => {
        const pct = Math.round(d.guests / maxGuests * 100);
        const color = colors[d.zone] || '#6b7280';
        return `
        <div style="margin-bottom:14px">
            <div style="display:flex;justify-content:space-between;margin-bottom:4px">
                <span style="font-weight:600;color:#374151">${icons[d.zone] || ''} ${zoneName(d.zone)}</span>
                <span style="font-size:12px;color:#6b7280">${d.reservations} res · ${d.guests}p</span>
            </div>
            <div class="report-bar-track">
                <div class="report-bar-fill" style="width:${Math.max(pct,4)}%;background:${color}">
                    <span class="report-bar-value">${d.guests}p</span>
                </div>
            </div>
        </div>`;
    }).join('');
}

// ── Hours peak ───────────────────────────────────

async function loadHoursReport(qs) {
    const data = await apiGet(`/api/reports/hours?${qs}`);
    const el = document.querySelector('#reportHours .report-content');
    if (!el) return;
    if (!data.length) { el.innerHTML = '<p style="color:#9ca3af">Sin datos</p>'; return; }

    const max = Math.max(...data.map(d => d.count), 1);
    el.innerHTML = data.map(d => `
        <div class="report-bar">
            <div class="report-bar-label" style="width:56px">${d.hour} ${d.shift === 'comida' ? '☀️' : '🌙'}</div>
            <div class="report-bar-track">
                <div class="report-bar-fill" style="width:${Math.max(d.count/max*100,4)}%;background:${d.shift==='comida'?'#f59e0b':'#3b82f6'}">
                    <span class="report-bar-value">${d.count} res · ${d.guests}p</span>
                </div>
            </div>
        </div>`).join('');
}

// ── No Shows ─────────────────────────────────────

async function loadNoShowsReport(qs) {
    const data = await apiGet(`/api/reports/no-shows?${qs}`);
    const el = document.querySelector('#reportNoShows .report-content');
    if (!el) return;

    const isGood = data.rate <= 10;
    const rateColor = isGood ? '#16a34a' : data.rate <= 20 ? '#f59e0b' : '#ef4444';
    const emoji = isGood ? '✅' : data.rate <= 20 ? '⚠️' : '🚨';

    el.innerHTML = `
        <div style="text-align:center;padding:12px 0">
            <div style="font-size:42px;font-weight:800;color:${rateColor};line-height:1">${data.rate}%</div>
            <div style="font-size:12px;color:#6b7280;margin-top:4px">Tasa de No-Show ${emoji}</div>
            <div style="margin-top:16px;font-size:13px;color:#374151">
                <strong style="color:#ef4444">${data.no_shows}</strong> de <strong>${data.total_reservations}</strong> reservas
            </div>
        </div>
        <div style="margin-top:16px;padding:10px;border-radius:8px;background:${isGood?'#f0fdf4':'#fef2f2'};font-size:12px;color:#374151;text-align:center">
            ${isGood ? '✅ Tasa excelente. Menos del 10% es el objetivo.' : data.rate <= 20 ? '⚠️ Tasa moderada. Considera enviar recordatorios.' : '🚨 Tasa alta. Revisa política de confirmaciones.'}
        </div>
    `;
}

// ── Top Clients ──────────────────────────────────

async function loadTopClientsReport(qs) {
    const data = await apiGet(`/api/reports/clients?${qs}&limit=10`);
    const el = document.querySelector('#reportTopClients .report-content');
    if (!el) return;
    if (!data.length) { el.innerHTML = '<p style="color:#9ca3af">Sin datos</p>'; return; }

    const maxVisits = Math.max(...data.map(c => c.visits), 1);

    el.innerHTML = `
        <div style="overflow-x:auto">
            <table class="report-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Cliente</th>
                        <th>Visitas</th>
                        <th>Comensales</th>
                        <th>Última visita</th>
                        <th>Fidelidad</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.map((c, i) => `
                        <tr>
                            <td style="color:#9ca3af;font-size:12px">${i+1}</td>
                            <td>
                                <strong>${c.name}</strong>
                                ${c.vip ? '<span class="badge badge-vip" style="margin-left:4px">VIP</span>' : ''}
                                ${c.phone ? `<div style="font-size:11px;color:#9ca3af">${c.phone}</div>` : ''}
                            </td>
                            <td><strong style="color:#1a8a7d">${c.visits}</strong></td>
                            <td>${c.total_guests}</td>
                            <td style="font-size:12px;color:#6b7280">${c.last_visit ? formatDate(c.last_visit) : '—'}</td>
                            <td>
                                <div style="width:64px;height:6px;background:#f3f4f6;border-radius:99px;overflow:hidden">
                                    <div style="width:${c.visits/maxVisits*100}%;height:100%;background:${c.vip?'#f59e0b':'#1a8a7d'};border-radius:99px"></div>
                                </div>
                            </td>
                        </tr>`).join('')}
                </tbody>
            </table>
        </div>`;
}

// ── Popular Tables ───────────────────────────────

async function loadPopularTablesReport(qs) {
    const data = await apiGet(`/api/reports/popular-tables?${qs}`);
    const el = document.querySelector('#reportPopularTables .report-content');
    if (!el) return;
    if (!data.length) { el.innerHTML = '<p style="color:#9ca3af">Sin datos</p>'; return; }

    const max = Math.max(...data.map(d => d.times_reserved), 1);
    const zoneColors = { exterior: '#22c55e', salon_principal: '#1a8a7d', salon_interior: '#f59e0b' };

    el.innerHTML = data.slice(0, 10).map(d => {
        const color = zoneColors[d.zone] || '#6b7280';
        return `
        <div class="report-bar">
            <div class="report-bar-label" style="width:48px">Mesa ${d.table_number}</div>
            <div class="report-bar-track">
                <div class="report-bar-fill" style="width:${Math.max(d.times_reserved/max*100,4)}%;background:${color}">
                    <span class="report-bar-value">${d.times_reserved}× · ${zoneName(d.zone)}</span>
                </div>
            </div>
        </div>`;
    }).join('');
}

// ── Daily Summary ────────────────────────────────

async function loadSummaryReport() {
    const data = await apiGet(`/api/reports/summary?date=${currentDate}`);
    const el = document.querySelector('#reportSummary .report-content');
    if (!el) return;

    let html = '';
    for (const shift of ['comida', 'cena']) {
        const s = data[shift];
        if (!s) continue;
        const icon = shift === 'comida' ? '☀️' : '🌙';
        const active = s.total - s.cancelled - s.no_show;
        const completionRate = s.total > 0 ? Math.round(s.completed / s.total * 100) : 0;
        html += `
            <div style="margin-bottom:18px;padding-bottom:18px;border-bottom:1px solid #f3f4f6">
                <div style="font-weight:700;color:#374151;margin-bottom:10px;font-size:14px">${icon} ${shift.charAt(0).toUpperCase() + shift.slice(1)}</div>
                <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">
                    <div style="background:#f0fdf4;padding:8px;border-radius:8px;text-align:center">
                        <div style="font-size:22px;font-weight:800;color:#16a34a">${s.total}</div>
                        <div style="font-size:10px;color:#6b7280;margin-top:2px">Reservas</div>
                    </div>
                    <div style="background:#eff6ff;padding:8px;border-radius:8px;text-align:center">
                        <div style="font-size:22px;font-weight:800;color:#3b82f6">${s.guests}</div>
                        <div style="font-size:10px;color:#6b7280;margin-top:2px">Comensales</div>
                    </div>
                    <div style="background:#f5f3ff;padding:8px;border-radius:8px;text-align:center">
                        <div style="font-size:22px;font-weight:800;color:#7c3aed">${s.seated}</div>
                        <div style="font-size:10px;color:#6b7280;margin-top:2px">Sentadas</div>
                    </div>
                    <div style="background:#fef2f2;padding:8px;border-radius:8px;text-align:center">
                        <div style="font-size:18px;font-weight:700;color:#ef4444">${s.cancelled}</div>
                        <div style="font-size:10px;color:#6b7280;margin-top:2px">Canceladas</div>
                    </div>
                    <div style="background:#fff7ed;padding:8px;border-radius:8px;text-align:center">
                        <div style="font-size:18px;font-weight:700;color:#ea580c">${s.no_show}</div>
                        <div style="font-size:10px;color:#6b7280;margin-top:2px">No Show</div>
                    </div>
                    <div style="background:#f0fdf4;padding:8px;border-radius:8px;text-align:center">
                        <div style="font-size:18px;font-weight:700;color:#16a34a">${completionRate}%</div>
                        <div style="font-size:10px;color:#6b7280;margin-top:2px">Completadas</div>
                    </div>
                </div>
            </div>`;
    }
    el.innerHTML = html || '<p style="color:#9ca3af;padding:16px;text-align:center">Sin datos para hoy</p>';
}

// ── Export report CSV ────────────────────────────

function exportReportCSV() {
    const from = document.getElementById('reportFrom')?.value;
    const to = document.getElementById('reportTo')?.value;
    if (!from || !to) { showToast('Selecciona un período primero', 'error'); return; }
    window.open(`/api/export/reservations.csv?from=${from}&to=${to}`);
}

// ── WhatsApp Test Chat ───────────────────────────

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
