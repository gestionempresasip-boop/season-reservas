import os
from flask import Blueprint, request, Response
from services.whatsapp import process_message

whatsapp_bp = Blueprint('whatsapp', __name__, url_prefix='/api/whatsapp')


@whatsapp_bp.route('/webhook', methods=['GET'])
def verify():
    return Response(status=200)


@whatsapp_bp.route('/webhook', methods=['POST'])
def incoming_message():
    from_number = request.form.get('From', '').replace('whatsapp:', '')
    body = request.form.get('Body', '')

    if not from_number or not body:
        return Response(status=400)

    reply = process_message(from_number, body)

    twiml = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<Response><Message>' + reply + '</Message></Response>'
    )
    return Response(twiml, mimetype='application/xml')


@whatsapp_bp.route('/test', methods=['POST'])
def test_message():
    data = request.json
    phone = data.get('phone', '+34600000000')
    message = data.get('message', '')
    reply = process_message(phone, message)
    return {'reply': reply}
