from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, date

db = SQLAlchemy()


class Table(db.Model):
    __tablename__ = 'tables'

    id = db.Column(db.Integer, primary_key=True)
    number = db.Column(db.Integer, unique=True, nullable=False)
    zone = db.Column(db.String(50), nullable=False)
    capacity = db.Column(db.Integer, nullable=False)
    table_type = db.Column(db.String(20), default='normal')
    pos_x = db.Column(db.Float, default=0)
    pos_y = db.Column(db.Float, default=0)
    active = db.Column(db.Boolean, default=True)

    reservations = db.relationship('Reservation', backref='table', lazy='dynamic')

    def to_dict(self):
        return {
            'id': self.id,
            'number': self.number,
            'zone': self.zone,
            'capacity': self.capacity,
            'table_type': self.table_type,
            'pos_x': self.pos_x,
            'pos_y': self.pos_y,
            'active': self.active,
        }


class Client(db.Model):
    __tablename__ = 'clients'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    phone = db.Column(db.String(20), unique=True, nullable=False)
    email = db.Column(db.String(200))
    notes = db.Column(db.Text, default='')
    preferences = db.Column(db.Text, default='')
    allergies = db.Column(db.Text, default='')
    vip = db.Column(db.Boolean, default=False)
    blacklisted = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    reservations = db.relationship('Reservation', backref='client', lazy='dynamic')

    @property
    def visits_count(self):
        return self.reservations.filter(Reservation.status == 'completed').count()

    @property
    def no_show_count(self):
        return self.reservations.filter(Reservation.status == 'no_show').count()

    @property
    def last_visit(self):
        last = self.reservations.filter(
            Reservation.status == 'completed'
        ).order_by(Reservation.date.desc()).first()
        return last.date.isoformat() if last else None

    def to_dict(self, include_stats=False):
        data = {
            'id': self.id,
            'name': self.name,
            'phone': self.phone,
            'email': self.email,
            'notes': self.notes,
            'preferences': self.preferences,
            'allergies': self.allergies,
            'vip': self.vip,
            'blacklisted': self.blacklisted,
            'created_at': self.created_at.isoformat(),
        }
        if include_stats:
            data['visits_count'] = self.visits_count
            data['no_show_count'] = self.no_show_count
            data['last_visit'] = self.last_visit
        return data


class Reservation(db.Model):
    __tablename__ = 'reservations'

    id = db.Column(db.Integer, primary_key=True)
    client_id = db.Column(db.Integer, db.ForeignKey('clients.id'), nullable=True)
    table_id = db.Column(db.Integer, db.ForeignKey('tables.id'), nullable=True)
    date = db.Column(db.Date, nullable=False)
    shift = db.Column(db.String(10), nullable=False)  # comida / cena
    time = db.Column(db.String(5), nullable=False)
    guests = db.Column(db.Integer, nullable=False)
    client_name = db.Column(db.String(200), nullable=False)
    client_phone = db.Column(db.String(20), default='')
    status = db.Column(db.String(20), default='confirmed')
    source = db.Column(db.String(20), default='phone')  # phone, whatsapp, walk_in, web
    notes = db.Column(db.Text, default='')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'client_id': self.client_id,
            'table_id': self.table_id,
            'table_number': self.table.number if self.table else None,
            'table_zone': self.table.zone if self.table else None,
            'date': self.date.isoformat(),
            'shift': self.shift,
            'time': self.time,
            'guests': self.guests,
            'client_name': self.client_name,
            'client_phone': self.client_phone,
            'status': self.status,
            'source': self.source,
            'notes': self.notes,
            'created_at': self.created_at.isoformat(),
            'client': self.client.to_dict() if self.client else None,
        }


class Waitlist(db.Model):
    __tablename__ = 'waitlist'

    id = db.Column(db.Integer, primary_key=True)
    client_name = db.Column(db.String(200), nullable=False)
    phone = db.Column(db.String(20), default='')
    guests = db.Column(db.Integer, nullable=False)
    date = db.Column(db.Date, nullable=False)
    shift = db.Column(db.String(10), nullable=False)
    notes = db.Column(db.Text, default='')
    status = db.Column(db.String(20), default='waiting')  # waiting, seated, cancelled
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'client_name': self.client_name,
            'phone': self.phone,
            'guests': self.guests,
            'date': self.date.isoformat(),
            'shift': self.shift,
            'notes': self.notes,
            'status': self.status,
            'created_at': self.created_at.isoformat(),
        }


class WhatsappSession(db.Model):
    __tablename__ = 'whatsapp_sessions'

    id = db.Column(db.Integer, primary_key=True)
    phone = db.Column(db.String(20), nullable=False)
    step = db.Column(db.String(30), default='start')
    data = db.Column(db.Text, default='{}')
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'phone': self.phone,
            'step': self.step,
            'data': self.data,
            'updated_at': self.updated_at.isoformat(),
        }
