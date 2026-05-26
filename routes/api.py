"""
REST API for Season restaurant reservation system.
"""
import csv
import io
from flask import Blueprint, request, jsonify, current_app, Response
from datetime import date, timedelta
from services import reservation as res_svc
from services import client as cli_svc
from services import reports as rpt_svc
from models import db, Reservation, Waitlist, Table
from utils.validators import ReservationCreate, ReservationUpdate, ClientCreate, ClientUpdate
from utils.decorators import validate_and_handle, handle_errors
from utils.errors import error_response, success_response

api = Blueprint('api', __name__, url_prefix='/api')


def notify():
    from app import broadcast_update, cache_invalidate
    cache_invalidate()  # Clear cache when data changes
    broadcast_update()


# ── Reservations ──────────────────────────────────────────

@api.route('/reservations', methods=['GET'])
def list_reservations():
    d = request.args.get('date', date.today().isoformat())
    shift = request.args.get('shift', 'comida')
    show_all = request.args.get('all', 'false') == 'true'
    target = date.fromisoformat(d)
    if show_all:
        items = res_svc.get_all_reservations_for_date(target, shift)
    else:
        items = res_svc.get_reservations(target, shift)
    return jsonify([r.to_dict() for r in items])


@api.route('/reservations', methods=['POST'])
@validate_and_handle(ReservationCreate)
def create_reservation(data: ReservationCreate):
    """Create a new reservation.

    Request body:
        - date: YYYY-MM-DD
        - shift: 'comida' or 'cena'
        - time: HH:MM
        - guests: 1-14
        - client_name: string
        - client_phone: string
        - email: (optional) string
        - notes: (optional) string
    """
    # Convert Pydantic model to dict for service (mode='json' ensures date → ISO string)
    reservation_data = data.model_dump(mode='json')
    r = res_svc.create_reservation(reservation_data)
    notify()
    return jsonify(r.to_dict()), 201


@api.route('/reservations/<int:rid>', methods=['PUT'])
@handle_errors
def update_reservation(rid):
    """Update an existing reservation.

    Only provided fields are updated.
    """
    if not request.is_json:
        return error_response('Content-Type must be application/json', 400)

    # Validate with partial schema (all fields optional)
    try:
        data = ReservationUpdate(**request.json)
        update_dict = data.model_dump(mode='json', exclude_unset=True)
    except Exception as e:
        return error_response(f'Validación fallida: {str(e)}', 400)

    r = res_svc.update_reservation(rid, update_dict)
    notify()
    return jsonify(r.to_dict())


@api.route('/reservations/<int:rid>', methods=['DELETE'])
@handle_errors
def cancel_reservation(rid):
    """Cancel a reservation (mark as cancelled)."""
    r = res_svc.cancel_reservation(rid)
    notify()
    return jsonify(r.to_dict())


@api.route('/reservations/<int:rid>/delete', methods=['DELETE'])
@handle_errors
def delete_reservation(rid):
    """Permanently delete a reservation (hard delete)."""
    r = Reservation.query.get_or_404(rid)
    db.session.delete(r)
    db.session.commit()
    notify()
    return jsonify({'deleted': rid})


@api.route('/reservations/<int:rid>/seat', methods=['PUT'])
@handle_errors
def seat_reservation(rid):
    """Mark reservation as seated (optionally assign table)."""
    table_id = None
    if request.is_json:
        table_id = request.json.get('table_id')

    r = res_svc.seat_reservation(rid, table_id)
    notify()
    return jsonify(r.to_dict())


@api.route('/reservations/<int:rid>/complete', methods=['PUT'])
@handle_errors
def complete_reservation(rid):
    """Mark reservation as completed."""
    r = res_svc.complete_reservation(rid)
    notify()
    return jsonify(r.to_dict())


@api.route('/reservations/<int:rid>/noshow', methods=['PUT'])
@handle_errors
def mark_no_show(rid):
    """Mark reservation as no-show."""
    r = res_svc.mark_no_show(rid)
    notify()
    return jsonify(r.to_dict())


# ── Tables ────────────────────────────────────────────────

@api.route('/tables', methods=['GET'])
def list_tables():
    tables = Table.query.filter_by(active=True).order_by(Table.zone, Table.number).all()
    return jsonify([t.to_dict() for t in tables])


@api.route('/tables/status', methods=['GET'])
def table_status():
    from app import cache_get, cache_set
    d = request.args.get('date', date.today().isoformat())
    shift = request.args.get('shift', 'comida')
    cache_key = f'tables_status:{d}:{shift}'
    cached = cache_get(cache_key)
    if cached:
        return jsonify(cached)
    target = date.fromisoformat(d)
    result = res_svc.get_table_status(target, shift)
    cache_set(cache_key, result)
    return jsonify(result)


@api.route('/tables/available', methods=['GET'])
def available_tables():
    d = request.args.get('date', date.today().isoformat())
    shift = request.args.get('shift', 'comida')
    guests = int(request.args.get('guests', 2))
    time_str = request.args.get('time')
    duration = int(request.args.get('duration', 120))
    exclude_id = request.args.get('exclude_reservation_id', type=int)
    target = date.fromisoformat(d)
    tables = res_svc.find_available_tables(target, shift, guests, time_str, duration, exclude_id)
    return jsonify([t.to_dict() for t in tables])


@api.route('/tables/check-conflict', methods=['POST'])
@handle_errors
def check_table_conflict():
    """Check if a set of tables is available at a given time. Used by frontend before submit.

    Body: {date, shift, time, duration_minutes, table_ids, exclude_reservation_id}
    Returns: {conflicts: [...], available: bool}
    """
    data = request.json or {}
    target = date.fromisoformat(data.get('date'))
    conflicts = res_svc.check_table_conflicts(
        target,
        data.get('shift'),
        data.get('time'),
        int(data.get('duration_minutes', 120) or 120),
        data.get('table_ids', []),
        data.get('exclude_reservation_id'),
    )
    return jsonify({
        'available': len(conflicts) == 0,
        'conflicts': conflicts,
    })


# ── Stats ─────────────────────────────────────────────────

@api.route('/stats', methods=['GET'])
def shift_stats():
    d = request.args.get('date', date.today().isoformat())
    shift = request.args.get('shift', 'comida')
    target = date.fromisoformat(d)
    stats = res_svc.get_shift_stats(target, shift)
    return jsonify(stats)


@api.route('/quick-status', methods=['GET'])
def quick_status():
    """Ultra-light: only stats, cached 3s. For mobile quick updates."""
    from app import cache_get, cache_set
    d = request.args.get('date', date.today().isoformat())
    shift = request.args.get('shift', 'comida')
    cache_key = f'stats:{d}:{shift}'

    cached = cache_get(cache_key, max_age=3)
    if cached:
        return jsonify(cached)

    target = date.fromisoformat(d)
    stats = res_svc.get_shift_stats(target, shift)
    cache_set(cache_key, stats)
    return jsonify(stats)


@api.route('/dashboard', methods=['GET'])
def dashboard():
    """Single endpoint: stats + table status + reservations in one call (cached 2s)."""
    from app import cache_get, cache_set
    d = request.args.get('date', date.today().isoformat())
    shift = request.args.get('shift', 'comida')
    cache_key = f'dashboard:{d}:{shift}'

    cached = cache_get(cache_key, max_age=2)
    if cached:
        return jsonify(cached)

    target = date.fromisoformat(d)
    stats = res_svc.get_shift_stats(target, shift)
    tables = res_svc.get_table_status(target, shift)
    reservations = [r.to_dict() for r in res_svc.get_all_reservations_for_date(target, shift)]

    # Slim down table data for mobile (only essential fields)
    slim_tables = [
        {'id': t['id'], 'number': t['number'], 'status': t['status'], 'reservation': t.get('reservation')}
        for t in tables
    ]

    result = {
        'stats': stats,
        'tables': slim_tables,
        'reservations': reservations,
    }
    cache_set(cache_key, result)
    return jsonify(result)


# ── Clients ───────────────────────────────────────────────

@api.route('/clients', methods=['GET'])
@handle_errors
def list_clients():
    """Search clients by name, phone, or email."""
    q = request.args.get('search', '')
    clients = cli_svc.search_clients(q)
    return jsonify([c.to_dict() for c in clients])


@api.route('/clients/<int:cid>', methods=['GET'])
@handle_errors
def get_client(cid):
    """Get client details with reservation history."""
    c = cli_svc.get_client(cid)
    history = cli_svc.get_client_history(cid)
    return jsonify({
        **c.to_dict(),
        'history': [r.to_dict() for r in history],
    })


@api.route('/clients', methods=['POST'])
@validate_and_handle(ClientCreate)
def create_client(data: ClientCreate):
    """Create a new client."""
    c = cli_svc.create_client(data.dict())
    return jsonify(c.to_dict()), 201


@api.route('/clients/<int:cid>', methods=['PUT'])
@handle_errors
def update_client(cid):
    """Update an existing client."""
    if not request.is_json:
        return error_response('Content-Type must be application/json', 400)

    try:
        data = ClientUpdate(**request.json)
        update_dict = data.dict(exclude_unset=True)
    except Exception as e:
        return error_response(f'Validación fallida: {str(e)}', 400)

    c = cli_svc.update_client(cid, update_dict)
    return jsonify(c.to_dict())


@api.route('/clients/<int:cid>', methods=['DELETE'])
@handle_errors
def delete_client(cid):
    """Delete a client (detach reservations)."""
    cli_svc.delete_client(cid)
    return jsonify({'status': 'deleted'})


@api.route('/clients/top', methods=['GET'])
def top_clients():
    limit = int(request.args.get('limit', 20))
    return jsonify(cli_svc.get_top_clients(limit))


# ── Waitlist ──────────────────────────────────────────────

@api.route('/waitlist', methods=['GET'])
def list_waitlist():
    d = request.args.get('date', date.today().isoformat())
    shift = request.args.get('shift', 'comida')
    items = Waitlist.query.filter(
        Waitlist.date == date.fromisoformat(d),
        Waitlist.shift == shift,
        Waitlist.status == 'waiting',
    ).order_by(Waitlist.created_at).all()
    return jsonify([w.to_dict() for w in items])


@api.route('/waitlist', methods=['POST'])
def add_to_waitlist():
    data = request.json
    w = Waitlist(
        client_name=data['client_name'],
        phone=data.get('phone', ''),
        guests=int(data['guests']),
        date=date.fromisoformat(data['date']),
        shift=data['shift'],
        notes=data.get('notes', ''),
    )
    db.session.add(w)
    db.session.commit()
    notify()
    return jsonify(w.to_dict()), 201


@api.route('/waitlist/<int:wid>/seat', methods=['PUT'])
def seat_from_waitlist(wid):
    w = Waitlist.query.get_or_404(wid)
    data = request.json or {}
    r = res_svc.create_reservation({
        'client_name': w.client_name,
        'client_phone': w.phone,
        'date': w.date.isoformat(),
        'shift': w.shift,
        'time': data.get('time', ''),
        'guests': w.guests,
        'table_id': data.get('table_id'),
        'source': 'walk_in',
        'notes': w.notes,
    })
    w.status = 'seated'
    db.session.commit()
    notify()
    return jsonify(r.to_dict()), 201


@api.route('/waitlist/<int:wid>/cancel', methods=['PUT'])
def cancel_waitlist(wid):
    w = Waitlist.query.get_or_404(wid)
    w.status = 'cancelled'
    db.session.commit()
    notify()
    return jsonify(w.to_dict())


# ── Config / WhatsApp ─────────────────────────────────────

@api.route('/config/whatsapp', methods=['GET'])
def whatsapp_config():
    return jsonify({
        'number': current_app.config['WHATSAPP_NUMBER'],
        'link': f"https://wa.me/{current_app.config['WHATSAPP_NUMBER']}?text=RESERVAR",
    })


# ── Reports ───────────────────────────────────────────────

@api.route('/reports/occupancy', methods=['GET'])
def report_occupancy():
    from_d = request.args.get('from', (date.today() - timedelta(days=30)).isoformat())
    to_d = request.args.get('to', date.today().isoformat())
    return jsonify(rpt_svc.occupancy_report(date.fromisoformat(from_d), date.fromisoformat(to_d)))


@api.route('/reports/popular-tables', methods=['GET'])
def report_popular_tables():
    from_d = request.args.get('from', (date.today() - timedelta(days=30)).isoformat())
    to_d = request.args.get('to', date.today().isoformat())
    return jsonify(rpt_svc.popular_tables_report(date.fromisoformat(from_d), date.fromisoformat(to_d)))


@api.route('/reports/sources', methods=['GET'])
def report_sources():
    from_d = request.args.get('from', (date.today() - timedelta(days=30)).isoformat())
    to_d = request.args.get('to', date.today().isoformat())
    return jsonify(rpt_svc.source_report(date.fromisoformat(from_d), date.fromisoformat(to_d)))


@api.route('/reports/no-shows', methods=['GET'])
def report_no_shows():
    from_d = request.args.get('from', (date.today() - timedelta(days=30)).isoformat())
    to_d = request.args.get('to', date.today().isoformat())
    return jsonify(rpt_svc.no_show_report(date.fromisoformat(from_d), date.fromisoformat(to_d)))


@api.route('/reports/summary', methods=['GET'])
def report_summary():
    d = request.args.get('date', date.today().isoformat())
    return jsonify(rpt_svc.daily_summary(date.fromisoformat(d)))


@api.route('/reports/weekly', methods=['GET'])
def report_weekly():
    from_d = request.args.get('from', date.today().isoformat())
    return jsonify(rpt_svc.weekly_trend(date.fromisoformat(from_d)))


@api.route('/reports/clients', methods=['GET'])
def report_clients():
    from_d = request.args.get('from', (date.today() - timedelta(days=30)).isoformat())
    to_d = request.args.get('to', date.today().isoformat())
    limit = int(request.args.get('limit', 30))
    return jsonify(rpt_svc.client_frequency_report(date.fromisoformat(from_d), date.fromisoformat(to_d), limit))


@api.route('/reports/zones', methods=['GET'])
def report_zones():
    from_d = request.args.get('from', (date.today() - timedelta(days=30)).isoformat())
    to_d = request.args.get('to', date.today().isoformat())
    return jsonify(rpt_svc.zone_performance(date.fromisoformat(from_d), date.fromisoformat(to_d)))


@api.route('/reports/hours', methods=['GET'])
def report_hours():
    from_d = request.args.get('from', (date.today() - timedelta(days=30)).isoformat())
    to_d = request.args.get('to', date.today().isoformat())
    return jsonify(rpt_svc.hourly_distribution(date.fromisoformat(from_d), date.fromisoformat(to_d)))


# ═══════════════════════════════════════════════════════════════════════════
# GLOBAL SEARCH (across all dates)
# ═══════════════════════════════════════════════════════════════════════════

@api.route('/search/reservations', methods=['GET'])
@handle_errors
def search_reservations():
    """Search reservations across all dates by name/phone/notes."""
    q = request.args.get('q', '').strip()
    limit = int(request.args.get('limit', 50))
    if len(q) < 2:
        return jsonify([])
    results = res_svc.global_search_reservations(q, limit)
    return jsonify([r.to_dict() for r in results])


# ═══════════════════════════════════════════════════════════════════════════
# EXPORT CSV
# ═══════════════════════════════════════════════════════════════════════════

@api.route('/export/reservations.csv', methods=['GET'])
def export_reservations_csv():
    """Export reservations between two dates as CSV (Excel-compatible)."""
    from_d = request.args.get('from', date.today().isoformat())
    to_d = request.args.get('to', date.today().isoformat())
    from_date = date.fromisoformat(from_d)
    to_date = date.fromisoformat(to_d)

    items = Reservation.query.filter(
        Reservation.date >= from_date,
        Reservation.date <= to_date,
    ).order_by(Reservation.date, Reservation.time).all()

    output = io.StringIO()
    writer = csv.writer(output, delimiter=';', quoting=csv.QUOTE_MINIMAL)
    writer.writerow([
        'ID', 'Fecha', 'Turno', 'Hora', 'Cliente', 'Telefono',
        'Comensales', 'Mesas', 'Estado', 'Origen', 'Duracion(min)', 'Notas', 'Creada'
    ])
    for r in items:
        nums = r.all_table_numbers()
        tables_str = ' + '.join(str(n) for n in nums) if nums else ''
        writer.writerow([
            r.id, r.date.isoformat(), r.shift, r.time,
            r.client_name, r.client_phone, r.guests, tables_str,
            r.status, r.source, r.duration_minutes or 120,
            (r.notes or '').replace('\n', ' '),
            r.created_at.isoformat() if r.created_at else ''
        ])

    csv_data = '﻿' + output.getvalue()  # BOM for Excel UTF-8
    output.close()

    return Response(
        csv_data,
        mimetype='text/csv; charset=utf-8',
        headers={
            'Content-Disposition': f'attachment; filename=reservas_{from_d}_a_{to_d}.csv'
        }
    )


# ═══════════════════════════════════════════════════════════════════════════
# DRAG-DROP: ASSIGN RESERVATION TO TABLE(S)
# ═══════════════════════════════════════════════════════════════════════════

@api.route('/reservations/<int:rid>/assign-tables', methods=['PUT'])
@handle_errors
def assign_tables(rid):
    """Quickly assign one or more tables to a reservation (drag-drop).

    Body: {table_ids: [1,2]} or {table_id: 1}
    """
    data = request.json or {}
    r = res_svc.update_reservation(rid, {
        'table_ids': data.get('table_ids') if 'table_ids' in data else None,
        'table_id': data.get('table_id') if 'table_id' in data else None,
    })
    notify()
    return jsonify(r.to_dict())


@api.route('/reservations/<int:rid>/unassign', methods=['PUT'])
@handle_errors
def unassign_tables(rid):
    """Remove all table assignments from a reservation."""
    r = res_svc.update_reservation(rid, {'table_ids': []})
    notify()
    return jsonify(r.to_dict())
