"""
Reservation service - business logic for reservations.
"""
from datetime import date, datetime
from models import db, Reservation, Table, Client
from sqlalchemy import func


def get_reservations(target_date, shift):
    """Get confirmed and seated reservations for a date and shift.

    Args:
        target_date: Date object
        shift: 'comida' or 'cena'

    Returns:
        List of Reservation objects
    """
    return Reservation.query.filter(
        Reservation.date == target_date,
        Reservation.shift == shift,
        Reservation.status.in_(['confirmed', 'seated'])
    ).order_by(Reservation.time).all()


def get_all_reservations_for_date(target_date, shift):
    """Get ALL reservations for a date and shift (all statuses).

    Args:
        target_date: Date object
        shift: 'comida' or 'cena'

    Returns:
        List of Reservation objects (confirmed, seated, cancelled, no_show, completed)
    """
    return Reservation.query.filter(
        Reservation.date == target_date,
        Reservation.shift == shift,
    ).order_by(Reservation.time).all()


def create_reservation(data):
    """Create a new reservation.

    Args:
        data: Dictionary with reservation details (date, shift, time, guests, client_name, etc.)

    Returns:
        Reservation object

    Raises:
        ValueError: If date is in the past or time has already passed
    """
    # Validate date is not in the past
    res_date = date.fromisoformat(data['date'])
    today = date.today()
    if res_date < today:
        raise ValueError('No se pueden crear reservas en fechas pasadas')

    # Validar hora no sea pasada si es hoy
    if res_date == today and data.get('time'):
        now = datetime.now()
        parts = data['time'].split(':')
        res_hour, res_min = int(parts[0]), int(parts[1]) if len(parts) > 1 else 0
        res_minutes = res_hour * 60 + res_min
        now_minutes = now.hour * 60 + now.minute
        # Margen de 15 minutos
        if res_minutes < now_minutes - 15:
            raise ValueError('La hora de la reserva ya ha pasado')

    client = None
    phone = data.get('client_phone', '').strip()
    if phone:
        client = Client.query.filter_by(phone=phone).first()
        if not client:
            client = Client(
                name=data['client_name'],
                phone=phone,
                email=data.get('email', ''),
            )
            db.session.add(client)
            db.session.flush()

    reservation = Reservation(
        client_id=client.id if client else None,
        table_id=data.get('table_id'),
        date=res_date,
        shift=data['shift'],
        time=data['time'],
        guests=int(data['guests']),
        client_name=data['client_name'],
        client_phone=phone,
        status='confirmed',
        source=data.get('source', 'phone'),
        notes=data.get('notes', ''),
    )
    db.session.add(reservation)
    db.session.commit()
    return reservation


def update_reservation(reservation_id, data):
    reservation = Reservation.query.get_or_404(reservation_id)

    if 'table_id' in data:
        reservation.table_id = data['table_id']
    if 'time' in data:
        reservation.time = data['time']
    if 'guests' in data:
        reservation.guests = int(data['guests'])
    if 'status' in data:
        reservation.status = data['status']
    if 'notes' in data:
        reservation.notes = data['notes']
    if 'client_name' in data:
        reservation.client_name = data['client_name']
    if 'client_phone' in data:
        reservation.client_phone = data['client_phone']
    if 'date' in data:
        reservation.date = date.fromisoformat(data['date'])
    if 'shift' in data:
        reservation.shift = data['shift']

    db.session.commit()
    return reservation


def cancel_reservation(reservation_id):
    reservation = Reservation.query.get_or_404(reservation_id)
    reservation.status = 'cancelled'
    db.session.commit()
    return reservation


def seat_reservation(reservation_id, table_id=None):
    reservation = Reservation.query.get_or_404(reservation_id)
    reservation.status = 'seated'
    if table_id:
        reservation.table_id = table_id
    db.session.commit()
    return reservation


def complete_reservation(reservation_id):
    reservation = Reservation.query.get_or_404(reservation_id)
    reservation.status = 'completed'
    db.session.commit()
    return reservation


def mark_no_show(reservation_id):
    reservation = Reservation.query.get_or_404(reservation_id)
    reservation.status = 'no_show'
    db.session.commit()
    return reservation


def get_table_status(target_date, shift):
    tables = Table.query.filter_by(active=True).all()
    reservations = Reservation.query.filter(
        Reservation.date == target_date,
        Reservation.shift == shift,
        Reservation.status.in_(['confirmed', 'seated'])
    ).all()

    reserved_table_ids = {}
    for r in reservations:
        if r.table_id:
            reserved_table_ids[r.table_id] = r

    result = []
    for t in tables:
        r = reserved_table_ids.get(t.id)
        status = 'free'
        reservation_data = None
        if r:
            status = r.status
            reservation_data = r.to_dict()

        result.append({
            **t.to_dict(),
            'status': status,
            'reservation': reservation_data,
        })

    return result


def find_available_tables(target_date, shift, guests):
    occupied_ids = db.session.query(Reservation.table_id).filter(
        Reservation.date == target_date,
        Reservation.shift == shift,
        Reservation.status.in_(['confirmed', 'seated']),
        Reservation.table_id.isnot(None),
    ).subquery()

    available = Table.query.filter(
        Table.active == True,
        Table.capacity >= guests,
        ~Table.id.in_(occupied_ids),
    ).order_by(Table.capacity, Table.zone).all()

    return available


def get_shift_stats(target_date, shift):
    """Get statistics for a shift (counts and occupancy).

    Uses database aggregations for efficiency.

    Args:
        target_date: Date object
        shift: 'comida' or 'cena'

    Returns:
        Dictionary with reservations count, guests, occupancy %, etc.
    """
    from config.settings import MAX_CAPACITY

    # Query counts using database aggregation (more efficient)
    total_reservations = Reservation.query.filter(
        Reservation.date == target_date,
        Reservation.shift == shift,
        Reservation.status.in_(['confirmed', 'seated', 'completed'])
    ).count()

    total_guests = db.session.query(func.sum(Reservation.guests)).filter(
        Reservation.date == target_date,
        Reservation.shift == shift,
        Reservation.status.in_(['confirmed', 'seated', 'completed'])
    ).scalar() or 0

    seated_count = Reservation.query.filter(
        Reservation.date == target_date,
        Reservation.shift == shift,
        Reservation.status == 'seated'
    ).count()

    confirmed_count = Reservation.query.filter(
        Reservation.date == target_date,
        Reservation.shift == shift,
        Reservation.status == 'confirmed'
    ).count()

    occupancy = round(total_guests / MAX_CAPACITY * 100, 1) if total_guests else 0

    return {
        'reservations': total_reservations,
        'guests': total_guests,
        'max_capacity': MAX_CAPACITY,
        'occupancy': occupancy,
        'seated': seated_count,
        'pending': confirmed_count,
    }
