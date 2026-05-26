"""
Database models for Season restaurant reservation system.
"""
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, date

db = SQLAlchemy()


# ═══════════════════════════════════════════════════════════════════════════
# RESERVATION ↔ TABLE ASSOCIATION (Many-to-Many for combined reservations)
# ═══════════════════════════════════════════════════════════════════════════

reservation_tables = db.Table(
    'reservation_tables',
    db.Column('reservation_id', db.Integer, db.ForeignKey('reservations.id', ondelete='CASCADE'), primary_key=True),
    db.Column('table_id', db.Integer, db.ForeignKey('tables.id', ondelete='CASCADE'), primary_key=True),
    db.Index('idx_resv_tables_table_id', 'table_id'),
)


# ═══════════════════════════════════════════════════════════════════════════
# TABLE MODEL
# ═══════════════════════════════════════════════════════════════════════════

class Table(db.Model):
    """Restaurant table model."""
    __tablename__ = 'tables'

    # Primary Key
    id = db.Column(db.Integer, primary_key=True)

    # Table Identification
    number = db.Column(db.Integer, unique=True, nullable=False, index=True)
    zone = db.Column(db.String(50), nullable=False)
    capacity = db.Column(db.Integer, nullable=False)
    table_type = db.Column(db.String(20), default='normal')

    # Position (for floor plan)
    pos_x = db.Column(db.Float, default=0)
    pos_y = db.Column(db.Float, default=0)

    # Status
    active = db.Column(db.Boolean, default=True, index=True)

    # Relationships
    reservations = db.relationship('Reservation', backref='table', lazy='dynamic')

    def to_dict(self):
        """Convert to dictionary for API responses."""
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

    def __repr__(self):
        return f'<Table {self.number}>'


# ═══════════════════════════════════════════════════════════════════════════
# CLIENT MODEL
# ═══════════════════════════════════════════════════════════════════════════

class Client(db.Model):
    """Restaurant client/customer model."""
    __tablename__ = 'clients'

    # Primary Key
    id = db.Column(db.Integer, primary_key=True)

    # Contact Information
    name = db.Column(db.String(200), nullable=False)
    phone = db.Column(db.String(20), unique=True, nullable=False, index=True)
    email = db.Column(db.String(200), default='')

    # Additional Info
    notes = db.Column(db.Text, default='')
    preferences = db.Column(db.Text, default='')
    allergies = db.Column(db.Text, default='')

    # Status Flags
    vip = db.Column(db.Boolean, default=False)
    blacklisted = db.Column(db.Boolean, default=False)

    # Timestamps (Auditoría)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )

    # Relationships
    reservations = db.relationship('Reservation', backref='client', lazy='dynamic')

    def to_dict(self, include_stats=False):
        """Convert to dictionary for API responses.

        Args:
            include_stats: If True, include reservation statistics (requires separate queries)
        """
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
            'updated_at': self.updated_at.isoformat(),
        }
        # Note: stats are NOT included by default - compute them in services/
        # to avoid N+1 queries
        if include_stats:
            # These should be computed by service layer, not here
            # See services/client.py for get_client_stats()
            pass
        return data

    def __repr__(self):
        return f'<Client {self.name}>'


# ═══════════════════════════════════════════════════════════════════════════
# RESERVATION MODEL
# ═══════════════════════════════════════════════════════════════════════════

class Reservation(db.Model):
    """Restaurant reservation model."""
    __tablename__ = 'reservations'

    __table_args__ = (
        # Constraint: guests must be between 1 and 14
        db.CheckConstraint('guests >= 1 AND guests <= 14'),
        # Composite index for common queries
        db.Index('idx_reservation_date_shift', 'date', 'shift'),
        db.Index('idx_reservation_date_shift_status', 'date', 'shift', 'status'),
    )

    # Primary Key
    id = db.Column(db.Integer, primary_key=True)

    # Foreign Keys
    client_id = db.Column(db.Integer, db.ForeignKey('clients.id'), nullable=True, index=True)
    table_id = db.Column(db.Integer, db.ForeignKey('tables.id'), nullable=True, index=True)

    # Reservation Details
    date = db.Column(db.Date, nullable=False, index=True)
    shift = db.Column(db.String(10), nullable=False)  # 'comida' or 'cena'
    time = db.Column(db.String(5), nullable=False)  # HH:MM format
    guests = db.Column(db.Integer, nullable=False)

    # Client Information (duplicated for history)
    client_name = db.Column(db.String(200), nullable=False)
    client_phone = db.Column(db.String(20), default='')

    # Status & Tracking
    status = db.Column(db.String(20), default='confirmed', index=True)
    source = db.Column(db.String(20), default='phone')  # phone, whatsapp, walk_in, web

    # Additional Info
    notes = db.Column(db.Text, default='')

    # Duration (minutes) - default 120 (2 hours)
    duration_minutes = db.Column(db.Integer, default=120)

    # Timestamps (Auditoría)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )

    # Many-to-many: additional tables for combined reservations (group bookings)
    extra_tables = db.relationship(
        'Table',
        secondary=reservation_tables,
        lazy='joined',
        backref=db.backref('group_reservations', lazy='dynamic')
    )

    def all_table_ids(self):
        """Return ALL table IDs for this reservation (primary + extras)."""
        ids = []
        if self.table_id:
            ids.append(self.table_id)
        for t in (self.extra_tables or []):
            if t.id not in ids:
                ids.append(t.id)
        return ids

    def all_table_numbers(self):
        """Return ALL table numbers for this reservation."""
        nums = []
        if self.table:
            nums.append(self.table.number)
        for t in (self.extra_tables or []):
            if t.number not in nums:
                nums.append(t.number)
        return nums

    def total_table_capacity(self):
        """Sum of capacities of all tables in this reservation."""
        cap = self.table.capacity if self.table else 0
        for t in (self.extra_tables or []):
            if not self.table or t.id != self.table_id:
                cap += t.capacity
        return cap

    def to_dict(self, include_client=False):
        """Convert to dictionary for API responses.

        Args:
            include_client: If True, include full client data (use sparingly)
        """
        # Compute combined table info
        table_ids = self.all_table_ids()
        table_numbers = self.all_table_numbers()
        is_grouped = len(table_ids) > 1

        data = {
            'id': self.id,
            'client_id': self.client_id,
            'table_id': self.table_id,
            'table_number': self.table.number if self.table else None,
            'table_zone': self.table.zone if self.table else None,
            'table_ids': table_ids,
            'table_numbers': table_numbers,
            'is_grouped': is_grouped,
            'total_capacity': self.total_table_capacity() if table_ids else 0,
            'date': self.date.isoformat(),
            'shift': self.shift,
            'time': self.time,
            'guests': self.guests,
            'client_name': self.client_name,
            'client_phone': self.client_phone,
            'status': self.status,
            'source': self.source,
            'notes': self.notes,
            'duration_minutes': self.duration_minutes or 120,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
        }

        # Include full client data only if explicitly requested
        if include_client and self.client:
            data['client'] = self.client.to_dict()

        return data

    def __repr__(self):
        return f'<Reservation {self.id} - {self.client_name}>'


# ═══════════════════════════════════════════════════════════════════════════
# WAITLIST MODEL
# ═══════════════════════════════════════════════════════════════════════════

class Waitlist(db.Model):
    """Waitlist entry model."""
    __tablename__ = 'waitlist'

    # Primary Key
    id = db.Column(db.Integer, primary_key=True)

    # Client Information
    client_name = db.Column(db.String(200), nullable=False)
    phone = db.Column(db.String(20), default='')

    # Request Details
    guests = db.Column(db.Integer, nullable=False)
    date = db.Column(db.Date, nullable=False, index=True)
    shift = db.Column(db.String(10), nullable=False)

    # Notes
    notes = db.Column(db.Text, default='')

    # Status
    status = db.Column(db.String(20), default='waiting', index=True)

    # Timestamps (Auditoría)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )

    def to_dict(self):
        """Convert to dictionary for API responses."""
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
            'updated_at': self.updated_at.isoformat(),
        }

    def __repr__(self):
        return f'<Waitlist {self.client_name}>'


# ═══════════════════════════════════════════════════════════════════════════
# WHATSAPP SESSION MODEL
# ═══════════════════════════════════════════════════════════════════════════

class WhatsappSession(db.Model):
    """WhatsApp conversation session model."""
    __tablename__ = 'whatsapp_sessions'

    # Primary Key
    id = db.Column(db.Integer, primary_key=True)

    # Session Identification
    phone = db.Column(db.String(20), nullable=False, unique=True, index=True)

    # Conversation State
    step = db.Column(db.String(30), default='start')
    data = db.Column(db.Text, default='{}')  # JSON data for context

    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )

    def to_dict(self):
        """Convert to dictionary for API responses."""
        return {
            'id': self.id,
            'phone': self.phone,
            'step': self.step,
            'data': self.data,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
        }

    def __repr__(self):
        return f'<WhatsappSession {self.phone}>'
