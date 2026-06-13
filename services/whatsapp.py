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

    # Cancelar en cualquier paso
    if msg in ['cancelar', 'salir', 'cancel', 'stop']:
        reset_session(phone)
        return "Reserva cancelada. Escribe *RESERVAR* cuando quieras hacer una nueva reserva."

    # RESERVAR reinicia siempre, desde cualquier paso
    is_reservar = 'reservar' in msg or msg in ['reserva', 'mesa', 'hola', 'inicio', 'start', 'menu', 'menú']
    if is_reservar and session.step != 'start':
        reset_session(phone)
        session = get_or_create_session(phone)
        data = {}

    # Auto-reset si la sesión tiene una fecha pasada (sesión caducada)
    if session.step not in ('start', 'date') and data.get('date'):
        try:
            stored_date = date.fromisoformat(data['date'])
            if stored_date < date.today():
                reset_session(phone)
                session = get_or_create_session(phone)
                data = {}
                return (
                    "⚠️ Tu sesión anterior ha caducado (la fecha ya pasó).\n\n"
                    "Escribe *RESERVAR* para empezar de nuevo."
                )
        except (ValueError, KeyError):
            pass

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
        all_free = find_available_tables(target_date, data['shift'], guests)

        # Filter: only tables where capacity + 2 extra chairs can seat the guests
        fitting = [t for t in all_free if t.capacity + 2 >= guests]
        # Sort: prefer tables that fit without extras first, then by closest capacity
        fitting.sort(key=lambda t: (0 if t.capacity >= guests else 1, abs(t.capacity - guests)))

        if not fitting:
            session.step = 'start'
            session.data = '{}'
            db.session.commit()
            return (
                f"Lo sentimos, no hay ninguna mesa disponible para {guests} comensales "
                f"en ese turno.\n\n"
                f"Prueba con otra fecha u horario, o llámanos directamente.\n\n"
                f"Escribe *RESERVAR* para intentarlo de nuevo."
            )

        best = fitting[0]
        data['suggested_table'] = best.id
        data['suggested_table_number'] = best.number
        data['suggested_table_zone'] = best.zone

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
            try:
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
            except ValueError as e:
                reset_session(phone)
                return (
                    f"❌ No se pudo crear la reserva: {str(e)}\n\n"
                    f"Escribe *RESERVAR* para intentarlo de nuevo."
                )
            except Exception:
                reset_session(phone)
                return (
                    "❌ Hubo un error al crear la reserva. Por favor inténtalo de nuevo.\n\n"
                    "Escribe *RESERVAR* para empezar."
                )
        elif msg in ['no', 'cancelar']:
            reset_session(phone)
            return "Reserva cancelada. Escribe *RESERVAR* cuando quieras intentarlo de nuevo."
        else:
            return "Escribe *SI* para confirmar o *CANCELAR* para anular la reserva."

    reset_session(phone)
    return "Escribe *RESERVAR* para hacer una nueva reserva."


def send_confirmation_whatsapp(to_phone, name, date_str, shift, time_str, guests, notes=''):
    """Send proactive WhatsApp confirmation after a web booking. Silent fail if Twilio not set up."""
    account_sid = os.getenv('TWILIO_ACCOUNT_SID')
    auth_token  = os.getenv('TWILIO_AUTH_TOKEN')
    from_number = os.getenv('TWILIO_WHATSAPP_NUMBER')
    if not (account_sid and auth_token and from_number):
        return False
    try:
        from twilio.rest import Client
        # Normalize phone to E.164
        digits = ''.join(c for c in to_phone if c.isdigit())
        if len(digits) == 9 and digits[0] in ('6', '7', '9'):
            to = f'whatsapp:+34{digits}'
        elif len(digits) == 11 and digits.startswith('34'):
            to = f'whatsapp:+{digits}'
        elif to_phone.strip().startswith('+'):
            to = f'whatsapp:{to_phone.strip()}'
        else:
            to = f'whatsapp:+{digits}'

        from datetime import date as _date
        d = _date.fromisoformat(date_str)
        days_es = ['lunes','martes','miércoles','jueves','viernes','sábado','domingo']
        fecha = f"{days_es[d.weekday()].capitalize()}, {d.strftime('%d/%m/%Y')}"
        turno_label = '🌞 Comida' if shift == 'comida' else '🌙 Cena'
        g = int(guests)
        personas = f'{g} persona{"s" if g != 1 else ""}'

        body = (
            f'✅ *Reserva confirmada — Season*\n\n'
            f'👤 {name}\n'
            f'📅 {fecha} · {time_str}\n'
            f'🍽 {turno_label} · {personas}\n'
        )
        if notes:
            body += f'📝 {notes}\n'
        body += (
            '\nTe esperamos en *Season Benidorm* 🌿\n\n'
            'Para cancelar o modificar, escríbenos por WhatsApp o llámanos directamente.'
        )

        Client(account_sid, auth_token).messages.create(
            body=body, from_=from_number, to=to
        )
        return True
    except Exception as e:
        import sys
        print(f'[WhatsApp] Error sending confirmation: {e}', file=sys.stderr)
        return False
