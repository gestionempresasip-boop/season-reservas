# 🚀 Guía Rápida de Desarrollo - Season

**Para desarrollar sin liarte, usa esta guía. Responde siempre estas preguntas:**

---

## ❓ Antes de Empezar: Haz estas preguntas

1. **¿Qué estoy haciendo?**
   - ¿Agregar feature nueva?
   - ¿Arreglar bug?
   - ¿Optimizar performance?

2. **¿Dónde va el código?**
   - Configuración → `config/`
   - Lógica de negocio → `services/`
   - Endpoint API → `routes/api.py`
   - Validación → `utils/validators.py`

3. **¿Es seguro hacerlo?**
   - ¿Está en git? → `git status`
   - ¿Tengo backup? → `git branch`
   - ¿Se puede probar? → Local first

---

## 📝 Workflow Típico de Desarrollo

### 1️⃣ PLANEAR (2 minutos)

```
¿Qué exactamente necesito hacer?
├─ Usar solo features existentes → 5 minutos
├─ Extender servicio existente → 15 minutos
└─ Nueva feature completa → 45 minutos
```

### 2️⃣ IMPLEMENTAR (15-45 minutos)

**Orden correcto:**

```
1. Servicio (services/*)
   └─ Escribe lógica de negocio
   
2. Validador (utils/validators.py)
   └─ Define schema Pydantic
   
3. Endpoint (routes/api.py)
   └─ Usa el servicio + validador
   
4. Caché (si es necesario)
   └─ Agregar cache_get/cache_set
   
5. Logging
   └─ logger.info/warning/error
```

### 3️⃣ PROBAR (5-10 minutos)

```bash
# Terminal 1: Inicia servidor
python app.py

# Terminal 2: Prueba endpoint
curl http://localhost:3000/api/mi-endpoint
# o usa Postman/Insomnia
```

### 4️⃣ COMMIT (2 minutos)

```bash
git add .
git commit -m "feat: Descripción corta y clara"
git push origin main
```

---

## 🔧 Tareas Comunes

### ✏️ Agregar Validación a un Endpoint

**Situación:** El endpoint `/api/reservations` acepta cualquier cosa. Quiero validar.

**Solución en 3 pasos:**

```python
# Paso 1: Crear validador (utils/validators.py)
class ReservationCreate(BaseModel):
    date: date
    shift: str
    time: str
    guests: int = Field(ge=1, le=14)  # Entre 1 y 14
    
    @validator('shift')
    def validate_shift(cls, v):
        if v not in ['comida', 'cena']:
            raise ValueError('...')
        return v

# Paso 2: Usar decorador (routes/api.py)
@api.route('/reservations', methods=['POST'])
@validate_and_handle(ReservationCreate)  # ← Mágico
def create_reservation(data: ReservationCreate):
    r = res_svc.create_reservation(data.dict())
    return jsonify(r.to_dict()), 201

# Paso 3: TEST
curl -X POST http://localhost:3000/api/reservations \
  -H "Content-Type: application/json" \
  -d '{"date":"2026-05-25","shift":"comida",...}'
```

**Resultado:** Validación automática + errores descriptivos ✅

---

### 🗄️ Agregar Nueva Columna a la BD

**Situación:** Quiero agregar `preferred_table_id` al cliente.

**Solución en 3 pasos:**

```python
# Paso 1: Actualizar modelo (models.py)
class Client(db.Model):
    # ... campos existentes ...
    preferred_table_id = db.Column(db.Integer, db.ForeignKey('table.id'))
    updated_at = db.Column(db.DateTime, onupdate=datetime.utcnow)

# Paso 2: Crear migration en Supabase
# En Supabase Console → SQL Editor:
# ALTER TABLE client ADD COLUMN preferred_table_id INTEGER REFERENCES table(id);

# Paso 3: Actualizar servicio (services/client.py)
def update_client_preference(client_id, table_id):
    client = Client.query.get_or_404(client_id)
    client.preferred_table_id = table_id
    db.session.commit()
    return client
```

**Importante:**
- Supabase no tiene migrations automáticas
- Ejecuta SQL manualmente en Supabase Console
- Luego actualiza el modelo Python

---

### 📊 Agregar un Nuevo Reporte

**Situación:** Quiero saber "Qué horarios son más populares"

**Solución en 4 pasos:**

```python
# Paso 1: Servicio (services/reports.py)
def hourly_popularity(from_date, to_date):
    """Agregación SQL por hora"""
    results = db.session.query(
        Reservation.time,
        func.count(Reservation.id).label('count')
    ).filter(
        Reservation.date.between(from_date, to_date),
        Reservation.status == 'completed'
    ).group_by(Reservation.time)\
     .order_by(func.count(Reservation.id).desc())\
     .all()
    
    return [{'time': r.time, 'count': r.count} for r in results]

# Paso 2: Endpoint (routes/api.py)
@api.route('/reports/hourly-popularity', methods=['GET'])
def report_hourly():
    from_d = request.args.get('from', (date.today() - timedelta(days=30)).isoformat())
    to_d = request.args.get('to', date.today().isoformat())
    return jsonify(rpt_svc.hourly_popularity(
        date.fromisoformat(from_d),
        date.fromisoformat(to_d)
    ))

# Paso 3: TEST
curl "http://localhost:3000/api/reports/hourly-popularity?from=2026-04-24&to=2026-05-24"

# Paso 4: DOCUMENTAR
# Agrega en ARQUITECTURA.md sección "API Endpoints" → Reports
```

---

### ⚡ Optimizar Query Lenta

**Síntomas:** Un endpoint tarda > 500ms

**Diagnóstico:**

```python
# 1. Ver SQL ejecutado
# En production: revisar logs

# 2. Usar EXPLAIN en Supabase Console
EXPLAIN ANALYZE
SELECT * FROM reservation 
WHERE date = '2026-05-24' AND shift = 'comida';

# 3. Agregar índice si es necesario
CREATE INDEX idx_reservation_date_shift 
ON reservation(date, shift);
```

**Soluciones comunes:**

```python
# ❌ LENTO: N+1 query
for client in Client.query.all():
    visits = Reservation.query.filter_by(client_id=client.id).count()

# ✅ RÁPIDO: 1 query
results = db.session.query(
    Client,
    func.count(Reservation.id).label('visits')
).outerjoin(Reservation).group_by(Client.id).all()

# ✅ RÁPIDO: Eager load
Client.query.options(
    db.joinedload(Client.reservations)
).all()
```

---

### 🐛 Arreglar un Bug

**Paso 1: Reproducir**
```bash
# ¿Qué exactamente va mal?
# ¿Se ve en logs?
# ¿Es error 404, 500, etc?

# Ver logs en Render
tail -f logs/season.log
```

**Paso 2: Identificar causa**
```python
# Agregar print() o logger.debug()
logger.debug(f'Variable x = {x}')
logger.debug(f'Query result = {result}')

# Rerun
python app.py
# Reproduce el error
# Ver logs
```

**Paso 3: Arreglar**
```python
# Cambia el código
# Prueba localmente
# Verifica que funciona
```

**Paso 4: Commit**
```bash
git add .
git commit -m "fix: Describir el bug y cómo se arregló"
git push origin main
```

---

## 🎯 Decisiones de Diseño: Por Qué?

### ¿Por qué PostgreSQL y no SQLite?

**Situación:** Cada deploy perdía datos
**Solución:** PostgreSQL (Supabase) - datos en servidor remoto
**Beneficio:** Persistencia garantizada ✅

### ¿Por qué Pydantic para validación?

**Alternativa:** Validar manualmente con `if not ... else raise`
**Beneficio:** Automático + errores descriptivos + documentado ✅

### ¿Por qué servicios separados de rutas?

**Alternativa:** Lógica directamente en @app.route
**Beneficio:** Reutilizable + testeable + mantenible ✅

### ¿Por qué caché en memoria?

**Alternativa:** Consultar BD siempre
**Beneficio:** 2s TTL = mucho más rápido ✅

---

## 🚨 Errores Comunes (y cómo evitarlos)

### ❌ ERROR 1: Olvidar validador en endpoint

```python
# ❌ MALO
@api.route('/reservations', methods=['POST'])
def create_reservation():
    data = request.json  # ← Sin validar!
    res_svc.create_reservation(data)

# ✅ BIEN
@api.route('/reservations', methods=['POST'])
@validate_and_handle(ReservationCreate)  # ← Valida
def create_reservation(data: ReservationCreate):
    res_svc.create_reservation(data.dict())
```

**Prevención:** Siempre usa `@validate_and_handle`

---

### ❌ ERROR 2: Query N+1

```python
# ❌ MALO (para 100 clientes = 101 queries!)
clients = Client.query.all()
for client in clients:
    visits = Reservation.query.filter_by(client_id=client.id).count()
    # Query por cada cliente ← LENTO

# ✅ BIEN (1 query)
results = db.session.query(
    Client,
    func.count(Reservation.id).label('visits')
).outerjoin(Reservation)\
 .group_by(Client.id).all()
```

**Prevención:** Usa `func.count()`, `func.sum()` para stats

---

### ❌ ERROR 3: No loguear errores

```python
# ❌ MALO
try:
    do_something()
except Exception:
    return error_response('Error', 500)  # ← Qué error?

# ✅ BIEN
try:
    do_something()
except Exception as e:
    logger.error(f'Error al hacer X: {str(e)}')
    return error_response('Error al hacer X', 500)
```

**Prevención:** Loguea SIEMPRE el error, no solo el usuario final

---

### ❌ ERROR 4: No cachear queries lentas

```python
# ❌ MALO (100 requests = 100 queries)
@api.route('/api/dashboard')
def dashboard():
    tables = res_svc.get_table_status(date, shift)  # ← Query cada vez
    return jsonify(tables)

# ✅ BIEN (100 requests = 1 query cada 2 segundos)
@api.route('/api/dashboard')
def dashboard():
    cache_key = f'dashboard:{date}:{shift}'
    cached = cache_get(cache_key, max_age=2)
    if cached:
        return jsonify(cached)
    
    tables = res_svc.get_table_status(date, shift)
    cache_set(cache_key, tables)
    return jsonify(tables)
```

**Prevención:** Caché en endpoints frequently-called

---

## 📚 Cheat Sheet Rápido

### Agregar Feature Nueva

```python
# 1. Servicio
def my_function(params):
    # Lógica de negocio aquí
    return resultado

# 2. Validador
class MySchema(BaseModel):
    field: str

# 3. Endpoint
@api.route('/api/endpoint', methods=['GET'])
@validate_and_handle(MySchema)
def endpoint(data: MySchema):
    result = my_service.my_function(data.dict())
    return jsonify(result)
```

### Manejo de Errores

```python
# En servicio: raise ValueError para errores de negocio
if not valid:
    raise ValueError('Descripción clara del error')

# En endpoint: decorador @handle_errors maneja automáticamente
@api.route('/endpoint', methods=['POST'])
@handle_errors
def endpoint():
    svc.do_something()  # Si error → 400 o 500 automáticamente
```

### Logging

```python
# En cualquier lugar
logger.info('Evento importante')
logger.warning('Algo sospechoso')
logger.error('Error grave')

# Ver logs
tail -f logs/season.log
```

### Database Query

```python
# Obtener todos
items = Model.query.all()

# Filtrar
items = Model.query.filter_by(column=value).all()

# Con join
items = Model.query.join(OtherModel).filter(...).all()

# Con agregación
count = db.session.query(func.count(Model.id)).scalar()
sum_val = db.session.query(func.sum(Model.value)).scalar()
```

---

## ✅ Checklist Antes de Push

- [ ] Código probado localmente
- [ ] Sin errores en logs
- [ ] Validación en todos los inputs
- [ ] Errores logged
- [ ] Commit message descriptivo
- [ ] Sin credenciales en código
- [ ] Sin imports no usados

---

## 🆘 Si Todo Se Rompe

```bash
# 1. Ver estado
git status

# 2. Revertir último commit
git reset --soft HEAD~1

# 3. Revertir cambios
git checkout -- .

# 4. Ver logs
tail -f logs/season.log

# 5. Preguntar en ARQUITECTURA.md si existe similar
```

---

## 📞 Cuándo Consultar ARQUITECTURA.md

- ¿Dónde va el código? → Estructura de Carpetas
- ¿Cómo funcionan los modelos? → Modelos de Datos
- ¿Cuál es el endpoint para X? → API Endpoints
- ¿Cómo valido datos? → Sistema de Validación
- ¿Cómo manejo errores? → Manejo de Errores
- ¿Qué endpoints existen? → API Endpoints
- ¿Cómo cachear? → Deployment y Optimizaciones

---

**La clave:** Si algo no está claro, **agrega documentación aquí mismo**. Que el siguiente desarrollador no se líe.

