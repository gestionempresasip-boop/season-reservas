from flask import Blueprint, request, jsonify, current_app
from datetime import date, timedelta
from services import reservation as res_svc
from services import client as cli_svc
from services import reports as rpt_svc
from models import db, Reservation, Waitlist, Table

api = Blueprint('api', __name__, url_prefix='/api')


def notify():
    from app import broadcast_update
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
def create_reservation():
    data = request.json
    try:
        r = res_svc.create_reservation(data)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    notify()
    return jsonify(r.to_dict()), 201


@api.route('/reservations/<int:rid>', methods=['PUT'])
def update_reservation(rid):
    data = request.json
    r = res_svc.update_reservation(rid, data)
    notify()
    return jsonify(r.to_dict())


@api.route('/reservations/<int:rid>', methods=['DELETE'])
def cancel_reservation(rid):
    r = res_svc.cancel_reservation(rid)
    notify()
    return jsonify(r.to_dict())


@api.route('/reservations/<int:rid>/delete', methods=['DELETE'])
def delete_reservation(rid):
    r = Reservation.query.get_or_404(rid)
    db.session.delete(r)
    db.session.commit()
    notify()
    return jsonify({'deleted': rid})


@api.route('/reservations/<int:rid>/seat', methods=['PUT'])
def seat_reservation(rid):
    table_id = request.json.get('table_id') if request.json else None
    r = res_svc.seat_reservation(rid, table_id)
    notify()
    return jsonify(r.to_dict())


@api.route('/reservations/<int:rid>/complete', methods=['PUT'])
def complete_reservation(rid):
    r = res_svc.complete_reservation(rid)
    notify()
    return jsonify(r.to_dict())


@api.route('/reservations/<int:rid>/noshow', methods=['PUT'])
def mark_no_show(rid):
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
    target = date.fromisoformat(d)
    tables = res_svc.find_available_tables(target, shift, guests)
    return jsonify([t.to_dict() for t in tables])


# ── Stats ─────────────────────────────────────────────────

@api.route('/stats', methods=['GET'])
def shift_stats():
    d = request.args.get('date', date.today().isoformat())
    shift = request.args.get('shift', 'comida')
    target = date.fromisoformat(d)
    stats = res_svc.get_shift_stats(target, shift)
    return jsonify(stats)


@api.route('/dashboard', methods=['GET'])
def dashboard():
    """Single endpoint: stats + table status + reservations in one call."""
    from app import cache_get, cache_set
    d = request.args.get('date', date.today().isoformat())
    shift = request.args.get('shift', 'comida')
    cache_key = f'dashboard:{d}:{shift}'

    cached = cache_get(cache_key)
    if cached:
        return jsonify(cached)

    target = date.fromisoformat(d)
    stats = res_svc.get_shift_stats(target, shift)
    tables = res_svc.get_table_status(target, shift)
    reservations = [r.to_dict() for r in res_svc.get_all_reservations_for_date(target, shift)]
    result = {
        'stats': stats,
        'tables': tables,
        'reservations': reservations,
    }
    cache_set(cache_key, result)
    return jsonify(result)


# ── Clients ───────────────────────────────────────────────

@api.route('/clients', methods=['GET'])
def list_clients():
    q = request.args.get('search', '')
    clients = cli_svc.search_clients(q)
    return jsonify([c.to_dict(include_stats=True) for c in clients])


@api.route('/clients/<int:cid>', methods=['GET'])
def get_client(cid):
    c = cli_svc.get_client(cid)
    history = cli_svc.get_client_history(cid)
    return jsonify({
        **c.to_dict(include_stats=True),
        'history': [r.to_dict() for r in history],
    })


@api.route('/clients', methods=['POST'])
def create_client():
    c = cli_svc.create_client(request.json)
    return jsonify(c.to_dict()), 201


@api.route('/clients/<int:cid>', methods=['PUT'])
def update_client(cid):
    c = cli_svc.update_client(cid, request.json)
    return jsonify(c.to_dict())


@api.route('/clients/<int:cid>', methods=['DELETE'])
def delete_client(cid):
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
