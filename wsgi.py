"""
WSGI entry point for Render deployment - handles lazy app initialization.
This is necessary to prevent database connections during build phase.
"""
import sys
import os

# Ensure DATABASE_URL is available before importing anything else
if 'DATABASE_URL' not in os.environ:
    # Provide error message without connecting to DB
    print("ERROR: DATABASE_URL environment variable is required", file=sys.stderr)
    sys.exit(1)

# Global app instance - initialized on first request only
_app_instance = None

def app(environ, start_response):
    """WSGI application callable - lazy initializes Flask app on first request."""
    global _app_instance

    if _app_instance is None:
        # Only import and initialize Flask app on first request
        from app import get_app
        _app_instance = get_app()

    # Delegate to the actual Flask app
    return _app_instance(environ, start_response)


if __name__ == '__main__':
    # For local development only
    from app import get_app, get_socketio
    app_instance = get_app()
    socketio = get_socketio()
    socketio.run(
        app_instance,
        debug=os.getenv('FLASK_ENV') == 'development',
        host='0.0.0.0',
        port=int(os.getenv('PORT', 3000))
    )
