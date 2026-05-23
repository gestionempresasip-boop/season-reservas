"""
Global constants - all magic numbers in one place.
"""

# ═══════════════════════════════════════════════════════════════════════════
# RESPONSE CODES & MESSAGES
# ═══════════════════════════════════════════════════════════════════════════

HTTP_OK = 200
HTTP_CREATED = 201
HTTP_BAD_REQUEST = 400
HTTP_NOT_FOUND = 404
HTTP_CONFLICT = 409
HTTP_INTERNAL_ERROR = 500

# ═══════════════════════════════════════════════════════════════════════════
# ERROR MESSAGES
# ═══════════════════════════════════════════════════════════════════════════

ERR_RESERVATION_NOT_FOUND = 'Reserva no encontrada'
ERR_TABLE_NOT_FOUND = 'Mesa no encontrada'
ERR_CLIENT_NOT_FOUND = 'Cliente no encontrado'
ERR_INVALID_SHIFT = 'Turno inválido (debe ser comida o cena)'
ERR_INVALID_GUESTS = 'Número de comensales inválido (1-14)'
ERR_INVALID_DATE = 'Fecha inválida'
ERR_INVALID_TIME = 'Hora inválida (formato HH:MM)'
ERR_PAST_RESERVATION = 'No se puede crear reserva en fechas pasadas'
ERR_PAST_TIME = 'La hora ya ha pasado'
ERR_INVALID_PHONE = 'Teléfono inválido'
ERR_INVALID_EMAIL = 'Email inválido'
ERR_TABLE_OCCUPIED = 'Mesa ya ocupada en ese turno'
ERR_CAPACITY_EXCEEDED = 'Número de comensales excede capacidad de mesa'
ERR_INSUFFICIENT_CAPACITY = 'No hay mesas disponibles para esa cantidad'
ERR_DATABASE_ERROR = 'Error en base de datos'
ERR_INTERNAL_SERVER_ERROR = 'Error interno del servidor'
ERR_UNAUTHORIZED = 'No autorizado'

# ═══════════════════════════════════════════════════════════════════════════
# SUCCESS MESSAGES
# ═══════════════════════════════════════════════════════════════════════════

MSG_RESERVATION_CREATED = 'Reserva creada exitosamente'
MSG_RESERVATION_UPDATED = 'Reserva actualizada exitosamente'
MSG_RESERVATION_CANCELLED = 'Reserva cancelada exitosamente'
MSG_RESERVATION_SEATED = 'Reserva marcada como sentada'
MSG_RESERVATION_COMPLETED = 'Reserva completada'
MSG_RESERVATION_NO_SHOW = 'Reserva marcada como no show'

MSG_CLIENT_CREATED = 'Cliente creado exitosamente'
MSG_CLIENT_UPDATED = 'Cliente actualizado exitosamente'
MSG_CLIENT_DELETED = 'Cliente eliminado exitosamente'

MSG_TABLE_UPDATED = 'Mesa actualizada exitosamente'

# ═══════════════════════════════════════════════════════════════════════════
# PAGINATION
# ═══════════════════════════════════════════════════════════════════════════

PAGINATION_DEFAULT_PAGE = 1
PAGINATION_DEFAULT_LIMIT = 50
PAGINATION_MAX_LIMIT = 100

# ═══════════════════════════════════════════════════════════════════════════
# TIME-RELATED CONSTANTS
# ═══════════════════════════════════════════════════════════════════════════

# Reservation can be created up to 15 minutes early
EARLY_RESERVATION_MARGIN_MINUTES = 15

# Search range for reports (days)
REPORT_DEFAULT_DAYS = 30
REPORT_MAX_DAYS = 365

# ═══════════════════════════════════════════════════════════════════════════
# CLIENT CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════

# Client search result limit
CLIENT_SEARCH_LIMIT = 50

# Top clients to return
TOP_CLIENTS_LIMIT = 20

# ═══════════════════════════════════════════════════════════════════════════
# WHATSAPP CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════

# Maximum guests in WhatsApp conversation
WHATSAPP_MAX_GUESTS = 14

# Session timeout (minutes)
WHATSAPP_SESSION_TIMEOUT = 30

# ═══════════════════════════════════════════════════════════════════════════
# CACHE-RELATED CONSTANTS
# ═══════════════════════════════════════════════════════════════════════════

# Cache key prefixes
CACHE_PREFIX_STATS = 'stats'
CACHE_PREFIX_DASHBOARD = 'dashboard'
CACHE_PREFIX_TABLE_STATUS = 'table_status'
CACHE_PREFIX_CLIENTS = 'clients'

# ═══════════════════════════════════════════════════════════════════════════
# REGEX PATTERNS
# ═══════════════════════════════════════════════════════════════════════════

PATTERN_PHONE = r'^\+?[0-9]{7,15}$'
PATTERN_EMAIL = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
PATTERN_TIME = r'^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$'
PATTERN_DATE_ISO = r'^\d{4}-\d{2}-\d{2}$'
