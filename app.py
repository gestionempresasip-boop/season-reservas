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

    # Database configuration: PostgreSQL in production, SQLite allowed locally
    db_url = os.getenv('DATABASE_URL')
    is_production = os.getenv('FLASK_ENV') == 'production' or os.getenv('RENDER')

    if not db_url:
        if is_production:
            raise ValueError(
                'DATABASE_URL environment variable is required. '
                'Please set it to your Supabase PostgreSQL URL.'
            )
        # Local dev fallback
        db_url = 'sqlite:///season_local.db'

    if db_url.startswith('sqlite'):
        if is_production:
            raise ValueError('SQLite is not allowed in production. Use PostgreSQL.')
        app.config['SQLALCHEMY_DATABASE_URI'] = db_url
    else:
        # Ensure SQLAlchemy-compatible PostgreSQL format
        if db_url.startswith('postgres://'):
            db_url = db_url.replace('postgres://', 'postgresql+psycopg2://', 1)
        elif db_url.startswith('postgresql://'):
            db_url = db_url.replace('postgresql://', 'postgresql+psycopg2://', 1)
        app.config['SQLALCHEMY_DATABASE_URI'] = db_url

    # ──────────────────────────────────────────────────────────────────────
    # SESSION CONFIGURATION
    # ──────────────────────────────────────────────────────────────────────
    from datetime import timedelta
    app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=30)
    app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
    app.config['SESSION_COOKIE_HTTPONLY'] = True

    # ──────────────────────────────────────────────────────────────────────
    # LOGGING SETUP
    # ──────────────────────────────────────────────────────────────────────

    logger = setup_logging(app)
    logger.info('✅ Application initialized')
    logger.info(f'✅ Environment: {os.getenv("FLASK_ENV", "development")}')
    logger.info(f'✅ Database: {app.config["SQLALCHEMY_DATABASE_URI"][:30]}...')

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
    # Cache static files for 1 year (safe because CSS/JS use ?v=XX versioned URLs)
    app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 31536000

    socketio = SocketIO(
        app,
        cors_allowed_origins='*',
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
    from routes.auth import auth_bp
    _app_instance.register_blueprint(api)
    _app_instance.register_blueprint(whatsapp_bp)
    _app_instance.register_blueprint(auth_bp)

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

    @_app_instance.route('/reservas')
    def public_reservas():
        """New public booking page (v2)."""
        return render_template('reservas.html', whatsapp_number=WHATSAPP_NUMBER)

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
                from models import Table, AppSetting
                from sqlalchemy import text as _text
                db.create_all()

                # ─── Column migrations ───
                for sql in [
                    'ALTER TABLE reservations ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 120',
                    'ALTER TABLE tables ADD COLUMN IF NOT EXISTS blocked BOOLEAN DEFAULT FALSE',
                ]:
                    try:
                        db.session.execute(_text(sql))
                        db.session.commit()
                    except Exception as _mig_e:
                        db.session.rollback()
                        _logger_instance.warning(f'⚠️ Migration warning: {_mig_e}')

                # Seed default settings if not present
                if not AppSetting.get('web_capacity_limit'):
                    AppSetting.set('web_capacity_limit', '30')

                if Table.query.count() == 0:
                    for t in DEFAULT_TABLES:
                        db.session.add(Table(**t))
                    db.session.commit()
                    _logger_instance.info(f'✅ Initialized {len(DEFAULT_TABLES)} restaurant tables')
                else:
                    _logger_instance.info(f'⚠️  Tables already exist ({Table.query.count()})')

                # ─── Plano Jul-2026: sync Python-level (runs always) ─────
                try:
                    mesa_82 = Table.query.filter_by(number=82).first()
                    mesa_32 = Table.query.filter_by(number=32).first()
                    if mesa_82 and not mesa_32:
                        # Rename 82 → 32
                        mesa_82.number = 32
                        db.session.commit()
                        _logger_instance.info('✅ Mesa 82 renombrada a 32')
                    elif mesa_82 and mesa_32:
                        # Ambas existen — eliminar duplicado 82
                        db.session.delete(mesa_82)
                        db.session.commit()
                        _logger_instance.info('✅ Duplicado mesa 82 eliminado (ya existe 32)')

                    for num, cap in {3: 2, 18: 4}.items():
                        t = Table.query.filter_by(number=num).first()
                        if t and t.capacity != cap:
                            t.capacity = cap
                            _logger_instance.info(f'✅ Mesa {num} capacidad → {cap}p')
                    db.session.commit()
                except Exception as _sync_e:
                    db.session.rollback()
                    _logger_instance.warning(f'⚠️ Sync plano: {_sync_e}')

                # Create default admin user if no users exist
                from models import User
                if User.query.count() == 0:
                    admin = User(name='Administrador', username='admin', role='admin')
                    admin.set_password('admin1234')
                    db.session.add(admin)
                    db.session.commit()
                    _logger_instance.info('✅ Created default admin user (admin / admin1234)')
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

def cache_invalidate(date_str=None, shift=None):
    """Clear cache. If date_str+shift given, only clear relevant keys; else clear all."""
    global _cache_version
    _cache_version += 1
    if date_str and shift:
        # Only evict keys that contain this date and shift (fast path)
        keys_to_drop = [k for k in list(_cache.keys()) if date_str in k and shift in k]
        # Also drop keys that don't depend on shift (reports, unassigned)
        keys_to_drop += [k for k in list(_cache.keys()) if k.startswith(('reports', 'unassigned'))]
        for k in keys_to_drop:
            _cache.pop(k, None)
    else:
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
    run_kwargs = dict(debug=debug, host='0.0.0.0', port=port)
    try:
        socketio.run(app_instance, allow_unsafe_werkzeug=True, **run_kwargs)
    except TypeError:
        socketio.run(app_instance, **run_kwargs)
