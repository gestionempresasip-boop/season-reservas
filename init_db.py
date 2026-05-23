"""Initialize database with Season restaurant table layout."""
from app import app
from models import db, Table
from config.tables import DEFAULT_TABLES, get_total_capacity


def init_tables():
    """Initialize database with restaurant tables."""
    with app.app_context():
        # Create all tables from models
        db.create_all()

        # Initialize restaurant tables if not already present
        if Table.query.count() == 0:
            for table_config in DEFAULT_TABLES:
                table = Table(**table_config)
                db.session.add(table)
            db.session.commit()
            print(f"✅ Database initialized successfully")
            print(f"   {len(DEFAULT_TABLES)} restaurant tables created")
            print(f"   Total capacity: {get_total_capacity()} seats")
        else:
            count = Table.query.count()
            print(f"⚠️  Tables already exist ({count} tables). Skipping initialization.")


if __name__ == '__main__':
    init_tables()
