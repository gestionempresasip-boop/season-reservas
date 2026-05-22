"""Initialize database with Season restaurant table layout."""
import os
# Set production DB path before importing app
if os.getenv('RENDER') or os.getenv('FLASK_ENV') == 'production':
    os.environ.setdefault('DATABASE_URL', 'sqlite:////tmp/season_reservas.db')
from app import app
from models import db, Table

TABLES = [
    # ZONA EXTERIOR
    {'number': 50, 'zone': 'exterior', 'capacity': 2, 'table_type': 'normal', 'pos_x': 33, 'pos_y': 8},
    {'number': 52, 'zone': 'exterior', 'capacity': 2, 'table_type': 'normal', 'pos_x': 43, 'pos_y': 8},
    {'number': 54, 'zone': 'exterior', 'capacity': 2, 'table_type': 'normal', 'pos_x': 53, 'pos_y': 8},
    {'number': 56, 'zone': 'exterior', 'capacity': 2, 'table_type': 'normal', 'pos_x': 63, 'pos_y': 8},
    {'number': 58, 'zone': 'exterior', 'capacity': 2, 'table_type': 'normal', 'pos_x': 73, 'pos_y': 12},
    {'number': 60, 'zone': 'exterior', 'capacity': 4, 'table_type': 'normal', 'pos_x': 53, 'pos_y': 20},
    {'number': 62, 'zone': 'exterior', 'capacity': 4, 'table_type': 'normal', 'pos_x': 38, 'pos_y': 20},
    {'number': 70, 'zone': 'exterior', 'capacity': 2, 'table_type': 'alta', 'pos_x': 18, 'pos_y': 14},

    # SALON PRINCIPAL
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

    # SALON INTERIOR
    {'number': 30, 'zone': 'salon_interior', 'capacity': 4, 'table_type': 'normal', 'pos_x': 62, 'pos_y': 36},
    {'number': 82, 'zone': 'salon_interior', 'capacity': 4, 'table_type': 'normal', 'pos_x': 75, 'pos_y': 36},
    {'number': 34, 'zone': 'salon_interior', 'capacity': 4, 'table_type': 'normal', 'pos_x': 65, 'pos_y': 50},
    {'number': 36, 'zone': 'salon_interior', 'capacity': 4, 'table_type': 'normal', 'pos_x': 68, 'pos_y': 66},
    {'number': 40, 'zone': 'salon_interior', 'capacity': 8, 'table_type': 'alta', 'pos_x': 75, 'pos_y': 85},
]


def init_tables():
    with app.app_context():
        db.create_all()
        if Table.query.count() == 0:
            for t in TABLES:
                db.session.add(Table(**t))
            db.session.commit()
            print(f"Initialized {len(TABLES)} tables.")
            total = sum(t['capacity'] for t in TABLES)
            print(f"Total capacity: {total} seats.")
        else:
            print(f"Tables already exist ({Table.query.count()} tables). Skipping.")


if __name__ == '__main__':
    init_tables()
