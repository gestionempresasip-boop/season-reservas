"""
Client service - business logic for client management.
"""
from models import db, Client, Reservation
from sqlalchemy import func
from config.constants import CLIENT_SEARCH_LIMIT, TOP_CLIENTS_LIMIT


def search_clients(query):
    """Search clients by name, phone, or email.

    Args:
        query: Search query string

    Returns:
        List of Client objects (up to CLIENT_SEARCH_LIMIT results)
    """
    if not query or not query.strip():
        return Client.query.order_by(Client.name).limit(CLIENT_SEARCH_LIMIT).all()

    pattern = f'%{query.strip()}%'
    return Client.query.filter(
        db.or_(
            Client.name.ilike(pattern),
            Client.phone.ilike(pattern),
            Client.email.ilike(pattern),
        )
    ).order_by(Client.name).limit(CLIENT_SEARCH_LIMIT).all()


def get_client(client_id):
    """Get a client by ID.

    Args:
        client_id: Client ID

    Returns:
        Client object

    Raises:
        NotFound (404): If client doesn't exist
    """
    return Client.query.get_or_404(client_id)


def get_client_by_phone(phone):
    """Get a client by phone number.

    Args:
        phone: Phone number string

    Returns:
        Client object or None if not found
    """
    return Client.query.filter_by(phone=phone).first()


def create_client(data):
    """Create a new client.

    Args:
        data: Dictionary with client details (name, phone, email, etc.)

    Returns:
        Client object
    """
    client = Client(
        name=data['name'],
        phone=data['phone'],
        email=data.get('email', ''),
        notes=data.get('notes', ''),
        preferences=data.get('preferences', ''),
        allergies=data.get('allergies', ''),
        vip=data.get('vip', False),
    )
    db.session.add(client)
    db.session.commit()
    return client


def update_client(client_id, data):
    """Update an existing client.

    Args:
        client_id: Client ID
        data: Dictionary with fields to update

    Returns:
        Updated Client object
    """
    client = Client.query.get_or_404(client_id)

    updatable_fields = [
        'name', 'phone', 'email', 'notes',
        'preferences', 'allergies', 'vip', 'blacklisted'
    ]

    for field in updatable_fields:
        if field in data:
            setattr(client, field, data[field])

    db.session.commit()
    return client


def get_client_history(client_id):
    """Get reservation history for a client.

    Args:
        client_id: Client ID

    Returns:
        List of Reservation objects ordered by date (newest first)
    """
    return Reservation.query.filter_by(
        client_id=client_id
    ).order_by(
        Reservation.date.desc()
    ).all()


def get_top_clients(limit=None):
    """Get top clients by number of completed visits.

    Args:
        limit: Maximum number of clients to return (defaults to TOP_CLIENTS_LIMIT)

    Returns:
        List of client dictionaries with visit stats
    """
    if limit is None:
        limit = TOP_CLIENTS_LIMIT

    results = db.session.query(
        Client,
        func.count(Reservation.id).label('total_visits'),
        func.sum(Reservation.guests).label('total_guests'),
    ).join(Reservation).filter(
        Reservation.status == 'completed'
    ).group_by(Client.id).order_by(
        func.count(Reservation.id).desc()
    ).limit(limit).all()

    return [{
        **client.to_dict(),
        'total_visits': total_visits,
        'total_guests': total_guests or 0,
    } for client, total_visits, total_guests in results]


def delete_client(client_id):
    """Delete a client and detach their reservations.

    Args:
        client_id: Client ID

    Returns:
        True if successful
    """
    client = Client.query.get_or_404(client_id)

    # Detach all reservations (set client_id to NULL)
    # This preserves reservation history without orphaning records
    Reservation.query.filter_by(client_id=client_id).update({'client_id': None})

    # Delete the client
    db.session.delete(client)
    db.session.commit()

    return True
