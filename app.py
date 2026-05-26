"""
Season - Restaurant Reservation System
Main application entry point with Flask configuration.
"""
import os
import time
from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO, emit
from flask_compress import Compress
from dotenv import load_dotenv
from models import db
from config import get_config
from config.tables import DEFAULT_TABLES
from utils.logging import setup_logging
from utils.errors import error_response

load_dotenv()

# ═══════════════════════════════════════════════════════════════════════════
# APPLICATION FACTORY
# ═══════════════════════════════════════════════════════════════════════════

def create_app():
    """Create and configure Flask application."""

    # Get configuration
    app = Flask(__name__)
    config = get_config()
    app.config.from_object(config)
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    # ──────────────────────────────────────────────────────────────────────
    # DATABASE CONFIGURATION
    # ──────────────────────────────────────────────────────────────────────

    # PostgreSQL required (no fallback to SQLite)
    db_url = os.getenv('DATABASE_URL')
    if not db_url:
        raise ValueError(
            'DATABASE_URL environment variable is required. '
            'Please set it to your Supabase PostgreSQL URL.'
        )

    # Ensure PostgreSQL format (handle both postgres:// and postgresql:// prefixes)
    if db_url.startswith('postgres://'):
        db_url = db_url.replace('postgres://', 'postgresql+psycopg2://', 1)
    elif db_url.startswith('postgresql://'):
        db_url = db_url.replace('postgresql://', 'postgresql+psycopg2://', 1)
    elif not db_url.startswith('postgresql+psycopg2://'):
        raise ValueError(
            'DATABASE_URL must be a PostgreSQL URL (postgres:// or postgresql://). '
            'Got: ' + db_url[:30] + '...'
        )

    app.config['SQLALCHEMY_DATABASE_URI'] = db_url

    # ──────────────────────────────────────────────────────────────────────
    # LOGGING SETUP
    # ──────────────────────────────────────────────────────────────────────

    logger = setup_logging(app)
    logger.info('✅ Application initialized')
    logger.info(f'✅ Environment: {os.getenv("FLASK_ENV", "development")}')
    logger.info('✅ Using PostgreSQL for database')

    # ──────────────────────────────────────────────────────────────────────
    # EXTENSIONS INITIALIZATION
    # ──────────────────────────────────────────────────────────────────────

    db.init_app(app)
    CORS(app)
    Compress(app)
    app.config['COMPRESS_MIMETYPES'] = [
        'application/json', 'text/html', 'text/css', 'application/javascript'
    ]
    app.config['COMPRESS_MIN_SIZE'] = 200

    socketio = SocketIO(
        app,
        cors_allowed_origins='*',
        async_mode='threading',  # Prevent gevent monkey-patching with gthread workers
        transport=['polling'],
        engineio_logger=False,
        socketio_logger=False
    )

    # ──────────────────────────────────────────────────────────────────────
    # ERROR HANDLERS
    # ──────────────────────────────────────────────────────────────────────

    @app.errorhandler(404)
    def not_found(e):
        """Handle 404 errors."""
        logger.warning(f'404 Not Found: {request.path}')
        return error_response('Recurso no encontrado', 404)

    @app.errorhandler(405)
    def method_not_allowed(e):
        """Handle 405 errors."""
        logger.warning(f'405 Method Not Allowed: {request.method} {request.path}')
        return error_response('Método no permitido', 405)

    @app.errorhandler(500)
    def internal_error(e):
        """Handle 500 errors."""
        logger.error(f'500 Internal Server Error: {str(e)}')
        db.session.rollback()
        return error_response('Error interno del servidor', 500)

    # ──────────────────────────────────────────────────────────────────────
    # HEALTH CHECK ENDPOINT
    # ──────────────────────────────────────────────────────────────────────

    @app.route('/api/health', methods=['GET'])
    def health_check():
        """Health check endpoint for monitoring - includes DB status."""
        import os as _os
        db_configured = bool(_os.getenv('DATABASE_URL'))
        try:
            from sqlalchemy import text as _text
            db.session.execute(_text('SELECT 1'))
            db_status = 'connected'
        except Exception as _e:
            db_status = f'error: {str(_e)[:80]}'
        return jsonify({
            'status': 'healthy',
            'timestamp': time.strftime('%Y-%m-%d %H:%M:%S'),
            'database': db_status,
            'db_configured': db_configured
        })

    return app, logger, socketio


# ═══════════════════════════════════════════════════════════════════════════
# GLOBAL STATE (only initialized on demand)
# ═══════════════════════════════════════════════════════════════════════════

_app_instance = None
_logger_instance = None
_socketio_instance = None
_initialized = False


def _initialize_app():
    """Initialize the application (called once, on first use)."""
    global _app_instance, _logger_instance, _socketio_instance, _initialized

    if _initialized:
        return _app_instance, _logger_instance, _socketio_instance

    _app_instance, _logger_instance, _socketio_instance = create_app()

    # ─── Register blueprints (after app is created) ──────────────────────
    from routes.api import api
    from routes.whatsapp import whatsapp_bp
    _app_instance.register_blueprint(api)
    _app_instance.register_blueprint(whatsapp_bp)

    # ─── Register main routes ────────────────────────────────────────────
    WHATSAPP_NUMBER = os.getenv('WHATSAPP_NUMBER', '689135630')

    @_app_instance.route('/')
    def index():
        """Main dashboard page."""
        return render_template('index.html', whatsapp_number=WHATSAPP_NUMBER)

    @_app_instance.route('/reservar')
    def public_booking():
        """Public booking page."""
        return render_template('public_booking.html', whatsapp_number=WHATSAPP_NUMBER)

    # ─── Register SocketIO handlers ──────────────────────────────────────
    @_socketio_instance.on('connect')
    def handle_connect():
        """Handle WebSocket connection."""
        emit('connected', {'status': 'ok'})
        _logger_instance.info(f'Client connected: {request.sid}')

    @_socketio_instance.on('disconnect')
    def handle_disconnect():
        """Handle WebSocket disconnection."""
        _logger_instance.info(f'Client disconnected: {request.sid}')

    # ─── Database initialization on first request ────────────────────────
    _db_initialized = [False]  # Use list to allow mutation in nested function

    _db_init_error = [None]  # Track DB init error for helpful responses

    def init_db():
        """Initialize database if not already initialized."""
        if _db_initialized[0]:
            return

        try:
            with _app_instance.app_context():
                from models import Table
                db.create_all()
                if Table.query.count() == 0:
                    for t in DEFAULT_TABLES:
                        db.session.add(Table(**t))
                    db.session.commit()
                    _logger_instance.info(f'✅ Initialized {len(DEFAULT_TABLES)} restaurant tables')
                else:
                    _logger_instance.info(f'⚠️  Tables already exist ({Table.query.count()})')
                _db_initialized[0] = True
                _db_init_error[0] = None
        except Exception as e:
            err_msg = str(e)
            _logger_instance.error(f'❌ Database init error: {err_msg}')
            _db_init_error[0] = err_msg

    @_app_instance.before_request
    def before_request_handler():
        """Before request handler - initialize DB and handle errors."""
        from flask import request as flask_request, jsonify
        # Skip health check - it should always work
        if flask_request.path == '/api/health':
            return
        init_db()
        if not _db_initialized[0] and _db_init_error[0]:
            _logger_instance.error(f'DB not ready: {_db_init_error[0]}')

    _initialized = True
    return _app_instance, _logger_instance, _socketio_instance


# ═══════════════════════════════════════════════════════════════════════════
# IN-MEMORY CACHE (Simple TTL-based cache)
# ═══════════════════════════════════════════════════════════════════════════

_cache = {}
_cache_version = 0

def cache_get(key, max_age=2):
    """Get cached value if fresh (default 2s)."""
    entry = _cache.get(key)
    if entry and (time.time() - entry['ts']) < max_age:
        return entry['data']
    return None

def cache_set(key, data):
    """Set cache value with timestamp."""
    _cache[key] = {'data': data, 'ts': time.time()}

def cache_invalidate():
    """Clear all cache."""
    global _cache_version
    _cache_version += 1
    _cache.clear()


def broadcast_update(event_type='reservation_changed'):
    """Broadcast update to all connected clients."""
    try:
        cache_invalidate()
        _app, _logger, _socketio = _initialize_app()
        _socketio.emit(event_type, {'ts': time.time()})
        _logger.debug(f'Broadcasted {event_type}')
    except Exception as e:
        if _logger_instance:
            _logger_instance.warning(f'Broadcast failed: {str(e)}')


# ═══════════════════════════════════════════════════════════════════════════
# LAZY APP WRAPPER (for gunicorn WSGI)
# ═══════════════════════════════════════════════════════════════════════════

class LazyFlaskApp:
    """WSGI wrapper that defers Flask app initialization to first request."""

    def __call__(self, environ, start_response):
        """WSGI callable - initialize app on first call."""
        global _app_instance
        if _app_instance is None:
            _initialize_app()
        # Delegate to the real Flask app
        return _app_instance(environ, start_response)

    def __getattr__(self, name):
        """Proxy attribute access to the real app."""
        if _app_instance is None:
            _initialize_app()
        return getattr(_app_instance, name)


# ═══════════════════════════════════════════════════════════════════════════
# GUNICORN ENTRY POINT (lazy initialization)
# ═══════════════════════════════════════════════════════════════════════════

# This is what gunicorn looks for: 'app:app'
# We use a wrapper that defers initialization
app = LazyFlaskApp()

# Also provide global references for parts of code that might need them
def get_app():
    """Get the initialized app instance."""
    if _app_instance is None:
        _initialize_app()
    return _app_instance

def get_logger():
    """Get the logger instance."""
    if _app_instance is None:
        _initialize_app()
    return _logger_instance

def get_socketio():
    """Get the socketio instance."""
    if _app_instance is None:
        _initialize_app()
    return _socketio_instance


# ═══════════════════════════════════════════════════════════════════════════
# APPLICATION ENTRY POINT (for local development)
# ═══════════════════════════════════════════════════════════════════════════

if __name__ == '__main__':
    _initialize_app()
    app_instance, logger, socketio = _app_instance, _logger_instance, _socketio_instance
    port = int(os.getenv('PORT', 3000))
    debug = os.getenv('FLASK_ENV') == 'development'
    socketio.run(
        app_instance,
        debug=debug,
        host='0.0.0.0',
        port=port,
        allow_unsafe_werkzeug=True
    )
