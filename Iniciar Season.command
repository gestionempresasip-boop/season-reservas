#!/bin/bash
# ╔═══════════════════════════════════════════╗
# ║       SEASON · Sistema de Reservas        ║
# ║       Doble clic para iniciar             ║
# ╚═══════════════════════════════════════════╝

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

PORT=5000
URL="http://localhost:$PORT"

echo ""
echo "  ╔═══════════════════════════════════════════╗"
echo "  ║       SEASON · Sistema de Reservas        ║"
echo "  ╚═══════════════════════════════════════════╝"
echo ""

# Comprobar si ya hay un servidor en el puerto
if lsof -i :$PORT -sTCP:LISTEN >/dev/null 2>&1; then
    echo "  Ya hay un servidor en el puerto $PORT."
    echo "  Abriendo navegador..."
    open "$URL"
    echo ""
    echo "  Si quieres reiniciarlo, cierra esta ventana"
    echo "  y detén el proceso anterior (Ctrl+C)."
    sleep 5
    exit 0
fi

# Instalar dependencias si es la primera vez
if [ ! -d "venv" ]; then
    echo "  Primera ejecución: instalando dependencias..."
    python3 -m venv venv
    source venv/bin/activate
    pip install -q -r requirements.txt
    python3 init_db.py
    echo "  Dependencias instaladas."
    echo ""
else
    source venv/bin/activate
fi

echo "  Servidor iniciando en $URL"
echo "  Página de reservas: $URL/reservar"
echo ""
echo "  WhatsApp: wa.me/34691439227"
echo ""
echo "  ─────────────────────────────────────────"
echo "  Ctrl+C para detener el servidor"
echo "  ─────────────────────────────────────────"
echo ""

# Abrir navegador después de 2 segundos
(sleep 2 && open "$URL") &

# Iniciar servidor
python3 app.py
