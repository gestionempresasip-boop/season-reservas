"""
Application settings and constants.
All configuration values in one place for easy maintenance.
"""

import os
from config.tables import get_total_capacity

# ═══════════════════════════════════════════════════════════════════════════
# RESTAURANT INFO
# ═══════════════════════════════════════════════════════════════════════════

RESTAURANT_NAME = "Season"
WHATSAPP_NUMBER = os.getenv('WHATSAPP_NUMBER', '689135630')

# ═══════════════════════════════════════════════════════════════════════════
# CAPACITY SETTINGS
# ═══════════════════════════════════════════════════════════════════════════

MAX_CAPACITY = get_total_capacity()  # 114 (computed from tables)
MAX_GUESTS_PER_RESERVATION = 14
MIN_GUESTS = 1

# ═══════════════════════════════════════════════════════════════════════════
# SHIFT CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════

SHIFTS = {
    'comida': {
        'name': 'Comida',
        'inicio': '13:00',
        'fin': '16:00',
    },
    'cena': {
        'name': 'Cena',
        'inicio': '20:00',
        'fin': '23:30',
    }
}

def get_shift_name(shift_key):
    """Get friendly name for shift."""
    return SHIFTS.get(shift_key, {}).get('name', shift_key)

def is_valid_shift(shift_key):
    """Check if shift is valid."""
    return shift_key in SHIFTS

def get_shift_time_range(shift_key):
    """Get start and end times for a shift."""
    shift = SHIFTS.get(shift_key, {})
    return shift.get('inicio'), shift.get('fin')

# ═══════════════════════════════════════════════════════════════════════════
# RESERVATION CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════

RESERVATION_STATUSES = [
    'confirmed',
    'seated',
    'completed',
    'no_show',
    'cancelled'
]

RESERVATION_SOURCES = [
    'phone',
    'whatsapp',
    'walk_in',
    'web'
]

# ═══════════════════════════════════════════════════════════════════════════
# WHATSAPP CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════

TWILIO_ACCOUNT_SID = os.getenv('TWILIO_ACCOUNT_SID', '')
TWILIO_AUTH_TOKEN = os.getenv('TWILIO_AUTH_TOKEN', '')
TWILIO_WHATSAPP_NUMBER = os.getenv('TWILIO_WHATSAPP_NUMBER', '')

# ═══════════════════════════════════════════════════════════════════════════
# DATABASE CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════

DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://localhost/season')

# ═══════════════════════════════════════════════════════════════════════════
# CACHING CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════

CACHE_TTL_STATS = 30  # seconds
CACHE_TTL_DASHBOARD = 60  # seconds
CACHE_TTL_TABLES = 300  # seconds

# ═══════════════════════════════════════════════════════════════════════════
# API CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════

API_VERSION = '1.0'
API_PREFIX = '/api'

# ═══════════════════════════════════════════════════════════════════════════
# LOGGING CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════

LOG_FILE = 'logs/season.log'
LOG_MAX_BYTES = 10485760  # 10MB
LOG_BACKUP_COUNT = 10
LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')

# ═══════════════════════════════════════════════════════════════════════════
# TABLE ZONES
# ═══════════════════════════════════════════════════════════════════════════

ZONES = {
    'exterior': 'Zona Exterior',
    'salon_principal': 'Salón Principal',
    'salon_interior': 'Salón Interior',
}

def get_zone_display_name(zone_key):
    """Get friendly display name for zone."""
    return ZONES.get(zone_key, zone_key)
