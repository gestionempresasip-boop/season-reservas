"""
Authentication routes for Season.
Handles login, logout, session management and user administration.
"""
from flask import Blueprint, request, jsonify, session
from models import db, User

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')


def _current_user():
    uid = session.get('user_id')
    return User.query.get(uid) if uid else None


def _require_admin():
    u = _current_user()
    if not u or u.role != 'admin':
        return jsonify({'error': 'Acceso denegado'}), 403
    return None


# ── Public endpoints ──────────────────────────────

@auth_bp.route('/me', methods=['GET'])
def me():
    u = _current_user()
    if not u or not u.active:
        session.clear()
        return jsonify({'error': 'No autenticado'}), 401
    return jsonify(u.to_dict())


@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.json or {}
    username = data.get('username', '').strip().lower()
    password = str(data.get('password', '')).strip()

    if not username or not password:
        return jsonify({'error': 'Usuario y contraseña son obligatorios'}), 400

    u = User.query.filter_by(username=username, active=True).first()
    if not u or not u.check_password(password):
        return jsonify({'error': 'Usuario o contraseña incorrectos'}), 401

    session.permanent = True
    session['user_id'] = u.id
    session['user_role'] = u.role
    session['user_name'] = u.name

    return jsonify(u.to_dict())


@auth_bp.route('/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'ok': True})


# ── User management (admin only) ──────────────────

@auth_bp.route('/users', methods=['GET'])
def list_users():
    err = _require_admin()
    if err:
        return err
    users = User.query.order_by(User.name).all()
    return jsonify([u.to_dict() for u in users])


@auth_bp.route('/users', methods=['POST'])
def create_user():
    err = _require_admin()
    if err:
        return err

    data = request.json or {}
    name = data.get('name', '').strip()
    username = data.get('username', '').strip().lower()
    password = str(data.get('password', '')).strip()
    role = data.get('role', 'staff')

    if not name or not username or not password:
        return jsonify({'error': 'Nombre, usuario y contraseña son obligatorios'}), 400
    if role not in ('admin', 'staff'):
        role = 'staff'
    if len(password) < 4:
        return jsonify({'error': 'La contraseña debe tener al menos 4 caracteres'}), 400
    if User.query.filter_by(username=username).first():
        return jsonify({'error': 'Ese nombre de usuario ya existe'}), 409

    u = User(name=name, username=username, role=role)
    u.set_password(password)
    db.session.add(u)
    db.session.commit()
    return jsonify(u.to_dict()), 201


@auth_bp.route('/users/<int:uid>', methods=['PUT'])
def update_user(uid):
    err = _require_admin()
    if err:
        return err

    u = User.query.get_or_404(uid)
    data = request.json or {}

    if 'name' in data and data['name'].strip():
        u.name = data['name'].strip()
    if 'username' in data and data['username'].strip():
        new_uname = data['username'].strip().lower()
        existing = User.query.filter_by(username=new_uname).first()
        if existing and existing.id != uid:
            return jsonify({'error': 'Ese nombre de usuario ya existe'}), 409
        u.username = new_uname
    if 'password' in data and str(data['password']).strip():
        pwd = str(data['password']).strip()
        if len(pwd) < 4:
            return jsonify({'error': 'La contraseña debe tener al menos 4 caracteres'}), 400
        u.set_password(pwd)
    if 'role' in data and data['role'] in ('admin', 'staff'):
        # Prevent removing the last admin
        if data['role'] != 'admin' and u.role == 'admin':
            admin_count = User.query.filter_by(role='admin', active=True).count()
            if admin_count <= 1:
                return jsonify({'error': 'Debe haber al menos un administrador'}), 400
        u.role = data['role']
    if 'active' in data:
        u.active = bool(data['active'])

    db.session.commit()
    return jsonify(u.to_dict())


@auth_bp.route('/users/<int:uid>', methods=['DELETE'])
def delete_user(uid):
    err = _require_admin()
    if err:
        return err

    current = _current_user()
    if uid == current.id:
        return jsonify({'error': 'No puedes eliminar tu propio usuario'}), 400

    u = User.query.get_or_404(uid)

    # Prevent removing the last admin
    if u.role == 'admin':
        admin_count = User.query.filter_by(role='admin', active=True).count()
        if admin_count <= 1:
            return jsonify({'error': 'Debe haber al menos un administrador'}), 400

    u.active = False  # soft delete
    db.session.commit()
    return jsonify({'ok': True})
