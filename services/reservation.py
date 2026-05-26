"""
Reservation service - business logic for reservations.
Supports combined reservations (multiple tables per reservation).
"""
from datetime import date, datetime, timedelta
from models import db, Reservation, Table, Client
from sqlalchemy import func, or_


# ═══════════════════════════════════════════════════════════════════════════
# QUERIES
# ═══════════════════════════════════════════════════════════════════════════

def get_reservations(target_date, shift):
    """Get confirmed and seated reservations for a date and shift."""
    return Reservation.query.filter(
        Reservation.date == target_date,
        Reservation.shift == shift,
        Reservation.status.in_(['confirmed', 'seated'])
    ).order_by(Reservation.time).all()


def get_all_reservations_for_date(target_date, shift):
    """Get ALL reservations for a date and shift (all statuses)."""
    return Reservation.query.filter(
        Reservation.date == target_date,
        Reservation.shift == shift,
    ).order_by(Reservation.time).all()


def get_active_reservations_for_shift(target_date, shift, exclude_id=None):
    """Active (confirmed/seated) reservations for a shift, optionally excluding one ID."""
    q = Reservation.query.filter(
        Reservation.date == target_date,
        Reservation.shift == shift,
        Reservation.status.in_(['confirmed', 'seated'])
    )
    if exclude_id:
        q = q.filter(Reservation.id != exclude_id)
    return q.all()


def get_occupied_table_ids(target_date, shift, exclude_reservation_id=None):
    """Return set of ALL occupied table IDs (primary + extras) for a shift."""
    active = get_active_reservations_for_shift(target_date, shift, exclude_reservation_id)
    occupied = set()
    for r in active:
        if r.table_id:
            occupied.add(r.table_id)
        for t in (r.extra_tables or []):
            occupied.add(t.id)
    return occupied


# ═══════════════════════════════════════════════════════════════════════════
# CONFLICT DETECTION (smart, time-window based)
# ═══════════════════════════════════════════════════════════════════════════

def _time_to_minutes(time_str):
    """Convert HH:MM to minutes since midnight."""
    if not time_str:
        return 0
    parts = time_str.split(':')
    return int(parts[0]) * 60 + int(parts[1] if len(parts) > 1 else 0)


def _reservations_overlap(r1_start, r1_dur, r2_start, r2_dur, buffer=15):
    """Check if two reservations overlap in time (with buffer in minutes)."""
    r1_end = r1_start + r1_dur + buffer
    r2_end = r2_start + r2_dur + buffer
    return r1_start < r2_end and r2_start < r1_end


def check_table_conflicts(target_date, shift, time_str, duration_minutes, table_ids, exclude_reservation_id=None):
    """Check if any of the requested tables have a conflicting reservation.

    Returns list of conflict dicts: [{'table_id': int, 'conflicting_reservation': dict}]
    """
    if not table_ids:
        return []
    conflicts = []
    active = get_active_reservations_for_shift(target_date, shift, exclude_reservation_id)
    req_start = _time_to_minutes(time_str)
    req_dur = duration_minutes or 120

    for r in active:
        existing_table_ids = set([r.table_id] if r.table_id else [])
        for t in (r.extra_tables or []):
            existing_table_ids.add(t.id)

        overlap_tables = existing_table_ids & set(table_ids)
        if not overlap_tables:
            continue

        r_start = _time_to_minutes(r.time)
        r_dur = r.duration_minutes or 120
        if _reservations_overlap(req_start, req_dur, r_start, r_dur):
            for tid in overlap_tables:
                conflicts.append({
                    'table_id': tid,
                    'conflicting_reservation': r.to_dict()
                })
    return conflicts


# ═══════════════════════════════════════════════════════════════════════════
# CREATE / UPDATE
# ═══════════════════════════════════════════════════════════════════════════

def _resolve_table_ids(data):
    """Extract list of table IDs from data dict.

    Accepts:
        - data['table_ids']: list of int
        - data['table_id']: single int
        - Returns: list of int (or empty list)
    """
    if 'table_ids' in data and data['table_ids']:
        ids = data['table_ids']
        if isinstance(ids, str):
            # "1,2,3" or "[1,2]"
            import json
            try:
                ids = json.loads(ids)
            except Exception:
                ids = [int(x.strip()) for x in ids.split(',') if x.strip()]
        return [int(x) for x in ids if x]

    if data.get('table_id'):
        try:
            return [int(data['table_id'])]
        except (TypeError, ValueError):
            return []

    return []


def create_reservation(data):
    """Create a new reservation. Supports single or multiple tables.

    data:
        - date, shift, time, guests, client_name, client_phone (required)
        - table_id OR table_ids (optional, single or list)
        - duration_minutes (optional, default 120)
        - source, notes, email (optional)

    Raises:
        ValueError: validation errors, conflicts, capacity issues
    """
    # Validate date is not in the past
    res_date = date.fromisoformat(data['date'])
    today = date.today()
    if res_date < today:
        raise ValueError('No se pueden crear reservas en fechas pasadas')

    # Validate time is not past (today only, 15-min buffer)
    if res_date == today and data.get('time'):
        now = datetime.now()
        parts = data['time'].split(':')
        res_hour, res_min = int(parts[0]), int(parts[1]) if len(parts) > 1 else 0
        res_minutes = res_hour * 60 + res_min
        now_minutes = now.hour * 60 + now.minute
        if res_minutes < now_minutes - 15:
            raise ValueError('La hora de la reserva ya ha pasado')

    # Resolve table IDs (single or multiple)
    table_ids = _resolve_table_ids(data)
    duration = int(data.get('duration_minutes', 120) or 120)

    # Conflict check
    if table_ids:
        conflicts = check_table_conflicts(
            res_date, data['shift'], data['time'], duration, table_ids
        )
        if conflicts:
            conflict_tables = list(set([c['table_id'] for c in conflicts]))
            tables_str = ', '.join(str(c['conflicting_reservation'].get('table_number') or c['table_id']) for c in conflicts[:3])
            raise ValueError(f'Mesa(s) ya reservada(s) a esa hora: {tables_str}')

        # Capacity check
        tables = Table.query.filter(Table.id.in_(table_ids)).all()
        total_cap = sum(t.capacity for t in tables)
        guests = int(data['guests'])
        if total_cap < guests:
            raise ValueError(f'Capacidad insuficiente: {total_cap}p para {guests} comensales')

    # Find or create client
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

    # Primary table = first one
    primary_table_id = table_ids[0] if table_ids else None

    reservation = Reservation(
        client_id=client.id if client else None,
        table_id=primary_table_id,
        date=res_date,
        shift=data['shift'],
        time=data['time'],
        guests=int(data['guests']),
        client_name=data['client_name'],
        client_phone=phone,
        status='confirmed',
        source=data.get('source', 'phone'),
        notes=data.get('notes', ''),
        duration_minutes=duration,
    )
    db.session.add(reservation)
    db.session.flush()

    # Attach extra tables (all in table_ids - the primary is also added for unified queries)
    if table_ids:
        tables = Table.query.filter(Table.id.in_(table_ids)).all()
        reservation.extra_tables = tables

    db.session.commit()
    return reservation


def update_reservation(reservation_id, data):
    """Update an existing reservation."""
    reservation = Reservation.query.get_or_404(reservation_id)

    # Handle table changes
    table_ids = None
    if 'table_ids' in data or 'table_id' in data:
        table_ids = _resolve_table_ids(data)

        # Conflict check for new tables
        target_date = reservation.date
        target_shift = reservation.shift
        target_time = data.get('time', reservation.time)
        target_duration = int(data.get('duration_minutes', reservation.duration_minutes or 120))

        if 'date' in data:
            target_date = date.fromisoformat(data['date'])
        if 'shift' in data:
            target_shift = data['shift']

        if table_ids:
            conflicts = check_table_conflicts(
                target_date, target_shift, target_time, target_duration,
                table_ids, exclude_reservation_id=reservation_id
            )
            if conflicts:
                tables_str = ', '.join(str(c['conflicting_reservation'].get('table_number') or c['table_id']) for c in conflicts[:3])
                raise ValueError(f'Mesa(s) ya reservada(s) a esa hora: {tables_str}')

            # Capacity check
            tables = Table.query.filter(Table.id.in_(table_ids)).all()
            total_cap = sum(t.capacity for t in tables)
            guests = int(data.get('guests', reservation.guests))
            if total_cap < guests:
                raise ValueError(f'Capacidad insuficiente: {total_cap}p para {guests} comensales')

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
    if 'duration_minutes' in data and data['duration_minutes']:
        reservation.duration_minutes = int(data['duration_minutes'])

    if table_ids is not None:
        reservation.table_id = table_ids[0] if table_ids else None
        if table_ids:
            tables = Table.query.filter(Table.id.in_(table_ids)).all()
            reservation.extra_tables = tables
        else:
            reservation.extra_tables = []

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
        # Ensure it's also in extra_tables
        t = Table.query.get(table_id)
        if t and t not in (reservation.extra_tables or []):
            reservation.extra_tables = list(reservation.extra_tables or []) + [t]
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


# ═══════════════════════════════════════════════════════════════════════════
# TABLE STATUS / AVAILABILITY
# ═══════════════════════════════════════════════════════════════════════════

def get_table_status(target_date, shift):
    """Get status of all tables for a date/shift.

    Returns: list of dicts with table info + status + active reservation.
    Includes _unassigned key with reservations without a table.
    """
    tables = Table.query.filter_by(active=True).all()
    active = get_active_reservations_for_shift(target_date, shift)

    # Build table_id -> reservation map (use first reservation for that table)
    table_to_res = {}
    unassigned = []
    for r in active:
        if not r.table_id and not (r.extra_tables or []):
            unassigned.append(r)
            continue
        # Put reservation against ALL tables it occupies
        for tid in r.all_table_ids():
            if tid not in table_to_res:
                table_to_res[tid] = r

    result = []
    for t in tables:
        r = table_to_res.get(t.id)
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

    # Append special _unassigned entry for floor plan
    if unassigned:
        result.append({
            '_unassigned': True,
            'unassignedReservations': [r.to_dict() for r in unassigned],
        })

    return result


def find_available_tables(target_date, shift, guests=1, time_str=None, duration_minutes=120, exclude_reservation_id=None):
    """Find tables that have no conflicting reservation at the given time."""
    all_tables = Table.query.filter(Table.active == True).order_by(Table.capacity, Table.zone).all()

    if not time_str:
        # Simple mode: only filter by date+shift
        occupied = get_occupied_table_ids(target_date, shift, exclude_reservation_id)
        return [t for t in all_tables if t.id not in occupied]

    # Time-aware mode: check conflicts per table
    available = []
    for t in all_tables:
        conflicts = check_table_conflicts(
            target_date, shift, time_str, duration_minutes, [t.id], exclude_reservation_id
        )
        if not conflicts:
            available.append(t)
    return available


# ═══════════════════════════════════════════════════════════════════════════
# STATS
# ═══════════════════════════════════════════════════════════════════════════

def get_shift_stats(target_date, shift):
    """Get statistics for a shift."""
    from config.settings import MAX_CAPACITY

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


# ═══════════════════════════════════════════════════════════════════════════
# GLOBAL SEARCH (across all dates)
# ═══════════════════════════════════════════════════════════════════════════

def global_search_reservations(query, limit=50):
    """Search reservations across all dates by name, phone, or notes."""
    q = query.strip().lower()
    if len(q) < 2:
        return []

    like = f'%{q}%'
    reservations = Reservation.query.filter(
        or_(
            func.lower(Reservation.client_name).like(like),
            Reservation.client_phone.like(like),
            func.lower(Reservation.notes).like(like),
        )
    ).order_by(Reservation.date.desc(), Reservation.time.desc()).limit(limit).all()

    return reservations
