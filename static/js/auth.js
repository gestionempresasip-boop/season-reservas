/* ═══════════════════════════════════════════════
   SEASON · Auth — Login overlay + User management
   ═══════════════════════════════════════════════ */

let _currentUser = null;
let _pinBuffer = '';

// ── Init ──────────────────────────────────────────

async function authInit() {
    try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
            _currentUser = await res.json();
            showApp();
        } else {
            showLoginScreen();
        }
    } catch (e) {
        showLoginScreen();
    }
}

function showApp() {
    document.getElementById('loginOverlay')?.style && (document.getElementById('loginOverlay').style.display = 'none');
    document.getElementById('appRoot').style.display = '';
    updateUserBadge();
}

function showLoginScreen() {
    document.getElementById('appRoot').style.display = 'none';
    const overlay = document.getElementById('loginOverlay');
    overlay.style.display = 'flex';
    _pinBuffer = '';
    updatePinDisplay();
    // Focus username field if visible
    setTimeout(() => document.getElementById('loginUsername')?.focus(), 100);
}

function updateUserBadge() {
    if (!_currentUser) return;
    const badge = document.getElementById('userBadge');
    if (badge) {
        badge.textContent = _currentUser.name;
        badge.title = _currentUser.role === 'admin' ? '👑 Administrador' : '👤 Personal';
    }
    // Session bar in Ajustes
    const sbName = document.getElementById('sessionBarName');
    const sbRole = document.getElementById('sessionBarRole');
    if (sbName) sbName.textContent = _currentUser.name;
    if (sbRole) sbRole.textContent = _currentUser.role === 'admin' ? '👑 Administrador' : '👤 Personal';
    // Show admin panel link if admin
    const adminLink = document.getElementById('adminUsersLink');
    if (adminLink) adminLink.style.display = _currentUser.role === 'admin' ? '' : 'none';
}

// ── PIN pad ───────────────────────────────────────

function pinPress(digit) {
    if (_pinBuffer.length >= 6) return;
    _pinBuffer += String(digit);
    updatePinDisplay();
}

function pinDelete() {
    _pinBuffer = _pinBuffer.slice(0, -1);
    updatePinDisplay();
}

function pinClear() {
    _pinBuffer = '';
    updatePinDisplay();
}

function updatePinDisplay() {
    const display = document.getElementById('pinDisplay');
    if (!display) return;
    const dots = _pinBuffer.split('').map(() => '<span class="pin-dot filled"></span>').join('');
    const empty = Array(Math.max(0, 4 - _pinBuffer.length)).fill('<span class="pin-dot"></span>').join('');
    display.innerHTML = dots + empty;
}

// ── Login submit ──────────────────────────────────

async function submitLogin() {
    const username = document.getElementById('loginUsername')?.value.trim();
    const pin = _pinBuffer || document.getElementById('loginPin')?.value.trim();

    if (!username) {
        loginError('Introduce tu nombre de usuario');
        return;
    }
    if (!pin) {
        loginError('Introduce tu PIN o contraseña');
        return;
    }

    const btn = document.getElementById('loginBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Entrando…'; }

    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password: pin }),
        });
        const data = await res.json();
        if (res.ok) {
            _currentUser = data;
            _pinBuffer = '';
            showApp();
            // Reload data after login
            if (typeof refreshAll === 'function') refreshAll();
        } else {
            loginError(data.error || 'Error al iniciar sesión');
            _pinBuffer = '';
            updatePinDisplay();
        }
    } catch (e) {
        loginError('Error de conexión');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = '→ Entrar'; }
    }
}

function loginError(msg) {
    const err = document.getElementById('loginError');
    if (err) {
        err.textContent = msg;
        err.style.display = 'block';
        setTimeout(() => { err.style.display = 'none'; }, 3000);
    }
}

async function logout() {
    if (!confirm('¿Cerrar sesión?')) return;
    await fetch('/api/auth/logout', { method: 'POST' });
    _currentUser = null;
    showLoginScreen();
}

// Enter key on username → focus PIN
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('loginUsername')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') document.getElementById('loginPin')?.focus();
    });
    document.getElementById('loginPin')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') submitLogin();
    });
});

// ── User management (admin) ───────────────────────

async function loadUsersPanel() {
    if (!_currentUser || _currentUser.role !== 'admin') return;
    const container = document.getElementById('usersPanel');
    if (!container) return;
    container.innerHTML = '<div style="color:#9ca3af;padding:16px">Cargando…</div>';

    try {
        const res = await fetch('/api/auth/users');
        const users = await res.json();
        renderUsersPanel(users, container);
    } catch (e) {
        container.innerHTML = '<div style="color:#ef4444;padding:16px">Error al cargar usuarios</div>';
    }
}

function renderUsersPanel(users, container, showInactive = false) {
    const active = users.filter(u => u.active);
    const inactive = users.filter(u => !u.active);
    const visible = showInactive ? users : active;

    container.innerHTML = `
        <div class="users-panel-header">
            <span style="font-size:14px;font-weight:700;color:#111827">👥 Usuarios (${active.length})</span>
            <button class="btn-primary btn-sm" onclick="openNewUserModal()">+ Nuevo usuario</button>
        </div>
        <div class="users-list">
            ${visible.map(u => `
                <div class="user-item ${!u.active ? 'user-inactive' : ''}">
                    <div class="user-avatar" style="background:${u.active ? (u.role==='admin'?'#7c3aed':'#1a8a7d') : '#9ca3af'}">
                        ${u.name.charAt(0).toUpperCase()}
                    </div>
                    <div class="user-info">
                        <div class="user-name">${u.name} ${u.role==='admin'?'<span class="badge-admin">Admin</span>':''}</div>
                        <div class="user-meta">@${u.username}${!u.active?' · <span style="color:#9ca3af">Desactivado</span>':''}</div>
                    </div>
                    <div class="user-actions">
                        ${u.active
                            ? `<button class="btn-secondary btn-sm" onclick="openEditUserModal(${JSON.stringify(u).replace(/"/g,'&quot;')})">✏️</button>
                               ${u.id !== _currentUser.id ? `<button class="btn-danger btn-sm" onclick="deleteUser(${u.id},'${u.name.replace(/'/g,"\\'")}')">🗑</button>` : ''}`
                            : `<button class="btn-reactivate btn-sm" onclick="reactivateUser(${u.id},'${u.name.replace(/'/g,"\\'")}')">↩ Reactivar</button>`
                        }
                    </div>
                </div>
            `).join('')}
        </div>
        ${inactive.length > 0 ? `
            <div style="margin-top:12px;text-align:center">
                <button class="btn-link-subtle" onclick="_toggleInactiveUsers(${showInactive})">
                    ${showInactive
                        ? '▲ Ocultar desactivados'
                        : `▼ Mostrar desactivados (${inactive.length})`}
                </button>
            </div>
        ` : ''}
    `;
}

function _toggleInactiveUsers(currentlyShowing) {
    const container = document.getElementById('usersPanel');
    fetch('/api/auth/users')
        .then(r => r.json())
        .then(users => renderUsersPanel(users, container, !currentlyShowing));
}

async function reactivateUser(uid, name) {
    try {
        const res = await fetch(`/api/auth/users/${uid}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ active: true }),
        });
        const data = await res.json();
        if (res.ok) {
            loadUsersPanel();
            showToast(`Usuario ${name} reactivado ✓`, 'success');
        } else {
            showToast(data.error || 'Error al reactivar', 'error');
        }
    } catch (e) {
        showToast('Error de conexión', 'error');
    }
}

function openNewUserModal() {
    showUserModal({});
}

function openEditUserModal(userObj) {
    // userObj may be passed as HTML-escaped JSON string or object
    const u = typeof userObj === 'string' ? JSON.parse(userObj) : userObj;
    showUserModal(u);
}

function showUserModal(u) {
    const isEdit = !!u.id;
    const content = document.getElementById('userModalContent');
    const title = document.getElementById('userModalTitle');
    title.textContent = isEdit ? `✏️ Editar ${u.name}` : '➕ Nuevo usuario';
    content.innerHTML = `
        <div class="form-group">
            <label class="form-label">Nombre completo</label>
            <input class="form-input" id="umName" placeholder="Ej: María García" value="${u.name||''}">
        </div>
        <div class="form-group">
            <label class="form-label">Usuario <span style="color:#9ca3af;font-size:11px">(para iniciar sesión)</span></label>
            <input class="form-input" id="umUsername" placeholder="Ej: maria" value="${u.username||''}">
        </div>
        <div class="form-group">
            <label class="form-label">${isEdit ? 'Nueva contraseña / PIN' : 'Contraseña / PIN'} <span style="color:#9ca3af;font-size:11px">${isEdit?'(dejar vacío para no cambiar)':'(mín. 4 dígitos)'}</span></label>
            <div style="position:relative">
                <input class="form-input" id="umPassword" type="password" inputmode="numeric" placeholder="1234" style="letter-spacing:4px;font-size:18px">
                <button type="button" onclick="togglePwdVisibility('umPassword')" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:#6b7280">👁</button>
            </div>
        </div>
        <div class="form-group">
            <label class="form-label">Rol</label>
            <div style="display:flex;gap:8px">
                <label class="role-radio ${(u.role||'staff')==='staff'?'active':''}" id="roleStaff">
                    <input type="radio" name="umRole" value="staff" ${(u.role||'staff')==='staff'?'checked':''} onchange="updateRoleUI()">
                    👤 Personal
                </label>
                <label class="role-radio ${u.role==='admin'?'active':''}" id="roleAdmin">
                    <input type="radio" name="umRole" value="admin" ${u.role==='admin'?'checked':''} onchange="updateRoleUI()">
                    👑 Admin
                </label>
            </div>
        </div>
        <div id="umError" style="display:none;color:#ef4444;font-size:13px;margin-bottom:8px"></div>
        <div style="display:flex;gap:8px;margin-top:4px">
            <button class="btn-primary" style="flex:1" onclick="saveUser(${u.id||'null'})">💾 Guardar</button>
            <button class="btn-secondary" style="flex:1" onclick="closeModal('userModal')">Cancelar</button>
        </div>
    `;
    openModal('userModal');
    setTimeout(() => document.getElementById('umName')?.focus(), 100);
}

function updateRoleUI() {
    document.getElementById('roleStaff')?.classList.toggle('active', document.querySelector('[name=umRole][value=staff]')?.checked);
    document.getElementById('roleAdmin')?.classList.toggle('active', document.querySelector('[name=umRole][value=admin]')?.checked);
}

function togglePwdVisibility(id) {
    const inp = document.getElementById(id);
    if (!inp) return;
    inp.type = inp.type === 'password' ? 'text' : 'password';
}

async function saveUser(userId) {
    const name = document.getElementById('umName')?.value.trim();
    const username = document.getElementById('umUsername')?.value.trim().toLowerCase();
    const password = document.getElementById('umPassword')?.value.trim();
    const role = document.querySelector('[name=umRole]:checked')?.value || 'staff';

    if (!name || !username) {
        document.getElementById('umError').textContent = 'Nombre y usuario son obligatorios';
        document.getElementById('umError').style.display = 'block';
        return;
    }
    if (!userId && !password) {
        document.getElementById('umError').textContent = 'La contraseña es obligatoria para nuevos usuarios';
        document.getElementById('umError').style.display = 'block';
        return;
    }

    const payload = { name, username, role };
    if (password) payload.password = password;

    try {
        const url = userId ? `/api/auth/users/${userId}` : '/api/auth/users';
        const method = userId ? 'PUT' : 'POST';
        const res = await fetch(url, {
            method, headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (res.ok) {
            closeModal('userModal');
            loadUsersPanel();
            showToast(userId ? `Usuario ${name} actualizado ✓` : `Usuario ${name} creado ✓`, 'success');
        } else {
            document.getElementById('umError').textContent = data.error || 'Error al guardar';
            document.getElementById('umError').style.display = 'block';
        }
    } catch (e) {
        document.getElementById('umError').textContent = 'Error de conexión';
        document.getElementById('umError').style.display = 'block';
    }
}

async function deleteUser(uid, name) {
    if (!confirm(`¿Desactivar al usuario "${name}"? Podrá ser reactivado después.`)) return;
    try {
        const res = await fetch(`/api/auth/users/${uid}`, { method: 'DELETE' });
        const data = await res.json();
        if (res.ok) {
            loadUsersPanel();
            showToast(`Usuario ${name} desactivado`, 'success');
        } else {
            showToast(data.error || 'Error al eliminar', 'error');
        }
    } catch (e) {
        showToast('Error de conexión', 'error');
    }
}

// Start auth check on page load
window.addEventListener('load', authInit);
