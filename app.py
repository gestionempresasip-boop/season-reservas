import os
import logging
from flask import Flask, render_template, request
from flask_cors import CORS
from flask_socketio import SocketIO, emit
from dotenv import load_dotenv
from models import db

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-secret-key')

# Database: use /tmp on Render (writable), fallback to local
db_url = os.getenv('DATABASE_URL', 'sqlite:///season_reservas.db')
if os.getenv('RENDER') or os.getenv('FLASK_ENV') == 'production':
    db_url = 'sqlite:////tmp/season_reservas.db'
app.config['SQLALCHEMY_DATABASE_URI'] = db_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

WHATSAPP_NUMBER = os.getenv('WHATSAPP_NUMBER', '689135630')
app.config['WHATSAPP_NUMBER'] = WHATSAPP_NUMBER

CORS(app)
db.init_app(app)
socketio = SocketIO(app, cors_allowed_origins='*',
                   transport=['polling'],
                   engineio_logger=False, socketio_logger=False)

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
        socketio.emit(event_type, {'ts': __import__('time').time()})
    except Exception as e:
        logger.warning(f'broadcast_update failed: {e}')


try:
    with app.app_context():
        db.create_all()
        logger.info('Database tables created OK')
        # Initialize restaurant tables if empty (needed on Render where /tmp is fresh)
        from models import Table
        if Table.query.count() == 0:
            from init_db import TABLES
            for t in TABLES:
                db.session.add(Table(**t))
            db.session.commit()
            logger.info(f'Initialized {len(TABLES)} restaurant tables')
        else:
            logger.info(f'Tables already exist ({Table.query.count()})')
except Exception as e:
    logger.error(f'Database init error: {e}')


if __name__ == '__main__':
    port = int(os.getenv('PORT', 3000))
    debug = os.getenv('FLASK_ENV') == 'development'
    socketio.run(app, debug=debug, host='0.0.0.0', port=port, allow_unsafe_werkzeug=True)
