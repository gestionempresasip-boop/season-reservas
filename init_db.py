#!/usr/bin/env python
"""
Placeholder init_db.py - Database initialization is now handled on first request.
This file exists to prevent Render build failures when it tries to execute init_db.py
"""
if __name__ == '__main__':
    print("✅ Database initialization deferred to first request (wsgi.py)")
    exit(0)
