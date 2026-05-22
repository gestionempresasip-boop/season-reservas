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
