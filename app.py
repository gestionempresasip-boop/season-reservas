import os
import time
import logging
from flask import Flask, render_template, request
from flask_cors import CORS
from flask_socketio import SocketIO, emit
from flask_compress import Compress
from dotenv import load_dotenv
from models import db

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-secret-key')

# Database: Try Supabase PostgreSQL, fall back to SQLite
# This allows the app to build even if Supabase isn't accessible,
# and use SQLite as a fallback if PostgreSQL fails at runtime
db_url = os.getenv('DATABASE_URL', '')

if db_url and db_url.startswith('postgresql://'):
    # Use Supabase PostgreSQL if DATABASE_URL is configured
    db_url = db_url.replace('postgresql://', 'postgresql+psycopg2://', 1)
    app.config['SQLALCHEMY_DATABASE_URI'] = db_url
    logger.info('Using Supabase PostgreSQL for database')
else:
    # Fall back to SQLite if DATABASE_URL is not set or invalid
    db_url = 'sqlite:////tmp/season_reservas.db'
    app.config['SQLALCHEMY_DATABASE_URI'] = db_url
    logger.info('Using SQLite fallback database')

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


DEFAULT_TABLES = [
    {'number': 50, 'zone': 'exterior', 'capacity': 2, 'table_type': 'normal', 'pos_x': 33, 'pos_y': 8},
    {'number': 52, 'zone': 'exterior', 'capacity': 2, 'table_type': 'normal', 'pos_x': 43, 'pos_y': 8},
    {'number': 54, 'zone': 'exterior', 'capacity': 2, 'table_type': 'normal', 'pos_x': 53, 'pos_y': 8},
    {'number': 56, 'zone': 'exterior', 'capacity': 2, 'table_type': 'normal', 'pos_x': 63, 'pos_y': 8},
    {'number': 58, 'zone': 'exterior', 'capacity': 2, 'table_type': 'normal', 'pos_x': 73, 'pos_y': 12},
    {'number': 60, 'zone': 'exterior', 'capacity': 4, 'table_type': 'normal', 'pos_x': 53, 'pos_y': 20},
    {'number': 62, 'zone': 'exterior', 'capacity': 4, 'table_type': 'normal', 'pos_x': 38, 'pos_y': 20},
    {'number': 70, 'zone': 'exterior', 'capacity': 2, 'table_type': 'alta', 'pos_x': 18, 'pos_y': 14},
    {'number': 1, 'zone': 'salon_principal', 'capacity': 4, 'table_type': 'normal', 'pos_x': 10, 'pos_y': 36},
    {'number': 2, 'zone': 'salon_principal', 'capacity': 2, 'table_type': 'normal', 'pos_x': 22, 'pos_y': 36},
    {'number': 3, 'zone': 'salon_principal', 'capacity': 6, 'table_type': 'normal', 'pos_x': 35, 'pos_y': 36},
    {'number': 6, 'zone': 'salon_principal', 'capacity': 4, 'table_type': 'normal', 'pos_x': 10, 'pos_y': 47},
    {'number': 4, 'zone': 'salon_principal', 'capacity': 4, 'table_type': 'normal', 'pos_x': 25, 'pos_y': 47},
    {'number': 7, 'zone': 'salon_principal', 'capacity': 4, 'table_type': 'normal', 'pos_x': 8, 'pos_y': 58},
    {'number': 8, 'zone': 'salon_principal', 'capacity': 4, 'table_type': 'normal', 'pos_x': 20, 'pos_y': 58},
    {'number': 9, 'zone': 'salon_principal', 'capacity': 2, 'table_type': 'normal', 'pos_x': 32, 'pos_y': 58},
    {'number': 10, 'zone': 'salon_principal', 'capacity': 2, 'table_type': 'normal', 'pos_x': 42, 'pos_y': 58},
    {'number': 14, 'zone': 'salon_principal', 'capacity': 4, 'table_type': 'normal', 'pos_x': 8, 'pos_y': 69},
    {'number': 12, 'zone': 'salon_principal', 'capacity': 4, 'table_type': 'normal', 'pos_x': 22, 'pos_y': 69},
    {'number': 11, 'zone': 'salon_principal', 'capacity': 2, 'table_type': 'normal', 'pos_x': 35, 'pos_y': 69},
    {'number': 15, 'zone': 'salon_principal', 'capacity': 4, 'table_type': 'normal', 'pos_x': 10, 'pos_y': 80},
    {'number': 16, 'zone': 'salon_principal', 'capacity': 4, 'table_type': 'normal', 'pos_x': 23, 'pos_y': 80},
    {'number': 17, 'zone': 'salon_principal', 'capacity': 4, 'table_type': 'normal', 'pos_x': 36, 'pos_y': 80},
    {'number': 22, 'zone': 'salon_principal', 'capacity': 4, 'table_type': 'normal', 'pos_x': 8, 'pos_y': 91},
    {'number': 20, 'zone': 'salon_principal', 'capacity': 4, 'table_type': 'normal', 'pos_x': 22, 'pos_y': 91},
    {'number': 19, 'zone': 'salon_principal', 'capacity': 2, 'table_type': 'normal', 'pos_x': 35, 'pos_y': 91},
    {'number': 18, 'zone': 'salon_principal', 'capacity': 6, 'table_type': 'normal', 'pos_x': 46, 'pos_y': 91},
    {'number': 30, 'zone': 'salon_interior', 'capacity': 4, 'table_type': 'normal', 'pos_x': 62, 'pos_y': 36},
    {'number': 82, 'zone': 'salon_interior', 'capacity': 4, 'table_type': 'normal', 'pos_x': 75, 'pos_y': 36},
    {'number': 34, 'zone': 'salon_interior', 'capacity': 4, 'table_type': 'normal', 'pos_x': 65, 'pos_y': 50},
    {'number': 36, 'zone': 'salon_interior', 'capacity': 4, 'table_type': 'normal', 'pos_x': 68, 'pos_y': 66},
    {'number': 40, 'zone': 'salon_interior', 'capacity': 8, 'table_type': 'alta', 'pos_x': 75, 'pos_y': 85},
]

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
