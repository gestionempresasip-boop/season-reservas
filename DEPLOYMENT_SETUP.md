# 🚀 Guía de Deployment - Season Reservas

## Paso 1: Crear Base de Datos PostgreSQL en Supabase (Gratis)

### 1.1 Crear Proyecto en Supabase
1. Ve a https://supabase.com
2. Haz clic en "Sign Up"
3. Crea una cuenta con GitHub o email
4. En tu dashboard, haz clic en "New project"
5. Ingresa:
   - **Nombre**: `season-reservas`
   - **Contraseña**: Crea una fuerte (guárdala!)
   - **Región**: La más cercana a ti
6. Haz clic en "Create new project" (espera ~2 minutos)

### 1.2 Obtener CONNECTION STRING
1. En Supabase, ve a **Settings** → **Database** → **Connection Pooling**
2. Selecciona "URI"
3. Copia la string (se ve así):
```
postgresql://postgres.xxxxx:PASSWORD@db.xxxxx.supabase.co:6543/postgres
```
4. Reemplaza `PASSWORD` con la que creaste

---

## Paso 2: Configurar Variables en Render

1. Abre https://dashboard.render.com
2. Haz clic en tu servicio `season-reservas`
3. Ve a la pestaña **Environment**
4. Agrega estas variables:

| Variable | Valor |
|----------|-------|
| `DATABASE_URL` | Tu PostgreSQL URI de Supabase |
| `SECRET_KEY` | Clave aleatoria |

5. Haz clic en **Save Changes**

---

## Paso 3: Redeploy

### Opción A: Automático (Recomendado)
```bash
git add -A
git commit -m "Config: DATABASE_URL configured"
git push origin main
```

### Opción B: Manual
En Render dashboard, haz clic en **Manual Deploy**

---

## Paso 4: Verificar

```bash
# Health check
curl https://season-reservas.onrender.com/api/health

# Tablas
curl https://season-reservas.onrender.com/api/tables
```

---

## Troubleshooting

- **"DATABASE_URL required"**: Agrega la variable en Render
- **"connection refused"**: Verifica que la URI sea correcta
- **Tables vacío**: Espera 5 segundos y recarga

