"""
Decorators for API request validation and error handling.
"""

from functools import wraps
from flask import request, jsonify, current_app
from pydantic import ValidationError
from utils.errors import format_validation_errors, error_response

# ═══════════════════════════════════════════════════════════════════════════
# REQUEST VALIDATION DECORATOR
# ═══════════════════════════════════════════════════════════════════════════

def validate_json(schema_class):
    """Decorator to validate incoming JSON against Pydantic schema.

    Args:
        schema_class: Pydantic model class to validate against

    Example:
        @api.route('/reservations', methods=['POST'])
        @validate_json(ReservationCreate)
        def create_reservation(data: ReservationCreate):
            # data is already validated
            ...
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # Check if request has JSON data
            if not request.is_json:
                return error_response('Content-Type must be application/json', 400)

            try:
                # Validate data against schema
                validated_data = schema_class(**request.json)
                # Pass validated data as first argument
                return f(validated_data, *args, **kwargs)

            except ValidationError as e:
                # Format Pydantic errors
                errors = format_validation_errors(e.errors())
                return error_response(
                    'Validación fallida',
                    400,
                    errors
                )
            except Exception as e:
                current_app.logger.error(f'Validation error: {str(e)}')
                return error_response('Error al procesar solicitud', 500)

        return decorated_function
    return decorator


# ═══════════════════════════════════════════════════════════════════════════
# ERROR HANDLING DECORATOR
# ═══════════════════════════════════════════════════════════════════════════

def handle_errors(f):
    """Decorator to handle common errors in API endpoints.

    Catches ValueError, 404, and other exceptions.

    Example:
        @api.route('/reservations/<int:rid>', methods=['PUT'])
        @handle_errors
        def update_reservation(rid):
            ...
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            return f(*args, **kwargs)

        except ValueError as e:
            # Business logic validation errors
            current_app.logger.warning(f'Validation error: {str(e)}')
            return error_response(str(e), 400)

        except Exception as e:
            # Catch-all for unexpected errors
            current_app.logger.error(f'Unexpected error in {f.__name__}: {str(e)}')
            return error_response('Error interno del servidor', 500)

    return decorated_function


# ═══════════════════════════════════════════════════════════════════════════
# COMBINED VALIDATION + ERROR HANDLING
# ═══════════════════════════════════════════════════════════════════════════

def validate_and_handle(schema_class):
    """Combine validation and error handling in one decorator.

    Example:
        @api.route('/clients', methods=['POST'])
        @validate_and_handle(ClientCreate)
        def create_client(data: ClientCreate):
            ...
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            import traceback
            # Step 1: Validate JSON
            if not request.is_json:
                return error_response('Content-Type must be application/json', 400)

            try:
                validated_data = schema_class(**request.json)
            except ValidationError as e:
                errors = format_validation_errors(e.errors())
                return error_response('Validación fallida', 400, errors)
            except Exception as e:
                tb = traceback.format_exc()
                current_app.logger.error(f'Schema error in {schema_class.__name__}: {type(e).__name__}: {str(e)}\n{tb}')
                return error_response(f'ERR1:{type(e).__name__}:{str(e)[:200]}', 500)

            # Step 2: Call function with error handling
            try:
                return f(validated_data, *args, **kwargs)
            except ValueError as e:
                current_app.logger.warning(f'Business error: {str(e)}')
                return error_response(str(e), 400)
            except Exception as e:
                tb = traceback.format_exc()
                current_app.logger.error(f'Error in {f.__name__}: {str(e)}\n{tb}')
                return error_response(f'ERR2:{type(e).__name__}:{str(e)[:200]}', 500)

        return decorated_function
    return decorator
