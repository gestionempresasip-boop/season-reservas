import os
import time
import logging
from flask import Flask, render_template, request
from flask_cors import CORS
from flask_socketio import SocketIO, emit
from flask_compress import Compress
from dotenv import load_dotenv
from models import db
from config import get_config
from config.tables import DEFAULT_TABLES

load_dotenv()

# Get configuration
app = Flask(__name__)
config = get_config()
app.config.from_object(config)

# Database - PostgreSQL required (no fallback)
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

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
logger.info('✅ Using PostgreSQL for database')

app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

WHATSAPP_NUMBER = os.getenv('WHATSAPP_NUMBER', '689135630')
app.config['WHATSAPP_NUMBER'] = WHATSAPP_NUMBER

CORS(app)
Compress(app)
app.config['COMPRESS_MIMETYPES'] = ['application/json', 'text/html', 'text/css', 'application/javascript']
app.config['COMPRESS_MIN_SIZE'] = 200

try:
    db.init_app(app)
except Exception as e:
    logger.warning(f'Failed to initialize database: {e}. Database will be initialized on first request.')
socketio = SocketIO(app, cors_allowed_origins='*',
                   transport=['polling'],
                   engineio_logger=False, socketio_logger=False)

# ── In-memory cache ──────────────────────────────
_cache = {}
_cache_version = 0

def cache_get(key, max_age=2):
    """Get cached value if fresh (default 2s)."""
    entry = _cache.get(key)
    if entry and (time.time() - entry['ts']) < max_age:
        return entry['data']
    return None

def cache_set(key, data):
    _cache[key] = {'data': data, 'ts': time.time()}

def cache_invalidate():
    global _cache_version
    _cache_version += 1
    _cache.clear()

from routes.api import api
from routes.whatsapp import whatsapp_bp
app.register_blueprint(api)
app.register_blueprint(whatsapp_bp)


@app.route('/')
def index():
    return render_template('index.html', whatsapp_number=WHATSAPP_NUMBER)


@app.route('/reservar')
def public_booking():
    return render_template('public_booking.html', whatsapp_number=WHATSAPP_NUMBER)


@socketio.on('connect')
def handle_connect():
    emit('connected', {'status': 'ok'})


def broadcast_update(event_type='reservation_changed'):
    try:
        cache_invalidate()
        socketio.emit(event_type, {'ts': time.time()})
    except Exception as e:
        logger.warning(f'broadcast_update failed: {e}')


# Table definitions are imported from config.tables (single source of truth)

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
                logger.info(f'Initialized {len(DEFAULT_TABLES)} restaurant tables')
            else:
                logger.info(f'Tables already exist ({Table.query.count()})')
            _db_initialized = True
    except Exception as e:
        logger.error(f'Database init error: {e}')

# Initialize database on first request
@app.before_request
def before_request_handler():
    init_db()


if __name__ == '__main__':
    port = int(os.getenv('PORT', 3000))
    debug = os.getenv('FLASK_ENV') == 'development'
    socketio.run(app, debug=debug, host='0.0.0.0', port=port, allow_unsafe_werkzeug=True)
