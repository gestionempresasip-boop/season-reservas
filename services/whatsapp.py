import json
import os
from datetime import date, datetime, timedelta
from models import db, WhatsappSession
from services.reservation import create_reservation, find_available_tables


STEPS = ['start', 'date', 'shift', 'time', 'guests', 'name', 'confirm']


def get_or_create_session(phone):
    session = WhatsappSession.query.filter_by(phone=phone).first()
    if not session:
        session = WhatsappSession(phone=phone, step='start', data='{}')
        db.session.add(session)
        db.session.commit()
    return session


def reset_session(phone):
    session = WhatsappSession.query.filter_by(phone=phone).first()
    if session:
        session.step = 'start'
        session.data = '{}'
        db.session.commit()


def process_message(phone, message):
    session = get_or_create_session(phone)
    data = json.loads(session.data) if session.data else {}
    msg = message.strip().lower()

    if msg in ['cancelar', 'salir', 'cancel']:
        reset_session(phone)
        return "Reserva cancelada. Escribe *RESERVAR* cuando quieras hacer una nueva reserva."

    if session.step == 'start':
        if 'reservar' in msg or 'reserva' in msg or 'mesa' in msg or msg == 'hola':
            session.step = 'date'
            session.data = '{}'
            db.session.commit()
            today = date.today()
            tomorrow = today + timedelta(days=1)
            return (
                f"Bienvenido a *Season* \U0001f33f\n\n"
                f"Vamos a hacer tu reserva.\n\n"
                f"\U0001f4c5 *Elige la fecha:*\n"
                f"1. Hoy ({today.strftime('%d/%m')})\n"
                f"2. Mañana ({tomorrow.strftime('%d/%m')})\n"
                f"3. Escribe la fecha (dd/mm)"
            )
        return (
            "Hola! Bienvenido a *Season* \U0001f33f\n\n"
            "Escribe *RESERVAR* para hacer una reserva.\n"
            "Escribe *CANCELAR* en cualquier momento para salir."
        )

    if session.step == 'date':
        today = date.today()
        if msg == '1' or msg == 'hoy':
            data['date'] = today.isoformat()
        elif msg == '2' or 'mañana' in msg:
            data['date'] = (today + timedelta(days=1)).isoformat()
        else:
            try:
                parts = message.strip().replace('-', '/').split('/')
                day, month = int(parts[0]), int(parts[1])
                year = int(parts[2]) if len(parts) > 2 else today.year
                parsed = date(year, month, day)
                if parsed < today:
                    return "La fecha no puede ser anterior a hoy. Inténtalo de nuevo."
                data['date'] = parsed.isoformat()
            except (ValueError, IndexError):
                return "No he entendido la fecha. Escribe en formato *dd/mm* o elige 1 (hoy) o 2 (mañana)."

        session.step = 'shift'
        session.data = json.dumps(data)
        db.session.commit()
        return (
            "\U0001f55b *Elige el turno:*\n\n"
            "1. \U0001f31e Comida (13:00 - 16:00)\n"
            "2. \U0001f319 Cena (19:00 - 23:00)"
        )

    if session.step == 'shift':
        if msg in ['1', 'comida', 'mediodia']:
            data['shift'] = 'comida'
        elif msg in ['2', 'cena', 'noche']:
            data['shift'] = 'cena'
        else:
            return "Elige *1* para Comida o *2* para Cena."

        session.step = 'time'
        session.data = json.dumps(data)
        db.session.commit()
        if data['shift'] == 'comida':
            return (
                "\U0001f550 *Hora de la reserva:*\n\n"
                "1. 13:00\n2. 13:30\n3. 14:00\n4. 14:30\n5. 15:00\n\n"
                "O escribe la hora directamente (ej: 13:45)"
            )
        return (
            "\U0001f550 *Hora de la reserva:*\n\n"
            "1. 19:00\n2. 19:30\n3. 20:00\n4. 20:30\n5. 21:00\n6. 21:30\n7. 22:00\n\n"
            "O escribe la hora directamente (ej: 20:15)"
        )

    if session.step == 'time':
        comida_times = {'1': '13:00', '2': '13:30', '3': '14:00', '4': '14:30', '5': '15:00'}
        cena_times = {'1': '19:00', '2': '19:30', '3': '20:00', '4': '20:30', '5': '21:00', '6': '21:30', '7': '22:00'}
        times = comida_times if data.get('shift') == 'comida' else cena_times

        if msg in times:
            data['time'] = times[msg]
        elif ':' in message.strip():
            data['time'] = message.strip()
        else:
            return "No he entendido la hora. Elige un número o escribe la hora (ej: 14:00)."

        session.step = 'guests'
        session.data = json.dumps(data)
        db.session.commit()
        return "\U0001f465 *Número de comensales:*\n\nEscribe el número de personas."

    if session.step == 'guests':
        try:
            guests = int(msg)
            if guests < 1 or guests > 20:
                return "El número de comensales debe estar entre 1 y 20."
            data['guests'] = guests
        except ValueError:
            return "Escribe un número válido de comensales."

        target_date = date.fromisoformat(data['date'])
        available = find_available_tables(target_date, data['shift'], guests)
        if not available:
            session.step = 'start'
            session.data = '{}'
            db.session.commit()
            return (
                "Lo sentimos, no hay mesas disponibles para ese número de comensales "
                "en la fecha y turno seleccionados.\n\n"
                "Escribe *RESERVAR* para intentar con otra fecha u horario."
            )

        data['suggested_table'] = available[0].id
        data['suggested_table_number'] = available[0].number
        data['suggested_table_zone'] = available[0].zone

        session.step = 'name'
        session.data = json.dumps(data)
        db.session.commit()
        return "\U0001f464 *Nombre para la reserva:*\n\nEscribe tu nombre completo."

    if session.step == 'name':
        if len(message.strip()) < 2:
            return "Por favor, escribe un nombre válido."
        data['name'] = message.strip()
        session.step = 'confirm'
        session.data = json.dumps(data)
        db.session.commit()

        fecha = date.fromisoformat(data['date']).strftime('%d/%m/%Y')
        turno = 'Comida \U0001f31e' if data['shift'] == 'comida' else 'Cena \U0001f319'
        return (
            f"\U0001f4cb *Resumen de tu reserva:*\n\n"
            f"\U0001f464 {data['name']}\n"
            f"\U0001f4c5 {fecha}\n"
            f"\U0001f55b {data['time']}\n"
            f"\U0001f37d {turno}\n"
            f"\U0001f465 {data['guests']} personas\n"
            f"\U0001f4cd Mesa {data.get('suggested_table_number', '-')} "
            f"({data.get('suggested_table_zone', '')})\n\n"
            f"Escribe *SI* para confirmar o *CANCELAR* para anular."
        )

    if session.step == 'confirm':
        if msg in ['si', 'sí', 'yes', 'ok', 'confirmar', 'confirmo']:
            reservation = create_reservation({
                'client_name': data['name'],
                'client_phone': phone,
                'date': data['date'],
                'shift': data['shift'],
                'time': data['time'],
                'guests': data['guests'],
                'table_id': data.get('suggested_table'),
                'source': 'whatsapp',
            })
            reset_session(phone)
            fecha = date.fromisoformat(data['date']).strftime('%d/%m/%Y')
            return (
                f"✅ *Reserva confirmada!*\n\n"
                f"Reserva #{reservation.id}\n"
                f"\U0001f464 {data['name']}\n"
                f"\U0001f4c5 {fecha} a las {data['time']}\n"
                f"\U0001f465 {data['guests']} personas\n\n"
                f"Te esperamos en *Season*! \U0001f33f\n\n"
                f"Para cancelar, llámanos al restaurante."
            )
        elif msg in ['no', 'cancelar']:
            reset_session(phone)
            return "Reserva cancelada. Escribe *RESERVAR* cuando quieras intentarlo de nuevo."
        else:
            return "Escribe *SI* para confirmar o *CANCELAR* para anular la reserva."

    reset_session(phone)
    return "Escribe *RESERVAR* para hacer una nueva reserva."
