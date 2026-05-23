"""
Table definitions - SINGLE SOURCE OF TRUTH for all 33 restaurant tables.

This file centralizes all table configuration. Use these definitions everywhere:
- Backend database initialization
- API responses
- Frontend floor plan rendering
- Report calculations
"""

# ═══════════════════════════════════════════════════════════════════════════
# RESTAURANT TABLES (33 total = 114 capacity)
# ═══════════════════════════════════════════════════════════════════════════

DEFAULT_TABLES = [
    # ─────────────────────────────────────────────────────────────────────
    # ZONA EXTERIOR (8 tables, 22 capacity)
    # ─────────────────────────────────────────────────────────────────────
    {'number': 50, 'zone': 'exterior', 'capacity': 2, 'table_type': 'normal', 'pos_x': 33, 'pos_y': 8},
    {'number': 52, 'zone': 'exterior', 'capacity': 2, 'table_type': 'normal', 'pos_x': 43, 'pos_y': 8},
    {'number': 54, 'zone': 'exterior', 'capacity': 2, 'table_type': 'normal', 'pos_x': 53, 'pos_y': 8},
    {'number': 56, 'zone': 'exterior', 'capacity': 2, 'table_type': 'normal', 'pos_x': 63, 'pos_y': 8},
    {'number': 58, 'zone': 'exterior', 'capacity': 2, 'table_type': 'normal', 'pos_x': 73, 'pos_y': 12},
    {'number': 60, 'zone': 'exterior', 'capacity': 4, 'table_type': 'normal', 'pos_x': 53, 'pos_y': 20},
    {'number': 62, 'zone': 'exterior', 'capacity': 4, 'table_type': 'normal', 'pos_x': 38, 'pos_y': 20},
    {'number': 70, 'zone': 'exterior', 'capacity': 2, 'table_type': 'alta', 'pos_x': 18, 'pos_y': 14},

    # ─────────────────────────────────────────────────────────────────────
    # SALÓN PRINCIPAL (22 tables, 92 capacity)
    # ─────────────────────────────────────────────────────────────────────
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

    # ─────────────────────────────────────────────────────────────────────
    # SALÓN INTERIOR (5 tables, 24 capacity)
    # ─────────────────────────────────────────────────────────────────────
    {'number': 30, 'zone': 'salon_interior', 'capacity': 4, 'table_type': 'normal', 'pos_x': 62, 'pos_y': 36},
    {'number': 82, 'zone': 'salon_interior', 'capacity': 4, 'table_type': 'normal', 'pos_x': 75, 'pos_y': 36},
    {'number': 34, 'zone': 'salon_interior', 'capacity': 4, 'table_type': 'normal', 'pos_x': 65, 'pos_y': 50},
    {'number': 36, 'zone': 'salon_interior', 'capacity': 4, 'table_type': 'normal', 'pos_x': 68, 'pos_y': 66},
    {'number': 40, 'zone': 'salon_interior', 'capacity': 8, 'table_type': 'alta', 'pos_x': 75, 'pos_y': 85},
]

# ═══════════════════════════════════════════════════════════════════════════
# HELPER FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════

def get_table_by_number(table_number):
    """Get table configuration by table number."""
    for table in DEFAULT_TABLES:
        if table['number'] == table_number:
            return table
    return None

def get_tables_by_zone(zone):
    """Get all tables in a specific zone."""
    return [t for t in DEFAULT_TABLES if t['zone'] == zone]

def get_total_capacity():
    """Get total restaurant capacity (sum of all table capacities)."""
    return sum(t['capacity'] for t in DEFAULT_TABLES)

def get_zone_capacity(zone):
    """Get total capacity for a specific zone."""
    return sum(t['capacity'] for t in DEFAULT_TABLES if t['zone'] == zone)

def get_all_zones():
    """Get list of all unique zones."""
    return list(set(t['zone'] for t in DEFAULT_TABLES))

def get_table_count():
    """Get total number of tables."""
    return len(DEFAULT_TABLES)

def validate_table_number(table_number):
    """Check if a table number is valid."""
    return any(t['number'] == table_number for t in DEFAULT_TABLES)
