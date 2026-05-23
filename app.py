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

    # Ensure PostgreSQL format
    if db_url.startswith('postgresql://'):
        db_url = db_url.replace('postgresql://', 'postgresql+psycopg2://', 1)
    elif not db_url.startswith('postgresql+psycopg2://'):
        raise ValueError(
            'DATABASE_URL must be a PostgreSQL URL. '
            'SQLite fallback is no longer supported.'
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
        """Health check endpoint for monitoring."""
        return jsonify({
            'status': 'healthy',
            'timestamp': time.strftime('%Y-%m-%d %H:%M:%S')
        })

    return app, logger, socketio


# Create application instance
app, logger, socketio = create_app()

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

# ═══════════════════════════════════════════════════════════════════════════
# BLUEPRINTS REGISTRATION
# ═══════════════════════════════════════════════════════════════════════════

from routes.api import api
from routes.whatsapp import whatsapp_bp
app.register_blueprint(api)
app.register_blueprint(whatsapp_bp)

# ═══════════════════════════════════════════════════════════════════════════
# MAIN ROUTES
# ═══════════════════════════════════════════════════════════════════════════

WHATSAPP_NUMBER = os.getenv('WHATSAPP_NUMBER', '689135630')

@app.route('/')
def index():
    """Main dashboard page."""
    return render_template('index.html', whatsapp_number=WHATSAPP_NUMBER)

@app.route('/reservar')
def public_booking():
    """Public booking page."""
    return render_template('public_booking.html', whatsapp_number=WHATSAPP_NUMBER)

# ═══════════════════════════════════════════════════════════════════════════
# SOCKETIO HANDLERS
# ═══════════════════════════════════════════════════════════════════════════

@socketio.on('connect')
def handle_connect():
    """Handle WebSocket connection."""
    emit('connected', {'status': 'ok'})
    logger.info(f'Client connected: {request.sid}')

@socketio.on('disconnect')
def handle_disconnect():
    """Handle WebSocket disconnection."""
    logger.info(f'Client disconnected: {request.sid}')

def broadcast_update(event_type='reservation_changed'):
    """Broadcast update to all connected clients."""
    try:
        cache_invalidate()
        socketio.emit(event_type, {'ts': time.time()})
        logger.debug(f'Broadcasted {event_type}')
    except Exception as e:
        logger.warning(f'Broadcast failed: {str(e)}')

# ═══════════════════════════════════════════════════════════════════════════
# DATABASE INITIALIZATION
# ═══════════════════════════════════════════════════════════════════════════

_db_initialized = False

def init_db():
    """Initialize database if not already initialized."""
    global _db_initialized
    if _db_initialized:
        return

    try:
        with app.app_context():
            from models import Table
            db.create_all()
            if Table.query.count() == 0:
                for t in DEFAULT_TABLES:
                    db.session.add(Table(**t))
                db.session.commit()
                logger.info(f'✅ Initialized {len(DEFAULT_TABLES)} restaurant tables')
            else:
                logger.info(f'⚠️  Tables already exist ({Table.query.count()})')
            _db_initialized = True
    except Exception as e:
        logger.error(f'❌ Database init error: {str(e)}')

# Initialize database on first request
@app.before_request
def before_request_handler():
    """Before request handler."""
    init_db()

# ═══════════════════════════════════════════════════════════════════════════
# APPLICATION ENTRY POINT
# ═══════════════════════════════════════════════════════════════════════════

if __name__ == '__main__':
    port = int(os.getenv('PORT', 3000))
    debug = os.getenv('FLASK_ENV') == 'development'
    socketio.run(
        app,
        debug=debug,
        host='0.0.0.0',
        port=port,
        allow_unsafe_werkzeug=True
    )
