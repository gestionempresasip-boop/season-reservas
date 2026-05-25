# ⚡ Quick Start - Season Reservas Deployment

## 🎯 En 10 minutos: Aplicación funcional en producción

### Checklist

#### ☐ PASO 1: Supabase Database (5 min)
- [ ] Ir a https://supabase.com
- [ ] Sign Up con GitHub o email
- [ ] New Project:
  - [ ] Name: `season-reservas`
  - [ ] Password: (crear fuerte, anotar)
  - [ ] Region: (seleccionar más cercana)
- [ ] Esperar a que se cree (~2 min)
- [ ] Settings → Database → Connection Pooling
- [ ] Copiar URI (la parte postgresql://...)
- [ ] Reemplazar PASSWORD en la URI con tu contraseña

**URI debería verse así:**
```
postgresql://postgres.xxxxx:TU_PASSWORD@db.xxxxx.supabase.co:6543/postgres
```

#### ☐ PASO 2: Render Configuration (3 min)
- [ ] Ir a https://dashboard.render.com
- [ ] Buscar `season-reservas`
- [ ] Click en el servicio
- [ ] Environment tab
- [ ] Add Environment Variable:
  - [ ] Key: `DATABASE_URL`
  - [ ] Value: (pegar tu URI de Supabase)
- [ ] Save Changes

#### ☐ PASO 3: Redeploy (2 min)
**Opción A - Automático (CLI):**
```bash
cd "Documents/proyecto reservas Season"
git add -A
git commit -m "Config: DATABASE_URL set"
git push origin main
# Esperar 3-5 min a que Render redeploy automáticamente
```

**Opción B - Manual:**
- [ ] En Render dashboard
- [ ] Click en `season-reservas`
- [ ] Click en **Deploy** button

#### ☐ PASO 4: Verificar (1 min)
```bash
# En terminal, ejecutar:
curl https://season-reservas.onrender.com/api/health

# Deberías ver:
{"status":"healthy","timestamp":"2026-05-25 ..."}
```

Si ves error, espera 5 segundos y vuelve a intentar (primera request es lenta).

#### ☐ PASO 5: Testing
- [ ] Abre en navegador: https://season-reservas.onrender.com
- [ ] Ve que el dashboard cargue
- [ ] Intenta crear una reserva
- [ ] Verifica que las mesas se vean

---

## 🆘 Si algo falla

### ❌ "DATABASE_URL required"
```bash
# Verificar que esté en Render
# 1. Render dashboard
# 2. Environment tab
# 3. Buscar DATABASE_URL
# Si no está: agrégalo y Save
# Luego: Manual Deploy
```

### ❌ "connection refused" o "could not translate host name"
```bash
# Tu URI de Supabase está mal
# 1. Abre Supabase
# 2. Settings → Database → Connection Pooling → URI
# 3. Copia de nuevo (asegúrate de reemplazar PASSWORD)
# 4. En Render: actualiza DATABASE_URL
# 5. Manual Deploy
```

### ❌ Las mesas no cargan
```bash
# Primera request toma tiempo
# 1. Espera 10 segundos
# 2. Recarga la página
# Si sigue fallando:
#   - Abre Render Logs
#   - Busca "Database init error"
#   - Copia el error y búscalo en Google
```

---

## ✅ Verificación Final

Estos endpoints deben funcionar:

```bash
# 1. Health
curl https://season-reservas.onrender.com/api/health

# 2. Tables
curl https://season-reservas.onrender.com/api/tables
# Deberías ver: [{"id":1,"number":1,...}, {"id":2,"number":2,...}, ...]

# 3. Crear reserva (test POST)
curl -X POST https://season-reservas.onrender.com/api/reservations \
  -H "Content-Type: application/json" \
  -d '{
    "date":"2026-05-26",
    "shift":"comida",
    "time":"13:00",
    "guests":2,
    "client_name":"Test User",
    "client_phone":"689000000"
  }'
```

---

## 📚 Documentación Completa

- **DEPLOYMENT_SETUP.md** - Guía detallada en español
- **RENDER_DEPLOYMENT.md** - Guía técnica completa
- **setup_db.sh** - Para desarrollar localmente

---

## 🎉 HECHO!

Si todo funciona:
- ✅ Aplicación en producción
- ✅ Base de datos persistente
- ✅ Context Mode instalado
- ✅ Listo para usar

**Costo**: $25/mes (muy affordable)

---

## 🚀 Próximas mejoras (Opcional)

- [ ] Agregar autenticación para staff
- [ ] Configurar WhatsApp (Twilio)
- [ ] Agregar reportes/analytics
- [ ] Setup PWA (offline support)
- [ ] Multi-restaurant support

