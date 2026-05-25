#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
# Database Setup Script for Season Reservas
# ═══════════════════════════════════════════════════════════════════

set -e

echo "🔧 Season Reservas - Database Setup"
echo "═════════════════════════════════════"

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Creating from .env.example..."
    cp .env.example .env
    echo "✅ .env created. Please edit it with your database URL"
    exit 1
fi

# Source .env
export $(cat .env | grep -v '#' | xargs)

if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL not set in .env"
    exit 1
fi

echo "📦 Database: $DATABASE_URL"
echo ""

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 not found"
    exit 1
fi

echo "🐍 Python: $(python3 --version)"
echo ""

# Install dependencies
echo "📥 Installing dependencies..."
pip install -q -r requirements.txt

echo ""
echo "🗄️  Initializing database..."

# Create database and tables
python3 << 'PYTHON'
import os
from app import create_app
from models import db, Table
from config.tables import DEFAULT_TABLES

# Create app
app, logger, socketio = create_app()

# Create tables
with app.app_context():
    db.create_all()

    # Check if tables exist
    existing_count = Table.query.count()

    if existing_count == 0:
        print(f"  Adding {len(DEFAULT_TABLES)} tables...")
        for table_def in DEFAULT_TABLES:
            table = Table(**table_def)
            db.session.add(table)
        db.session.commit()
        print(f"  ✅ Added {len(DEFAULT_TABLES)} tables")
    else:
        print(f"  ℹ️  Database already has {existing_count} tables")

print("")
print("✅ Database initialized successfully!")
print("")
print("🚀 Next steps:")
print("  1. Start the application: python run.py")
print("  2. Open http://localhost:3000 in your browser")
print("")
PYTHON
