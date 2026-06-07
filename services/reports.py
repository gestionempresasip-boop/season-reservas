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
    """Day-by-day occupancy for trend chart, split by shift."""
    results = db.session.query(
        Reservation.date,
        Reservation.shift,
        func.count(Reservation.id).label('reservations'),
        func.sum(Reservation.guests).label('guests'),
    ).filter(
        Reservation.date.between(from_date, to_date),
        Reservation.status.in_(['confirmed', 'seated', 'completed']),
    ).group_by(Reservation.date, Reservation.shift).order_by(Reservation.date).all()

    # Merge into per-day dict
    days = {}
    for r in results:
        key = r.date.isoformat()
        if key not in days:
            days[key] = {'date': key, 'reservations': 0, 'guests': 0, 'comida': 0, 'cena': 0}
        days[key]['reservations'] += r.reservations
        days[key]['guests'] += r.guests or 0
        days[key][r.shift] = r.guests or 0

    return [{**d, 'occupancy': round(d['guests'] / 114 * 100, 1)} for d in sorted(days.values(), key=lambda x: x['date'])]


def new_vs_returning(from_date, to_date):
    """Count new clients (first reservation ever) vs returning in the period."""
    # Clients with reservations in this period
    period_clients = db.session.query(
        Reservation.client_id,
    ).filter(
        Reservation.date.between(from_date, to_date),
        Reservation.status.in_(['confirmed', 'seated', 'completed']),
        Reservation.client_id.isnot(None),
    ).distinct().all()

    period_ids = {r.client_id for r in period_clients}
    new_count = 0
    returning_count = 0

    for cid in period_ids:
        # Check if they had any reservation BEFORE this period
        prior = Reservation.query.filter(
            Reservation.client_id == cid,
            Reservation.date < from_date,
            Reservation.status.in_(['confirmed', 'seated', 'completed']),
        ).first()
        if prior:
            returning_count += 1
        else:
            new_count += 1

    # Walk-ins (no client_id) — always "new"
    walkins = db.session.query(func.count(Reservation.id)).filter(
        Reservation.date.between(from_date, to_date),
        Reservation.status.in_(['confirmed', 'seated', 'completed']),
        Reservation.client_id.is_(None),
    ).scalar() or 0

    total = new_count + returning_count + walkins
    return {
        'new': new_count + walkins,
        'returning': returning_count,
        'total': total,
        'returning_rate': round(returning_count / total * 100, 1) if total else 0,
    }


def weekly_comparison(target_monday):
    """Current week vs previous week, day by day."""
    from datetime import timedelta
    week_end = target_monday + timedelta(days=6)
    prev_start = target_monday - timedelta(days=7)
    prev_end = target_monday - timedelta(days=1)

    def week_data(start, end):
        results = db.session.query(
            Reservation.date,
            Reservation.shift,
            func.count(Reservation.id).label('reservations'),
            func.sum(Reservation.guests).label('guests'),
            func.sum(case((Reservation.status == 'no_show', 1), else_=0)).label('no_shows'),
        ).filter(
            Reservation.date.between(start, end),
        ).group_by(Reservation.date, Reservation.shift).all()

        days = {}
        for r in results:
            key = r.date.isoformat()
            if key not in days:
                days[key] = {'date': key, 'reservations': 0, 'guests': 0, 'no_shows': 0, 'comida_guests': 0, 'cena_guests': 0}
            days[key]['reservations'] += r.reservations
            days[key]['guests'] += r.guests or 0
            days[key]['no_shows'] += r.no_shows or 0
            days[key][f'{r.shift}_guests'] = (days[key].get(f'{r.shift}_guests', 0) + (r.guests or 0))

        total_res = sum(d['reservations'] for d in days.values())
        total_guests = sum(d['guests'] for d in days.values())
        total_noshows = sum(d['no_shows'] for d in days.values())
        return {
            'days': sorted(days.values(), key=lambda x: x['date']),
            'totals': {
                'reservations': total_res,
                'guests': total_guests,
                'no_shows': total_noshows,
                'no_show_rate': round(total_noshows / total_res * 100, 1) if total_res else 0,
                'occupancy_avg': round(total_guests / 114 / 7 * 100, 1),
            }
        }

    curr = week_data(target_monday, week_end)
    prev = week_data(prev_start, prev_end)

    def chg(c, p):
        if p == 0: return None
        return round((c - p) / p * 100, 1)

    curr['changes'] = {
        'reservations': chg(curr['totals']['reservations'], prev['totals']['reservations']),
        'guests': chg(curr['totals']['guests'], prev['totals']['guests']),
        'no_show_rate': chg(curr['totals']['no_show_rate'], prev['totals']['no_show_rate']),
        'occupancy_avg': chg(curr['totals']['occupancy_avg'], prev['totals']['occupancy_avg']),
    }
    curr['prev_totals'] = prev['totals']
    curr['period'] = {'from': target_monday.isoformat(), 'to': week_end.isoformat()}
    return curr
