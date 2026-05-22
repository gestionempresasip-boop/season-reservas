#!/usr/bin/env python3
"""
╔═══════════════════════════════════════════╗
║       SEASON · Sistema de Reservas        ║
║       Haz doble clic para iniciar         ║
╚═══════════════════════════════════════════╝
"""
import subprocess
import sys
import os
import webbrowser
import time
import threading

DIR = os.path.dirname(os.path.abspath(__file__))
VENV_PYTHON = os.path.join(DIR, 'venv', 'bin', 'python3')
APP = os.path.join(DIR, 'app.py')
PORT = 5000
URL = f'http://localhost:{PORT}'


def open_browser():
    time.sleep(2)
    webbrowser.open(URL)
    print(f"\n  Navegador abierto en {URL}")
    print(f"  Pagina publica de reservas: {URL}/reservar\n")


def main():
    os.chdir(DIR)
    print(__doc__)

    if not os.path.exists(VENV_PYTHON):
        print("  Instalando dependencias por primera vez...")
        subprocess.run([sys.executable, '-m', 'venv', 'venv'], cwd=DIR)
        pip = os.path.join(DIR, 'venv', 'bin', 'pip')
        subprocess.run([pip, 'install', '-r', 'requirements.txt'], cwd=DIR)
        subprocess.run([VENV_PYTHON, 'init_db.py'], cwd=DIR)
        print("  Dependencias instaladas.\n")

    threading.Thread(target=open_browser, daemon=True).start()

    print(f"  Servidor iniciado en {URL}")
    print("  Ctrl+C para detener\n")
    print("=" * 45)

    os.environ['FLASK_ENV'] = 'production'
    subprocess.run([VENV_PYTHON, APP], cwd=DIR)


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n  Servidor detenido. Hasta pronto!")
