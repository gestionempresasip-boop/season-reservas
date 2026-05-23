"""Pydantic validators for API requests."""

from pydantic import BaseModel, validator, Field
from datetime import date
from typing import Optional
from config.settings import SHIFTS, MAX_GUESTS_PER_RESERVATION, MIN_GUESTS
from config.constants import PATTERN_PHONE, PATTERN_EMAIL, PATTERN_TIME

# ═══════════════════════════════════════════════════════════════════════════
# RESERVATION VALIDATORS
# ═══════════════════════════════════════════════════════════════════════════

class ReservationCreate(BaseModel):
    """Validator for creating new reservations."""

    date: date
    shift: str
    time: str
    guests: int = Field(ge=MIN_GUESTS, le=MAX_GUESTS_PER_RESERVATION)
    client_name: str
    client_phone: str
    email: Optional[str] = ''
    notes: Optional[str] = ''
    table_id: Optional[int] = None
    source: Optional[str] = 'phone'

    @validator('shift')
    def validate_shift(cls, v):
        """Validate shift is either comida or cena."""
        if v not in SHIFTS:
            raise ValueError(f'Shift debe ser uno de: {list(SHIFTS.keys())}')
        return v

    @validator('time')
    def validate_time_format(cls, v):
        """Validate time format HH:MM."""
        import re
        if not re.match(PATTERN_TIME, v):
            raise ValueError('Hora debe estar en formato HH:MM (ej: 14:30)')
        return v

    @validator('client_name')
    def validate_name(cls, v):
        """Validate client name is not empty."""
        if not v or len(v.strip()) < 2:
            raise ValueError('Nombre del cliente debe tener al menos 2 caracteres')
        return v.strip()

    @validator('client_phone')
    def validate_phone(cls, v):
        """Validate phone number format."""
        import re
        if not re.match(r'^\+?[0-9]{7,15}$', v):
            raise ValueError('Teléfono inválido')
        return v

    @validator('email')
    def validate_email(cls, v):
        """Validate email format if provided."""
        if v and v.strip():
            import re
            if not re.match(PATTERN_EMAIL, v):
                raise ValueError('Email inválido')
            return v.strip()
        return ''

    class Config:
        """Pydantic config."""
        json_schema_extra = {
            'example': {
                'date': '2025-05-25',
                'shift': 'comida',
                'time': '14:30',
                'guests': 4,
                'client_name': 'Juan Pérez',
                'client_phone': '+34612345678',
                'email': 'juan@example.com',
                'notes': 'Alergia a mariscos',
                'source': 'phone',
            }
        }


class ReservationUpdate(BaseModel):
    """Validator for updating reservations."""

    date: Optional[date] = None
    shift: Optional[str] = None
    time: Optional[str] = None
    guests: Optional[int] = Field(None, ge=MIN_GUESTS, le=MAX_GUESTS_PER_RESERVATION)
    client_name: Optional[str] = None
    client_phone: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None
    table_id: Optional[int] = None

    @validator('shift')
    def validate_shift(cls, v):
        """Validate shift if provided."""
        if v and v not in SHIFTS:
            raise ValueError(f'Shift debe ser uno de: {list(SHIFTS.keys())}')
        return v

    @validator('time')
    def validate_time_format(cls, v):
        """Validate time format if provided."""
        import re
        if v and not re.match(PATTERN_TIME, v):
            raise ValueError('Hora debe estar en formato HH:MM')
        return v


# ═══════════════════════════════════════════════════════════════════════════
# CLIENT VALIDATORS
# ═══════════════════════════════════════════════════════════════════════════

class ClientCreate(BaseModel):
    """Validator for creating new clients."""

    name: str
    phone: str
    email: Optional[str] = ''
    notes: Optional[str] = ''
    vip: Optional[bool] = False

    @validator('name')
    def validate_name(cls, v):
        """Validate client name."""
        if not v or len(v.strip()) < 2:
            raise ValueError('Nombre debe tener al menos 2 caracteres')
        return v.strip()

    @validator('phone')
    def validate_phone(cls, v):
        """Validate phone number."""
        import re
        if not re.match(r'^\+?[0-9]{7,15}$', v):
            raise ValueError('Teléfono inválido')
        return v

    @validator('email')
    def validate_email(cls, v):
        """Validate email format."""
        import re
        if v and v.strip():
            if not re.match(PATTERN_EMAIL, v):
                raise ValueError('Email inválido')
            return v.strip()
        return ''


class ClientUpdate(BaseModel):
    """Validator for updating clients."""

    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    notes: Optional[str] = None
    vip: Optional[bool] = None
    blacklisted: Optional[bool] = None


# ═══════════════════════════════════════════════════════════════════════════
# SEARCH/FILTER VALIDATORS
# ═══════════════════════════════════════════════════════════════════════════

class ReservationFilter(BaseModel):
    """Validator for filtering reservations."""

    date: Optional[date] = None
    shift: Optional[str] = None
    status: Optional[str] = None
    client_name: Optional[str] = None

    @validator('shift')
    def validate_shift(cls, v):
        """Validate shift if provided."""
        if v and v not in SHIFTS:
            raise ValueError(f'Shift debe ser uno de: {list(SHIFTS.keys())}')
        return v


class ClientSearch(BaseModel):
    """Validator for client search."""

    query: str
    limit: Optional[int] = Field(50, ge=1, le=100)

    @validator('query')
    def validate_query(cls, v):
        """Validate search query."""
        if not v or len(v.strip()) < 2:
            raise ValueError('Búsqueda debe tener al menos 2 caracteres')
        return v.strip()
