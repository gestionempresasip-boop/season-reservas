import os
from flask import Flask, render_template, request
from flask_cors import CORS
from flask_socketio import SocketIO, emit
from dotenv import load_dotenv
from models import db

load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-secret-key')
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///season_reservas.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

WHATSAPP_NUMBER = os.getenv('WHATSAPP_NUMBER', '689135630')
app.config['WHATSAPP_NUMBER'] = WHATSAPP_NUMBER

CORS(app)
db.init_app(app)
socketio = SocketIO(app, cors_allowed_origins='*', async_mode='threading',
                   transport=['websocket', 'polling'],
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
    socketio.emit(event_type, {'ts': __import__('time').time()})


with app.app_context():
    db.create_all()


if __name__ == '__main__':
    port = int(os.getenv('PORT', 3000))
    debug = os.getenv('FLASK_ENV') == 'development'
    socketio.run(app, debug=debug, host='0.0.0.0', port=port, allow_unsafe_werkzeug=True)
