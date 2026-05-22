from models import db, Client, Reservation
from sqlalchemy import func


def search_clients(query):
    if not query:
        return Client.query.order_by(Client.name).limit(50).all()
    pattern = f'%{query}%'
    return Client.query.filter(
        db.or_(
            Client.name.ilike(pattern),
            Client.phone.ilike(pattern),
            Client.email.ilike(pattern),
        )
    ).order_by(Client.name).limit(50).all()


def get_client(client_id):
    return Client.query.get_or_404(client_id)


def get_client_by_phone(phone):
    return Client.query.filter_by(phone=phone).first()


def create_client(data):
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
    client = Client.query.get_or_404(client_id)
    for field in ['name', 'phone', 'email', 'notes', 'preferences', 'allergies', 'vip', 'blacklisted']:
        if field in data:
            setattr(client, field, data[field])
    db.session.commit()
    return client


def get_client_history(client_id):
    return Reservation.query.filter_by(client_id=client_id).order_by(
        Reservation.date.desc()
    ).all()


def get_top_clients(limit=20):
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
        **client.to_dict(include_stats=True),
        'total_visits': total_visits,
        'total_guests': total_guests,
    } for client, total_visits, total_guests in results]


def delete_client(client_id):
    client = Client.query.get_or_404(client_id)
    # Set client_id to NULL for all reservations to avoid constraint violation
    Reservation.query.filter_by(client_id=client_id).update({'client_id': None})
    db.session.delete(client)
    db.session.commit()
    return True
