from datetime import date, timedelta
from sqlalchemy import func, case, extract
from models import db, Reservation, Client, Table


def occupancy_report(from_date, to_date):
    results = db.session.query(
        Reservation.date,
        Reservation.shift,
        func.count(Reservation.id).label('reservations'),
        func.sum(Reservation.guests).label('total_guests'),
    ).filter(
        Reservation.date.between(from_date, to_date),
        Reservation.status.in_(['confirmed', 'seated', 'completed']),
    ).group_by(Reservation.date, Reservation.shift).order_by(Reservation.date).all()

    return [{
        'date': r.date.isoformat(),
        'shift': r.shift,
        'reservations': r.reservations,
        'guests': r.total_guests or 0,
        'occupancy': round((r.total_guests or 0) / 114 * 100, 1),
    } for r in results]


def popular_tables_report(from_date, to_date):
    results = db.session.query(
        Table.number,
        Table.zone,
        Table.capacity,
        func.count(Reservation.id).label('times_reserved'),
    ).join(Reservation).filter(
        Reservation.date.between(from_date, to_date),
        Reservation.status.in_(['confirmed', 'seated', 'completed']),
    ).group_by(Table.id).order_by(func.count(Reservation.id).desc()).all()

    return [{
        'table_number': r.number,
        'zone': r.zone,
        'capacity': r.capacity,
        'times_reserved': r.times_reserved,
    } for r in results]


def source_report(from_date, to_date):
    results = db.session.query(
        Reservation.source,
        func.count(Reservation.id).label('count'),
        func.sum(Reservation.guests).label('guests'),
    ).filter(
        Reservation.date.between(from_date, to_date),
    ).group_by(Reservation.source).all()

    return [{
        'source': r.source,
        'count': r.count,
        'guests': r.guests or 0,
    } for r in results]


def no_show_report(from_date, to_date):
    total = Reservation.query.filter(
        Reservation.date.between(from_date, to_date),
    ).count()

    no_shows = Reservation.query.filter(
        Reservation.date.between(from_date, to_date),
        Reservation.status == 'no_show',
    ).count()

    return {
        'total_reservations': total,
        'no_shows': no_shows,
        'rate': round(no_shows / total * 100, 1) if total else 0,
    }


def daily_summary(target_date):
    shifts = ['comida', 'cena']
    summary = {}

    for shift in shifts:
        reservations = Reservation.query.filter(
            Reservation.date == target_date,
            Reservation.shift == shift,
        ).all()

        summary[shift] = {
            'total': len(reservations),
            'guests': sum(r.guests for r in reservations),
            'confirmed': sum(1 for r in reservations if r.status == 'confirmed'),
            'seated': sum(1 for r in reservations if r.status == 'seated'),
            'completed': sum(1 for r in reservations if r.status == 'completed'),
            'cancelled': sum(1 for r in reservations if r.status == 'cancelled'),
            'no_show': sum(1 for r in reservations if r.status == 'no_show'),
            'by_source': {},
        }
        for r in reservations:
            src = r.source or 'phone'
            if src not in summary[shift]['by_source']:
                summary[shift]['by_source'][src] = 0
            summary[shift]['by_source'][src] += 1

    return summary


def weekly_trend(from_date):
    days = []
    for i in range(7):
        d = from_date + timedelta(days=i)
        reservations = Reservation.query.filter(
            Reservation.date == d,
            Reservation.status.in_(['confirmed', 'seated', 'completed']),
        ).order_by(Reservation.time).all()

        comida = [r for r in reservations if r.shift == 'comida']
        cena = [r for r in reservations if r.shift == 'cena']

        def res_list(items):
            return [{
                'id': r.id,
                'client_name': r.client_name,
                'time': r.time,
                'guests': r.guests,
                'table_number': r.table.number if r.table else None,
                'status': r.status,
                'source': r.source,
                'notes': r.notes or '',
            } for r in items]

        days.append({
            'date': d.isoformat(),
            'day_name': d.strftime('%A'),
            'reservations': len(reservations),
            'guests': sum(r.guests for r in reservations),
            'comida': {'count': len(comida), 'guests': sum(r.guests for r in comida), 'items': res_list(comida)},
            'cena': {'count': len(cena), 'guests': sum(r.guests for r in cena), 'items': res_list(cena)},
        })
    return days


def client_frequency_report(from_date, to_date, limit=30):
    results = db.session.query(
        Client.id,
        Client.name,
        Client.phone,
        Client.vip,
        func.count(Reservation.id).label('visits'),
        func.sum(Reservation.guests).label('total_guests'),
        func.max(Reservation.date).label('last_visit'),
    ).join(Reservation).filter(
        Reservation.date.between(from_date, to_date),
        Reservation.status == 'completed',
    ).group_by(Client.id).order_by(func.count(Reservation.id).desc()).limit(limit).all()

    return [{
        'client_id': r.id,
        'name': r.name,
        'phone': r.phone,
        'vip': r.vip,
        'visits': r.visits,
        'total_guests': r.total_guests or 0,
        'last_visit': r.last_visit.isoformat() if r.last_visit else None,
    } for r in results]


def zone_performance(from_date, to_date):
    results = db.session.query(
        Table.zone,
        func.count(Reservation.id).label('reservations'),
        func.sum(Reservation.guests).label('guests'),
    ).join(Reservation).filter(
        Reservation.date.between(from_date, to_date),
        Reservation.status.in_(['confirmed', 'seated', 'completed']),
    ).group_by(Table.zone).all()

    zone_caps = {'exterior': 20, 'salon_principal': 70, 'salon_interior': 24}
    return [{
        'zone': r.zone,
        'reservations': r.reservations,
        'guests': r.guests or 0,
        'zone_capacity': zone_caps.get(r.zone, 0),
    } for r in results]


def hourly_distribution(from_date, to_date):
    reservations = Reservation.query.filter(
        Reservation.date.between(from_date, to_date),
        Reservation.status.in_(['confirmed', 'seated', 'completed']),
    ).all()

    hours = {}
    for r in reservations:
        hour = r.time[:2] + ':00' if r.time else 'unknown'
        key = f"{r.shift}_{hour}"
        if key not in hours:
            hours[key] = {'shift': r.shift, 'hour': hour, 'count': 0, 'guests': 0}
        hours[key]['count'] += 1
        hours[key]['guests'] += r.guests

    return sorted(hours.values(), key=lambda x: (x['shift'], x['hour']))


def kpi_summary(from_date, to_date):
    """Main KPIs with comparison to previous period of same length."""
    delta = max((to_date - from_date).days + 1, 1)
    prev_from = from_date - timedelta(days=delta)
    prev_to = from_date - timedelta(days=1)

    def get_metrics(f, t):
        reservations = Reservation.query.filter(
            Reservation.date.between(f, t)
        ).all()
        active = [r for r in reservations if r.status in ['confirmed', 'seated', 'completed']]
        no_shows = sum(1 for r in reservations if r.status == 'no_show')
        total = len(reservations)
        guests = sum(r.guests for r in active)
        avg_guests = round(guests / len(active), 1) if active else 0
        no_show_rate = round(no_shows / total * 100, 1) if total else 0
        occupancy_avg = round(guests / 114 / delta * 100, 1)
        return {
            'total': total,
            'guests': guests,
            'no_shows': no_shows,
            'no_show_rate': no_show_rate,
            'avg_guests': avg_guests,
            'occupancy_avg': occupancy_avg,
            'completed': sum(1 for r in reservations if r.status == 'completed'),
            'cancelled': sum(1 for r in reservations if r.status == 'cancelled'),
        }

    curr = get_metrics(from_date, to_date)
    prev = get_metrics(prev_from, prev_to)

    def change(c, p):
        if p == 0:
            return None
        return round((c - p) / p * 100, 1)

    return {
        'period': {'from': from_date.isoformat(), 'to': to_date.isoformat(), 'days': delta},
        'current': curr,
        'previous': prev,
        'changes': {
            'total': change(curr['total'], prev['total']),
            'guests': change(curr['guests'], prev['guests']),
            'no_show_rate': change(curr['no_show_rate'], prev['no_show_rate']),
            'occupancy_avg': change(curr['occupancy_avg'], prev['occupancy_avg']),
        },
    }


def heatmap_report(from_date, to_date):
    """Returns reservation counts per day-of-week × shift."""
    matrix = {i: {'comida': 0, 'cena': 0} for i in range(7)}

    results = db.session.query(
        extract('dow', Reservation.date).label('dow'),
        Reservation.shift,
        func.count(Reservation.id).label('count'),
    ).filter(
        Reservation.date.between(from_date, to_date),
        Reservation.status.in_(['confirmed', 'seated', 'completed']),
    ).group_by('dow', Reservation.shift).all()

    for r in results:
        # PostgreSQL dow: 0=Sunday … 6=Saturday → convert to Mon=0 … Sun=6
        dow = int(r.dow)
        mon_first = (dow + 6) % 7
        if mon_first in matrix and r.shift in ('comida', 'cena'):
            matrix[mon_first][r.shift] = r.count

    days = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
    return [{'day': days[i], 'comida': matrix[i]['comida'], 'cena': matrix[i]['cena']} for i in range(7)]


def weekly_occupancy(from_date, to_date):
    """Week-by-week occupancy for trend chart."""
    results = db.session.query(
        Reservation.date,
        func.count(Reservation.id).label('reservations'),
        func.sum(Reservation.guests).label('guests'),
    ).filter(
        Reservation.date.between(from_date, to_date),
        Reservation.status.in_(['confirmed', 'seated', 'completed']),
    ).group_by(Reservation.date).order_by(Reservation.date).all()

    return [{
        'date': r.date.isoformat(),
        'reservations': r.reservations,
        'guests': r.guests or 0,
        'occupancy': round((r.guests or 0) / 114 * 100, 1),
    } for r in results]
