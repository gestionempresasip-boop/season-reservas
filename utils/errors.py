"""Error handling utilities."""

from config.constants import *

# ═══════════════════════════════════════════════════════════════════════════
# CUSTOM EXCEPTIONS
# ═══════════════════════════════════════════════════════════════════════════

class ValidationError(Exception):
    """Custom validation error."""
    pass

class ResourceNotFoundError(Exception):
    """Resource not found error."""
    pass

class ConflictError(Exception):
    """Conflict error (e.g., duplicate resource)."""
    pass

class DatabaseError(Exception):
    """Database operation error."""
    pass

# ═══════════════════════════════════════════════════════════════════════════
# RESPONSE FORMATTERS
# ═══════════════════════════════════════════════════════════════════════════

def success_response(data=None, message=None, status_code=HTTP_OK):
    """Format successful API response."""
    response = {}
    if message:
        response['message'] = message
    if data is not None:
        response['data'] = data
    return response, status_code

def error_response(message, status_code=HTTP_BAD_REQUEST, details=None):
    """Format error API response."""
    response = {'error': message}
    if details:
        response['details'] = details
    return response, status_code

def validation_error_response(message, details=None):
    """Format validation error response."""
    return error_response(message, HTTP_BAD_REQUEST, details)

def not_found_response(message=ERR_RESERVATION_NOT_FOUND):
    """Format not found error response."""
    return error_response(message, HTTP_NOT_FOUND)

def conflict_response(message):
    """Format conflict error response."""
    return error_response(message, HTTP_CONFLICT)

def internal_error_response(message=ERR_INTERNAL_SERVER_ERROR):
    """Format internal server error response."""
    return error_response(message, HTTP_INTERNAL_ERROR)

# ═══════════════════════════════════════════════════════════════════════════
# PYDANTIC ERROR HANDLER
# ═══════════════════════════════════════════════════════════════════════════

def format_validation_errors(errors):
    """Format Pydantic validation errors for API response."""
    formatted = {}
    for error in errors:
        field = '.'.join(str(x) for x in error['loc'])
        formatted[field] = error['msg']
    return formatted
