"""
Client statistics service - calculate stats without N+1 queries.

These functions replace the Client model properties (visits_count, no_show_count, etc.)
to avoid N+1 query problems.
"""

from models import db, Reservation
from sqlalchemy import func


def get_client_visits_count(client_id):
    """Get number of completed visits for a client.

    Args:
        client_id: Client ID

    Returns:
        Integer count of completed reservations
    """
    return Reservation.query.filter(
        Reservation.client_id == client_id,
        Reservation.status == 'completed'
    ).count()


def get_client_no_show_count(client_id):
    """Get number of no-shows for a client.

    Args:
        client_id: Client ID

    Returns:
        Integer count of no-show reservations
    """
    return Reservation.query.filter(
        Reservation.client_id == client_id,
        Reservation.status == 'no_show'
    ).count()


def get_client_last_visit_date(client_id):
    """Get the date of the client's last completed visit.

    Args:
        client_id: Client ID

    Returns:
        ISO format date string or None if no completed visits
    """
    last = Reservation.query.filter(
        Reservation.client_id == client_id,
        Reservation.status == 'completed'
    ).order_by(Reservation.date.desc()).first()

    return last.date.isoformat() if last else None


def get_client_stats(client_id):
    """Get all statistics for a client in a single set of queries.

    This is more efficient than calling individual functions.

    Args:
        client_id: Client ID

    Returns:
        Dictionary with visits_count, no_show_count, last_visit
    """
    visits = Reservation.query.filter(
        Reservation.client_id == client_id,
        Reservation.status == 'completed'
    ).count()

    no_shows = Reservation.query.filter(
        Reservation.client_id == client_id,
        Reservation.status == 'no_show'
    ).count()

    last = Reservation.query.filter(
        Reservation.client_id == client_id,
        Reservation.status == 'completed'
    ).order_by(Reservation.date.desc()).first()

    return {
        'visits_count': visits,
        'no_show_count': no_shows,
        'last_visit': last.date.isoformat() if last else None,
    }


def get_top_clients_by_visits(limit=20):
    """Get top clients by number of completed visits.

    Args:
        limit: Maximum number of clients to return

    Returns:
        List of client IDs ordered by visit count
    """
    results = db.session.query(
        Reservation.client_id,
        func.count(Reservation.id).label('visit_count')
    ).filter(
        Reservation.client_id.isnot(None),
        Reservation.status == 'completed'
    ).group_by(
        Reservation.client_id
    ).order_by(
        func.count(Reservation.id).desc()
    ).limit(limit).all()

    return [client_id for client_id, _ in results]
