import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import date as _date


COPY_EMAIL = 'seasonreserva@gmail.com'

def send_confirmation_email(to_email, name, date_str, shift, time_str, guests, notes=''):
    """Send reservation confirmation email via Gmail SMTP. Silent fail if not configured."""
    gmail_user = os.getenv('GMAIL_USER')
    gmail_pass = os.getenv('GMAIL_APP_PASSWORD')
    if not (gmail_user and gmail_pass):
        return False
    client_has_email = bool(to_email and '@' in str(to_email))
    try:
        d = _date.fromisoformat(date_str)
        days_es = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo']
        fecha = f"{days_es[d.weekday()]} {d.strftime('%d/%m/%Y')}"
        turno_label = 'Comida' if shift == 'comida' else 'Cena'
        g = int(guests)
        personas = f'{g} persona{"s" if g != 1 else ""}'

        html = f"""
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f2e9d8;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f2e9d8;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#f8f1e4;border-radius:16px;overflow:hidden;max-width:560px;width:100%;">

        <!-- Header -->
        <tr>
          <td align="center" style="background:#00b5a8;padding:36px 40px 28px;">
            <p style="margin:0;font-size:11px;letter-spacing:6px;color:rgba(255,255,255,0.7);text-transform:uppercase;font-weight:300;">Grupo Conbrassa · Benidorm</p>
            <h1 style="margin:8px 0 0;font-size:52px;font-weight:300;color:white;letter-spacing:2px;line-height:1;">season</h1>
          </td>
        </tr>

        <!-- Confirmed badge -->
        <tr>
          <td align="center" style="padding:32px 40px 8px;">
            <p style="margin:0;font-size:13px;letter-spacing:4px;text-transform:uppercase;color:#00b5a8;font-weight:600;">✅ Reserva Confirmada</p>
            <p style="margin:10px 0 0;font-size:16px;color:#555;font-weight:300;">Hola <strong style="color:#333;font-weight:600;">{name}</strong>, tu mesa está reservada.</p>
          </td>
        </tr>

        <!-- Details card -->
        <tr>
          <td style="padding:24px 40px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f2e9d8;border-radius:12px;padding:24px 28px;">
              <tr>
                <td style="padding:8px 0;border-bottom:1px solid rgba(0,0,0,0.06);">
                  <span style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#888;font-weight:500;">Fecha</span><br>
                  <span style="font-size:16px;color:#333;font-weight:600;">{fecha}</span>
                </td>
              </tr>
              <tr>
                <td style="padding:8px 0;border-bottom:1px solid rgba(0,0,0,0.06);">
                  <span style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#888;font-weight:500;">Turno · Hora</span><br>
                  <span style="font-size:16px;color:#333;font-weight:600;">{turno_label} · {time_str}</span>
                </td>
              </tr>
              <tr>
                <td style="padding:8px 0;border-bottom:1px solid rgba(0,0,0,0.06);">
                  <span style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#888;font-weight:500;">Comensales</span><br>
                  <span style="font-size:16px;color:#333;font-weight:600;">{personas}</span>
                </td>
              </tr>
              {"<tr><td style='padding:8px 0;border-bottom:1px solid rgba(0,0,0,0.06);'><span style='font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#888;font-weight:500;'>Notas</span><br><span style='font-size:15px;color:#555;'>" + notes + "</span></td></tr>" if notes else ""}
              <tr>
                <td style="padding:8px 0;">
                  <span style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#888;font-weight:500;">Dirección</span><br>
                  <span style="font-size:15px;color:#333;">Av. Vicente Llorca Alos, 8<br>03502 · Benidorm (Alicante)</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td align="center" style="padding:0 40px 32px;">
            <p style="margin:0 0 20px;font-size:14px;color:#777;line-height:1.7;">¡Te esperamos! Para cancelar o modificar tu reserva contáctanos con al menos 24h de antelación.</p>
            <a href="tel:+34689135630" style="display:inline-block;padding:13px 36px;background:#00b5a8;color:white;text-decoration:none;font-size:13px;letter-spacing:2px;text-transform:uppercase;font-weight:500;border-radius:2px;">📞 689 135 630</a>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td align="center" style="background:#0a1e30;padding:20px 40px;">
            <p style="margin:0;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,0.3);font-weight:300;">Season · Benidorm · Grupo Conbrassa</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
"""

        # Always send to COPY_EMAIL; also send to client if they provided an email
        recipients = [COPY_EMAIL]
        if client_has_email:
            recipients.insert(0, to_email)

        msg = MIMEMultipart('alternative')
        msg['Subject'] = f'✅ {name} · {turno_label} {time_str} — Season Benidorm · {fecha}'
        msg['From']    = f'Season Benidorm <{gmail_user}>'
        msg['To']      = to_email if client_has_email else COPY_EMAIL
        msg.attach(MIMEText(html, 'html', 'utf-8'))

        with smtplib.SMTP('smtp.gmail.com', 587) as server:
            server.ehlo()
            server.starttls()
            server.login(gmail_user, gmail_pass)
            server.sendmail(gmail_user, recipients, msg.as_string())

        return True
    except Exception as e:
        import sys
        print(f'[Email] Error sending confirmation: {e}', file=sys.stderr)
        return False


def send_restaurant_notification(reservation_id, token, name, phone, date_str, shift, time_str, guests, notes='', client_email=''):
    """Send new reservation notification to the restaurant with confirm/cancel buttons."""
    gmail_user = os.getenv('GMAIL_USER')
    gmail_pass = os.getenv('GMAIL_APP_PASSWORD')
    restaurant_email = os.getenv('RESTAURANT_EMAIL', 'reservaseason@gmail.com')
    base_url = os.getenv('APP_BASE_URL', 'https://season-reservas.onrender.com')
    if not (gmail_user and gmail_pass):
        return False
    try:
        d = _date.fromisoformat(date_str)
        days_es = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
        fecha = f"{days_es[d.weekday()]} {d.strftime('%d/%m/%Y')}"
        turno_label = 'Comida' if shift == 'comida' else 'Cena'
        g = int(guests)
        personas = f'{g} persona{"s" if g != 1 else ""}'

        confirm_url = f"{base_url}/api/reservation-action/{token}/confirm"
        cancel_url  = f"{base_url}/api/reservation-action/{token}/cancel"

        email_row = f"<tr><td style='padding:6px 0;border-bottom:1px solid rgba(0,0,0,0.06);'><span style='font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#888;'>Email cliente</span><br><span style='font-size:15px;color:#333;font-weight:600;'>{client_email}</span></td></tr>" if client_email else ""
        notes_row  = f"<tr><td style='padding:6px 0;border-bottom:1px solid rgba(0,0,0,0.06);'><span style='font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#888;'>Notas</span><br><span style='font-size:15px;color:#555;'>{notes}</span></td></tr>" if notes else ""

        html = f"""<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f2e9d8;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f2e9d8;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#f8f1e4;border-radius:16px;overflow:hidden;max-width:560px;width:100%;">

        <tr>
          <td align="center" style="background:#0a1e30;padding:28px 40px 20px;">
            <p style="margin:0;font-size:10px;letter-spacing:6px;color:rgba(255,255,255,0.5);text-transform:uppercase;">Nueva Reserva Web</p>
            <h1 style="margin:8px 0 0;font-size:42px;font-weight:300;color:white;letter-spacing:2px;line-height:1;">season</h1>
          </td>
        </tr>

        <tr>
          <td style="padding:28px 40px 8px;">
            <p style="margin:0 0 16px;font-size:13px;letter-spacing:3px;text-transform:uppercase;color:#00b5a8;font-weight:600;">🔔 Nueva solicitud de reserva</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f2e9d8;border-radius:12px;padding:20px 24px;">
              <tr>
                <td style="padding:6px 0;border-bottom:1px solid rgba(0,0,0,0.06);">
                  <span style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#888;">Cliente</span><br>
                  <span style="font-size:16px;color:#333;font-weight:700;">{name}</span>
                </td>
              </tr>
              <tr>
                <td style="padding:6px 0;border-bottom:1px solid rgba(0,0,0,0.06);">
                  <span style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#888;">Teléfono</span><br>
                  <span style="font-size:15px;color:#333;font-weight:600;">{phone}</span>
                </td>
              </tr>
              <tr>
                <td style="padding:6px 0;border-bottom:1px solid rgba(0,0,0,0.06);">
                  <span style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#888;">Fecha</span><br>
                  <span style="font-size:16px;color:#333;font-weight:700;">{fecha}</span>
                </td>
              </tr>
              <tr>
                <td style="padding:6px 0;border-bottom:1px solid rgba(0,0,0,0.06);">
                  <span style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#888;">Turno · Hora</span><br>
                  <span style="font-size:16px;color:#333;font-weight:700;">{turno_label} · {time_str}</span>
                </td>
              </tr>
              <tr>
                <td style="padding:6px 0;border-bottom:1px solid rgba(0,0,0,0.06);">
                  <span style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#888;">Comensales</span><br>
                  <span style="font-size:16px;color:#333;font-weight:700;">{personas}</span>
                </td>
              </tr>
              {notes_row}
              {email_row}
            </table>
          </td>
        </tr>

        <tr>
          <td align="center" style="padding:24px 40px 32px;">
            <p style="margin:0 0 20px;font-size:13px;color:#777;">¿Confirmáis esta reserva?</p>
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding-right:12px;">
                  <a href="{confirm_url}" style="display:inline-block;padding:14px 36px;background:#00b5a8;color:white;text-decoration:none;font-size:13px;letter-spacing:2px;text-transform:uppercase;font-weight:600;border-radius:4px;">✅ Confirmar</a>
                </td>
                <td>
                  <a href="{cancel_url}" style="display:inline-block;padding:14px 36px;background:#c0392b;color:white;text-decoration:none;font-size:13px;letter-spacing:2px;text-transform:uppercase;font-weight:600;border-radius:4px;">✗ Cancelar</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td align="center" style="background:#0a1e30;padding:16px 40px;">
            <p style="margin:0;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,0.3);">Season · Benidorm · Grupo Conbrassa</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>"""

        msg = MIMEMultipart('alternative')
        msg['Subject'] = f'🔔 Nueva reserva — {name} · {turno_label} {fecha}'
        msg['From']    = f'Season Reservas <{gmail_user}>'
        msg['To']      = restaurant_email
        msg.attach(MIMEText(html, 'html', 'utf-8'))

        with smtplib.SMTP('smtp.gmail.com', 587) as server:
            server.ehlo()
            server.starttls()
            server.login(gmail_user, gmail_pass)
            server.sendmail(gmail_user, restaurant_email, msg.as_string())

        return True
    except Exception as e:
        import sys
        print(f'[Email] Error sending restaurant notification: {e}', file=sys.stderr)
        return False
