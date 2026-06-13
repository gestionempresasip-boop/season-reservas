/* ═══════════════════════════════════════════════
   SEASON · Informes v3 — 4 modos con métricas reales
   HOY | SEMANA | MES | PERSONALIZADO
   ═══════════════════════════════════════════════ */

let _reportMode = 'hoy';

// Selected date state for each mode
let _rdnDate  = new Date();                    // Hoy: selected day
let _rdnWeek  = _mondayOf(new Date());         // Semana: Monday of selected week
let _rdnMonth = { y: new Date().getFullYear(), m: new Date().getMonth() }; // Mes

function localISODate(d) {
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

function _mondayOf(d) {
    const day = new Date(d);
    const dow = day.getDay();
    day.setDate(day.getDate() - (dow === 0 ? 6 : dow - 1));
    day.setHours(0,0,0,0);
    return day;
}

const _MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const _DAYS_ES   = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];

function _fmtDay(d) {
    return `${_DAYS_ES[d.getDay()]} ${d.getDate()} ${_MONTHS_ES[d.getMonth()]} ${d.getFullYear()}`;
}
function _fmtWeekRange(mon) {
    const sun = new Date(mon); sun.setDate(sun.getDate() + 6);
    const d1 = mon.getDate(), d2 = sun.getDate();
    const m1 = _MONTHS_ES[mon.getMonth()], m2 = _MONTHS_ES[sun.getMonth()];
    const y  = sun.getFullYear();
    return mon.getMonth() === sun.getMonth()
        ? `${d1} – ${d2} ${m1} ${y}`
        : `${d1} ${m1} – ${d2} ${m2} ${y}`;
}

function _updateDateNav() {
    const nav = document.getElementById('reportDateNav');
    const lbl = document.getElementById('reportDateLabel');
    if (!nav || !lbl) return;

    const show = ['hoy','semana','mes'].includes(_reportMode);
    nav.style.display = show ? 'flex' : 'none';

    if (_reportMode === 'hoy') {
        lbl.textContent = _fmtDay(_rdnDate);
    } else if (_reportMode === 'semana') {
        lbl.textContent = `Semana  ${_fmtWeekRange(_rdnWeek)}`;
    } else if (_reportMode === 'mes') {
        lbl.textContent = `${_MONTHS_ES[_rdnMonth.m]} ${_rdnMonth.y}`;
    }
}

function reportNavStep(dir) {
    if (_reportMode === 'hoy') {
        _rdnDate = new Date(_rdnDate);
        _rdnDate.setDate(_rdnDate.getDate() + dir);
    } else if (_reportMode === 'semana') {
        _rdnWeek = new Date(_rdnWeek);
        _rdnWeek.setDate(_rdnWeek.getDate() + dir * 7);
    } else if (_reportMode === 'mes') {
        let m = _rdnMonth.m + dir;
        let y = _rdnMonth.y;
        if (m > 11) { m = 0; y++; }
        if (m < 0)  { m = 11; y--; }
        _rdnMonth = { y, m };
    }
    _updateDateNav();
    loadReports();
}

function reportOpenPicker() {
    if (_reportMode === 'hoy') {
        const p = document.getElementById('rdnPickerDay');
        p.value = localISODate(_rdnDate);
        p.showPicker ? p.showPicker() : p.click();
    } else if (_reportMode === 'semana') {
        const p = document.getElementById('rdnPickerWeek');
        // Format YYYY-Www for the input
        const mon = _rdnWeek;
        const jan4 = new Date(mon.getFullYear(), 0, 4);
        const wk   = Math.ceil(((mon - jan4) / 86400000 + jan4.getDay() + 1) / 7);
        p.value = `${mon.getFullYear()}-W${String(wk).padStart(2,'0')}`;
        p.showPicker ? p.showPicker() : p.click();
    } else if (_reportMode === 'mes') {
        const p = document.getElementById('rdnPickerMonth');
        p.value = `${_rdnMonth.y}-${String(_rdnMonth.m + 1).padStart(2,'0')}`;
        p.showPicker ? p.showPicker() : p.click();
    }
}

function reportPickDay(val) {
    if (!val) return;
    const [y, m, d] = val.split('-').map(Number);
    _rdnDate = new Date(y, m - 1, d);
    _updateDateNav();
    loadReports();
}

function reportPickWeek(val) {
    if (!val) return;
    // val is "YYYY-Www"
    const [yearStr, wStr] = val.split('-W');
    const year = Number(yearStr), week = Number(wStr);
    // ISO week → Monday date
    const jan4 = new Date(year, 0, 4);
    const mon  = new Date(jan4);
    mon.setDate(jan4.getDate() - (jan4.getDay() || 7) + 1 + (week - 1) * 7);
    _rdnWeek = mon;
    _updateDateNav();
    loadReports();
}

function reportPickMonth(val) {
    if (!val) return;
    const [y, m] = val.split('-').map(Number);
    _rdnMonth = { y, m: m - 1 };
    _updateDateNav();
    loadReports();
}

function initReportDates() {
    setReportMode('hoy');
}

function setReportMode(mode) {
    _reportMode = mode;
    document.querySelectorAll('.rmode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
    const customRange = document.getElementById('rmodeCustomRange');
    if (customRange) customRange.style.display = mode === 'custom' ? 'flex' : 'none';
    _updateDateNav();
    if (mode !== 'custom') loadReports();
}

async function loadReports() {
    const content = document.getElementById('reportsContent');
    if (!content) return;
    content.innerHTML = '<div class="report-loading">Cargando datos…</div>';
    try {
        if (_reportMode === 'hoy')    await renderHoy(content);
        else if (_reportMode === 'semana') await renderSemana(content);
        else if (_reportMode === 'mes')    await renderMes(content);
        else if (_reportMode === 'custom') await renderCustom(content);
    } catch (e) {
        content.innerHTML = `<div class="report-error">Error al cargar datos: ${e.message}</div>`;
    }
}

// ═══════════════════════════════════════════════
// MODO HOY
// ═══════════════════════════════════════════════

async function renderHoy(container) {
    const today = localISODate(_rdnDate);
    const safe = fn => fn.catch(() => null);
    const [summary, hours] = await Promise.all([
        safe(apiGet(`/api/reports/summary?date=${today}`)),
        safe(apiGet(`/api/reports/hours?from=${today}&to=${today}`)),
    ]);
    if (!summary) { container.innerHTML = '<div class="report-error">No se pudieron cargar los datos de hoy</div>'; return; }

    const c = summary.comida || {};
    const n = summary.cena || {};
    const totalRes = (c.total||0) + (n.total||0);
    const totalGuests = (c.guests||0) + (n.guests||0);
    const totalSentadas = (c.seated||0) + (n.seated||0);
    const totalNoShow = (c.no_show||0) + (n.no_show||0);
    const totalCompleted = (c.completed||0) + (n.completed||0);
    const ocup = Math.round(totalGuests / 114 * 100);

    container.innerHTML = `
        <!-- Cabecera del día -->
        <div class="rh-top">
            <div class="rh-date">${formatDateES(today)}</div>
            <div class="rh-tagline">${totalRes === 0 ? 'Sin reservas hoy' : `${totalRes} reservas · ${totalGuests} comensales`}</div>
        </div>

        <!-- Ocupación visual -->
        <div class="rh-occ-bar-wrap">
            <div class="rh-occ-label">Ocupación total hoy</div>
            <div class="rh-occ-bar">
                <div class="rh-occ-fill" style="width:${Math.min(ocup,100)}%">
                    <span>${ocup}%</span>
                </div>
            </div>
            <div class="rh-occ-cap">/ 114 aforo</div>
        </div>

        <!-- Turnos side by side -->
        <div class="rh-shifts">
            ${renderShiftCard('☀️ COMIDA', c, '#f59e0b', '#fffbeb', '#fde68a')}
            ${renderShiftCard('🌙 CENA', n, '#3b82f6', '#eff6ff', '#bfdbfe')}
        </div>

        <!-- Métricas rápidas -->
        <div class="rh-quick-metrics">
            ${renderQuickMetric('Ahora sentadas', totalSentadas, 'mesas activas', '#16a34a')}
            ${renderQuickMetric('No shows', totalNoShow, totalRes > 0 ? Math.round(totalNoShow/totalRes*100)+'% de las reservas' : '—', totalNoShow > 0 ? '#ef4444' : '#9ca3af')}
            ${renderQuickMetric('Completadas', totalCompleted, 'reservas cerradas', '#1a8a7d')}
            ${renderQuickMetric('Media grupo', totalRes > 0 ? (totalGuests/totalRes).toFixed(1) : '—', 'pers. por reserva', '#7c3aed')}
        </div>

        <!-- Horas pico hoy -->
        ${hours.length ? `
        <div class="rc-section">
            <div class="rc-section-title">⏰ Distribución por hora</div>
            <div style="padding:0 16px 16px">
                ${renderHourBars(hours)}
            </div>
        </div>` : ''}
    `;
}

function renderShiftCard(label, s, color, bg, border) {
    if (!s || !s.total) return `
        <div class="rh-shift-card" style="background:${bg};border-color:${border}">
            <div class="rh-shift-label" style="color:${color}">${label}</div>
            <div style="color:#9ca3af;font-size:13px;padding:12px 0">Sin reservas</div>
        </div>`;
    const active = (s.total||0) - (s.cancelled||0) - (s.no_show||0);
    const occ = Math.round((s.guests||0) / 114 * 100);
    return `
    <div class="rh-shift-card" style="background:${bg};border-color:${border}">
        <div class="rh-shift-label" style="color:${color}">${label}</div>
        <div class="rh-shift-big">${s.guests||0}<span>p</span></div>
        <div class="rh-shift-sub">${s.total||0} reservas · ${occ}% ocupación</div>
        <div class="rh-shift-states">
            <span style="color:#f97316">●  ${s.confirmed||0} conf.</span>
            <span style="color:#16a34a">●  ${s.seated||0} sent.</span>
            <span style="color:#1a8a7d">●  ${s.completed||0} comp.</span>
            ${s.no_show > 0 ? `<span style="color:#ef4444">●  ${s.no_show} N/S</span>` : ''}
        </div>
    </div>`;
}

function renderQuickMetric(label, value, sub, color) {
    return `
    <div class="rh-metric">
        <div class="rh-metric-val" style="color:${color}">${value}</div>
        <div class="rh-metric-label">${label}</div>
        <div class="rh-metric-sub">${sub}</div>
    </div>`;
}

function renderHourBars(hours) {
    const max = Math.max(...hours.map(h => h.count), 1);
    return hours.map(h => `
        <div class="report-bar" style="margin-bottom:6px">
            <div class="report-bar-label" style="width:60px">${h.hour} ${h.shift==='comida'?'☀️':'🌙'}</div>
            <div class="report-bar-track">
                <div class="report-bar-fill" style="width:${Math.max(h.count/max*100,4)}%;background:${h.shift==='comida'?'#f59e0b':'#3b82f6'}">
                    <span class="report-bar-value">${h.count} res · ${h.guests}p</span>
                </div>
            </div>
        </div>`).join('');
}

// ═══════════════════════════════════════════════
// MODO SEMANA
// ═══════════════════════════════════════════════

async function renderSemana(container) {
    const monday = _rdnWeek;
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
    const qs7 = `from=${localISODate(monday)}&to=${localISODate(sunday)}`;
    const safe = fn => fn.catch(() => null);
    const [weekData, retention, hours] = await Promise.all([
        safe(apiGet(`/api/reports/week-comparison?from=${localISODate(monday)}`)),
        safe(apiGet(`/api/reports/new-vs-returning?${qs7}`)),
        safe(apiGet(`/api/reports/hours?${qs7}`)),
    ]);

    if (!weekData) { container.innerHTML = '<div class="report-error">No se pudieron cargar los datos de esta semana</div>'; return; }
    const t = weekData.totals || {};
    const ch = weekData.changes || {};
    const p = weekData.prev_totals || {};
    const days = weekData.days || [];
    const dayNames = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];

    const maxGuests = Math.max(...days.map(d => d.guests||0), 1);

    container.innerHTML = `
        <div class="rw-kpis">
            ${renderKPIBlock('Reservas', t.reservations||0, ch.reservations, '')}
            ${renderKPIBlock('Comensales', t.guests||0, ch.guests, '')}
            ${renderKPIBlock('Ocupación media', (t.occupancy_avg||0)+'%', ch.occupancy_avg, '')}
            ${renderKPIBlock('No-shows', (t.no_show_rate||0)+'%', ch.no_show_rate, '', true)}
        </div>
        <div class="rw-vs-label">vs semana anterior · ${p.reservations||0} res · ${p.guests||0}p</div>

        <div class="rc-section">
            <div class="rc-section-title">📊 Comensales por día</div>
            <div class="rw-bars">
                ${days.length ? days.map((d) => {
                    const dt = new Date(d.date + 'T12:00:00');
                    const dayName = dayNames[dt.getDay() === 0 ? 6 : dt.getDay()-1];
                    const dayNum = dt.getDate() + '/' + (dt.getMonth()+1);
                    const heightComida = maxGuests > 0 ? Math.max((d.comida_guests||0) / maxGuests * 100, 0) : 0;
                    const heightCena = maxGuests > 0 ? Math.max((d.cena_guests||0) / maxGuests * 100, 0) : 0;
                    const isToday = d.date === localISODate(new Date());
                    return `
                    <div class="rw-bar-col ${isToday ? 'rw-today' : ''}">
                        <div class="rw-bar-stacked">
                            ${d.cena_guests > 0 ? `<div class="rw-bar-cena" style="height:${heightCena}%" title="Cena: ${d.cena_guests}p"></div>` : ''}
                            ${d.comida_guests > 0 ? `<div class="rw-bar-comida" style="height:${heightComida}%" title="Comida: ${d.comida_guests}p"></div>` : ''}
                        </div>
                        <div class="rw-bar-total">${d.guests||0}</div>
                        <div class="rw-bar-label">${dayName}</div>
                        <div class="rw-bar-date">${dayNum}</div>
                    </div>`;
                }).join('') : '<p style="color:#9ca3af;padding:16px">Sin datos esta semana</p>'}
            </div>
            <div class="rw-legend">
                <span><span class="rw-dot rw-dot-comida"></span>Comida</span>
                <span><span class="rw-dot rw-dot-cena"></span>Cena</span>
            </div>
        </div>

        <div class="rc-section-row">
            <div class="rc-section rc-half">
                <div class="rc-section-title">⏰ Horas punta</div>
                <div style="padding:10px 16px 16px">${renderHourBars(hours||[])}</div>
            </div>
            <div class="rc-section rc-half">
                <div class="rc-section-title">📉 Análisis No-Shows</div>
                <div style="padding:12px 16px">${renderNoShowInsight(t)}</div>
            </div>
        </div>

        <div class="rc-section">
            <div class="rc-section-title">👥 Clientes nuevos vs recurrentes</div>
            <div style="padding:12px 16px">${renderRetentionChart(retention||{})}</div>
        </div>
    `;
}

function renderKPIBlock(label, value, change, suffix='', invertGood=false) {
    let changeHtml = '';
    if (change !== null && change !== undefined) {
        const up = change > 0;
        const good = invertGood ? !up : up;
        changeHtml = `<div class="rw-kpi-change" style="color:${good?'#16a34a':'#ef4444'}">${up?'▲':'▼'} ${Math.abs(change)}%</div>`;
    }
    return `
    <div class="rw-kpi">
        <div class="rw-kpi-val">${value}${suffix}</div>
        <div class="rw-kpi-label">${label}</div>
        ${changeHtml}
    </div>`;
}

function renderRetentionChart(r) {
    if (!r || !r.total) return '<p style="color:#9ca3af">Sin datos</p>';
    const newPct = Math.round(r.new / r.total * 100);
    const retPct = 100 - newPct;
    return `
        <div style="display:flex;gap:8px;height:16px;border-radius:8px;overflow:hidden;margin-bottom:10px">
            <div style="width:${newPct}%;background:#3b82f6;transition:width 0.5s"></div>
            <div style="flex:1;background:#16a34a;transition:width 0.5s"></div>
        </div>
        <div style="display:flex;gap:16px;font-size:13px">
            <div><span style="color:#3b82f6;font-weight:700">${r.new}</span><br><span style="color:#6b7280">Nuevos (${newPct}%)</span></div>
            <div><span style="color:#16a34a;font-weight:700">${r.returning}</span><br><span style="color:#6b7280">Recurrentes (${retPct}%)</span></div>
        </div>
        <div style="margin-top:10px;padding:8px;border-radius:8px;background:${r.returning_rate>40?'#f0fdf4':'#eff6ff'};font-size:12px;color:#374151">
            ${r.returning_rate > 50 ? '✅ Alta fidelización — más de la mitad repite' :
              r.returning_rate > 30 ? '💡 Buena base de clientes recurrentes' :
              '📢 Potencial de mejora en fidelización'}
        </div>`;
}

function renderNoShowInsight(t) {
    const rate = t.no_show_rate || 0;
    const noshows = t.no_shows || 0;
    const color = rate <= 5 ? '#16a34a' : rate <= 15 ? '#f59e0b' : '#ef4444';
    const msg = rate <= 5 ? '✅ Excelente — tasa muy baja' :
                rate <= 15 ? '⚠️ Modera — envía recordatorios WhatsApp' :
                '🚨 Alta — considera confirmaciones 24h antes';
    return `
        <div style="text-align:center;padding:8px 0">
            <div style="font-size:36px;font-weight:800;color:${color}">${rate}%</div>
            <div style="font-size:12px;color:#6b7280">${noshows} personas no aparecieron</div>
        </div>
        <div style="margin-top:12px;padding:8px 10px;border-radius:8px;background:#f9fafb;font-size:12px;color:#374151">${msg}</div>`;
}

// ═══════════════════════════════════════════════
// MODO MES
// ═══════════════════════════════════════════════

async function renderMes(container) {
    const firstDay = new Date(_rdnMonth.y, _rdnMonth.m, 1);
    const lastDay  = new Date(_rdnMonth.y, _rdnMonth.m + 1, 0);
    const qs = `from=${localISODate(firstDay)}&to=${localISODate(lastDay)}`;

    const safe = fn => fn.catch(() => null);
    const [kpi, trend, heatmap, sources, topClients, retention, hours] = await Promise.all([
        safe(apiGet(`/api/reports/kpi?${qs}`)),
        safe(apiGet(`/api/reports/trend?${qs}`)),
        safe(apiGet(`/api/reports/heatmap?${qs}`)),
        safe(apiGet(`/api/reports/sources?${qs}`)),
        safe(apiGet(`/api/reports/clients?${qs}&limit=5`)),
        safe(apiGet(`/api/reports/new-vs-returning?${qs}`)),
        safe(apiGet(`/api/reports/hours?${qs}`)),
    ]);

    const curr = (kpi||{}).current || {};
    const ch = (kpi||{}).changes || {};

    container.innerHTML = `
        <div class="rw-kpis rm-kpis">
            ${renderKPIBlock('Reservas', curr.total||0, ch.total)}
            ${renderKPIBlock('Comensales', curr.guests||0, ch.guests)}
            ${renderKPIBlock('Ocupación media', (curr.occupancy_avg||0)+'%', ch.occupancy_avg)}
            ${renderKPIBlock('No-show', (curr.no_show_rate||0)+'%', ch.no_show_rate, '', true)}
            ${renderKPIBlock('Media grupo', (curr.avg_guests||0)+' p', null)}
        </div>
        <div class="rw-vs-label">vs mes anterior · ${((kpi||{}).previous||{}).reservations||0} res · ${((kpi||{}).previous||{}).guests||0}p</div>

        <div class="rc-section">
            <div class="rc-section-title">📈 Tendencia de ocupación — 30 días</div>
            <div style="padding:8px 12px 16px">${renderTrendSVG(trend||[])}</div>
        </div>

        <div class="rc-section-row">
            <div class="rc-section rc-half">
                <div class="rc-section-title">🔥 Días y turnos más concurridos</div>
                <div style="padding:10px 16px 16px">${renderHeatmapInline(heatmap||[])}</div>
            </div>
            <div class="rc-section rc-half">
                <div class="rc-section-title">⏰ Horas punta</div>
                <div style="padding:10px 16px 16px">${renderHourBars(hours||[])}</div>
            </div>
        </div>

        <div class="rc-section-row">
            <div class="rc-section rc-half">
                <div class="rc-section-title">📣 Origen de reservas</div>
                <div style="padding:10px 16px 16px">${renderSourcesInline(sources||[])}</div>
            </div>
            <div class="rc-section rc-half">
                <div class="rc-section-title">👥 Clientes nuevos vs recurrentes</div>
                <div style="padding:12px 16px">${renderRetentionChart(retention||{})}</div>
            </div>
        </div>

        <div class="rc-section">
            <div class="rc-section-title">⭐ Top clientes del mes</div>
            <div style="padding:8px 16px 16px">${renderTopClientsInline(topClients||[])}</div>
        </div>
    `;
}

// ═══════════════════════════════════════════════
// MODO PERSONALIZADO
// ═══════════════════════════════════════════════

async function renderCustom(container) {
    const from = document.getElementById('reportFrom')?.value;
    const to = document.getElementById('reportTo')?.value;
    if (!from || !to) {
        container.innerHTML = '<div class="report-loading">Selecciona un rango de fechas y pulsa Ver</div>';
        return;
    }
    const qs = `from=${from}&to=${to}`;
    const days = Math.round((new Date(to) - new Date(from)) / 86400000) + 1;

    const safe = fn => fn.catch(() => null);
    const [kpi, trend, sources, topClients, retention, hours, heatmap] = await Promise.all([
        safe(apiGet(`/api/reports/kpi?${qs}`)),
        safe(apiGet(`/api/reports/trend?${qs}`)),
        safe(apiGet(`/api/reports/sources?${qs}`)),
        safe(apiGet(`/api/reports/clients?${qs}&limit=8`)),
        safe(apiGet(`/api/reports/new-vs-returning?${qs}`)),
        safe(apiGet(`/api/reports/hours?${qs}`)),
        safe(apiGet(`/api/reports/heatmap?${qs}`)),
    ]);

    const curr = (kpi||{}).current || {};
    const ch = (kpi||{}).changes || {};

    container.innerHTML = `
        <div class="rh-top" style="padding:12px 16px 4px">
            <div class="rh-date">${formatDateES(from)} — ${formatDateES(to)}</div>
            <div class="rh-tagline">${days} días · ${curr.total||0} reservas · ${curr.guests||0} comensales</div>
        </div>
        <div class="rw-kpis rm-kpis">
            ${renderKPIBlock('Reservas', curr.total||0, ch.total)}
            ${renderKPIBlock('Comensales', curr.guests||0, ch.guests)}
            ${renderKPIBlock('Ocupación media', (curr.occupancy_avg||0)+'%', ch.occupancy_avg)}
            ${renderKPIBlock('No-show', (curr.no_show_rate||0)+'%', ch.no_show_rate, '', true)}
            ${renderKPIBlock('Media grupo', (curr.avg_guests||0)+' p', null)}
        </div>
        <div class="rw-vs-label">vs período anterior equivalente</div>

        <div class="rc-section">
            <div class="rc-section-title">📈 Tendencia diaria</div>
            <div style="padding:8px 12px 16px">${renderTrendSVG(trend||[])}</div>
        </div>

        <div class="rc-section-row">
            <div class="rc-section rc-half">
                <div class="rc-section-title">⏰ Horas punta</div>
                <div style="padding:10px 16px 16px">${renderHourBars(hours||[])}</div>
            </div>
            <div class="rc-section rc-half">
                <div class="rc-section-title">🔥 Días más concurridos</div>
                <div style="padding:10px 16px 16px">${renderHeatmapInline(heatmap||[])}</div>
            </div>
        </div>

        <div class="rc-section-row">
            <div class="rc-section rc-half">
                <div class="rc-section-title">📣 Origen de reservas</div>
                <div style="padding:10px 16px 16px">${renderSourcesInline(sources||[])}</div>
            </div>
            <div class="rc-section rc-half">
                <div class="rc-section-title">👥 Fidelización</div>
                <div style="padding:12px 16px">${renderRetentionChart(retention||{})}</div>
            </div>
        </div>

        <div class="rc-section">
            <div class="rc-section-title">⭐ Clientes frecuentes</div>
            <div style="padding:8px 16px 16px">${renderTopClientsInline(topClients||[])}</div>
        </div>
    `;
}

// ═══════════════════════════════════════════════
// COMPONENTES COMPARTIDOS
// ═══════════════════════════════════════════════

function renderTrendSVG(data) {
    if (!data.length) return '<p style="color:#9ca3af;padding:8px">Sin datos en este período</p>';

    const W = 560, H = 100, PL = 36, PR = 12, PT = 10, PB = 24;
    const maxG = Math.max(...data.map(d => d.guests), 1);
    const n = data.length;

    const toX = i => PL + (i / Math.max(n - 1, 1)) * (W - PL - PR);
    const toY = v => H - PB - (v / maxG) * (H - PT - PB);

    const pts = data.map((d, i) => ({ x: toX(i), y: toY(d.guests), d }));
    const line = pts.map((p, i) => `${i===0?'M':'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const area = `M${pts[0].x.toFixed(1)},${H-PB} ` + pts.map(p => `L${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') + ` L${pts[n-1].x.toFixed(1)},${H-PB}Z`;

    // x labels: show ~6
    const step = Math.ceil(n / 6);
    const xLabels = pts.map((p, i) => {
        if (i % step !== 0 && i !== n-1) return '';
        const dt = new Date(data[i].date + 'T12:00:00');
        return `<text x="${p.x.toFixed(1)}" y="${H-2}" text-anchor="middle" font-size="9" fill="#9ca3af">${dt.getDate()}/${dt.getMonth()+1}</text>`;
    }).join('');

    const gridLines = [25,50,75,100].map(pct => {
        const gy = toY(maxG * pct / 100);
        return `<line x1="${PL}" y1="${gy.toFixed(1)}" x2="${W-PR}" y2="${gy.toFixed(1)}" stroke="#f3f4f6" stroke-width="1"/>
                <text x="${PL-4}" y="${(gy+3).toFixed(1)}" text-anchor="end" font-size="8" fill="#d1d5db">${Math.round(maxG*pct/100)}</text>`;
    }).join('');

    const dots = pts.map(p => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="2.5" fill="#1a8a7d" stroke="white" stroke-width="1.5"><title>${p.d.date}: ${p.d.guests}p · ${p.d.occupancy}%</title></circle>`).join('');

    const totalGuests = data.reduce((s,d)=>s+d.guests,0);
    const avgOcc = (data.reduce((s,d)=>s+d.occupancy,0)/n).toFixed(1);
    const maxDay = data.reduce((a,b)=>b.guests>a.guests?b:a);

    return `
        <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:${H}px">
            <defs><linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#1a8a7d" stop-opacity="0.25"/>
                <stop offset="100%" stop-color="#1a8a7d" stop-opacity="0.02"/>
            </linearGradient></defs>
            ${gridLines}
            <path d="${area}" fill="url(#tg)"/>
            <path d="${line}" fill="none" stroke="#1a8a7d" stroke-width="2" stroke-linejoin="round"/>
            ${dots}
            ${xLabels}
        </svg>
        <div class="trend-footer">
            <span>👥 <strong>${totalGuests}</strong> comensales totales</span>
            <span>📈 Media <strong>${avgOcc}%</strong> ocupación</span>
            <span>🏆 Mejor día: <strong>${maxDay.date ? new Date(maxDay.date+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'short'}) : '—'}</strong> (${maxDay.guests}p)</span>
        </div>`;
}

function renderHeatmapInline(data) {
    if (!data || !data.length) return '<p style="color:#9ca3af">Sin datos</p>';
    const max = Math.max(...data.flatMap(d=>[d.comida||0,d.cena||0]), 1);
    const cell = (val) => {
        const t = (val||0)/max;
        const bg = t === 0 ? '#f9fafb' : `rgba(26,138,125,${0.15 + t*0.85})`;
        const color = t > 0.5 ? 'white' : '#374151';
        return `<div class="heatmap-cell" style="background:${bg};color:${color};font-size:11px" title="${val||0} reservas">${val||''}</div>`;
    };
    return `
        <div class="heatmap-scroll-wrap">
            <div class="heatmap-grid" style="grid-template-columns:48px repeat(${data.length},1fr)">
                <div></div>
                ${data.map(d=>`<div class="heatmap-day-header" style="font-size:10px">${d.day}</div>`).join('')}
                <div class="heatmap-shift-label" style="font-size:11px">☀️</div>${data.map(d=>cell(d.comida)).join('')}
                <div class="heatmap-shift-label" style="font-size:11px">🌙</div>${data.map(d=>cell(d.cena)).join('')}
            </div>
        </div>`;
}

function renderSourcesInline(data) {
    if (!data.length) return '<p style="color:#9ca3af">Sin datos</p>';
    const total = data.reduce((s,d)=>s+d.count,0);
    const colors = { phone:'#3b82f6', whatsapp:'#22c55e', walk_in:'#8b5cf6', web:'#1a8a7d' };
    const labels = { phone:'📞 Teléfono', whatsapp:'💬 WhatsApp', walk_in:'🚶 Walk-in', web:'🌐 Web' };
    return data.sort((a,b)=>b.count-a.count).map(d => {
        const pct = total > 0 ? Math.round(d.count/total*100) : 0;
        return `<div class="report-bar" style="margin-bottom:8px">
            <div class="report-bar-label" style="width:90px;font-size:11px">${labels[d.source]||d.source}</div>
            <div class="report-bar-track">
                <div class="report-bar-fill" style="width:${Math.max(pct,4)}%;background:${colors[d.source]||'#6b7280'}">
                    <span class="report-bar-value">${d.count} · ${pct}%</span>
                </div>
            </div>
        </div>`;
    }).join('') + `<div style="text-align:right;font-size:11px;color:#9ca3af;margin-top:4px">Total: ${total}</div>`;
}

function renderTopClientsInline(data) {
    if (!data.length) return '<p style="color:#9ca3af">Sin datos</p>';
    return data.map((c, i) => `
        <div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid #f3f4f6">
            <div style="font-size:13px;font-weight:700;color:#9ca3af;width:18px">${i+1}</div>
            <div style="flex:1;min-width:0">
                <div style="font-weight:700;font-size:13px;color:#111827">${c.name} ${c.vip ? '<span class="badge badge-vip">VIP</span>' : ''}</div>
                <div style="font-size:11px;color:#9ca3af">${c.phone || ''}</div>
            </div>
            <div style="text-align:right">
                <div style="font-weight:800;color:#1a8a7d;font-size:14px">${c.visits}×</div>
                <div style="font-size:11px;color:#9ca3af">${c.total_guests}p total</div>
            </div>
        </div>`).join('');
}

// ═══════════════════════════════════════════════
// UTILIDADES
// ═══════════════════════════════════════════════

function formatDateES(iso) {
    const d = new Date(iso + 'T12:00:00');
    const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function exportReportCSV() {
    const from = document.getElementById('reportFrom')?.value || localISODate(new Date(new Date().setDate(new Date().getDate()-30)));
    const to = document.getElementById('reportTo')?.value || localISODate(new Date());
    window.open(`/api/export/reservations.csv?from=${from}&to=${to}`);
}

function _exportDateRange() {
    const today = localISODate(new Date());
    if (_reportMode === 'hoy') return { from: today, to: today };
    if (_reportMode === 'semana') {
        const f = new Date(); f.setDate(f.getDate()-6);
        return { from: localISODate(f), to: today };
    }
    if (_reportMode === 'mes') {
        const f = new Date(); f.setDate(f.getDate()-29);
        return { from: localISODate(f), to: today };
    }
    // custom
    return {
        from: document.getElementById('reportFrom')?.value || localISODate(new Date(new Date().setDate(new Date().getDate()-30))),
        to: document.getElementById('reportTo')?.value || today,
    };
}

function exportPDF() {
    // Print the current reports view
    window.print();
}

function exportExcel() {
    const { from, to } = _exportDateRange();
    window.open(`/api/export/report.xlsx?from=${from}&to=${to}`);
}

function toggleExportMenu() {
    const menu = document.getElementById('exportDropdownMenu');
    if (!menu) return;
    const isOpen = menu.style.display === 'block';
    menu.style.display = isOpen ? 'none' : 'block';
    // Close on outside click
    if (!isOpen) {
        setTimeout(() => {
            document.addEventListener('click', function handler(e) {
                if (!e.target.closest('.export-dropdown')) {
                    menu.style.display = 'none';
                }
                document.removeEventListener('click', handler);
            });
        }, 0);
    }
}

// WhatsApp test
async function sendWaTest() {
    const input = document.getElementById('waTestInput');
    const msg = input?.value.trim();
    if (!msg) return;
    const chat = document.getElementById('waChatMessages');
    if (chat) chat.innerHTML += `<div class="wa-msg wa-user">${msg}</div>`;
    if (input) input.value = '';
    try {
        const res = await apiPost('/api/whatsapp/test', { phone: '+34600000000', message: msg });
        if (chat) chat.innerHTML += `<div class="wa-msg wa-bot">${res.reply}</div>`;
    } catch (e) {
        if (chat) chat.innerHTML += `<div class="wa-msg wa-bot" style="color:#ef4444">Error</div>`;
    }
    if (chat) chat.scrollTop = chat.scrollHeight;
}

document.getElementById('waTestInput')?.addEventListener('keydown', e => { if (e.key==='Enter') sendWaTest(); });

function copyWaLink() {
    const link = document.getElementById('waLink')?.textContent;
    if (!link) return;
    navigator.clipboard.writeText(link).then(() => showToast('Enlace copiado', 'success')).catch(() => prompt('Copia:', link));
}
