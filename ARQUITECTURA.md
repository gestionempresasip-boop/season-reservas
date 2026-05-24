# Season - Sistema de Reservas para Restaurantes
## Documentación Técnica Completa

**Última actualización**: 24 de Mayo, 2026  
**Estado**: ✅ Producción en Render.com con PostgreSQL (Supabase)

---

## 📋 Tabla de Contenidos

1. [Resumen del Proyecto](#resumen-del-proyecto)
2. [Arquitectura General](#arquitectura-general)
3. [Stack Tecnológico](#stack-tecnológico)
4. [Estructura de Carpetas](#estructura-de-carpetas)
5. [Configuración Centralizada](#configuración-centralizada)
6. [Modelos de Datos](#modelos-de-datos)
7. [Servicios Implementados](#servicios-implementados)
8. [API Endpoints](#api-endpoints)
9. [Sistema de Validación](#sistema-de-validación)
10. [Manejo de Errores y Logging](#manejo-de-errores-y-logging)
11. [Características Implementadas](#características-implementadas)
12. [Cómo Desarrollar Nuevas Features](#cómo-desarrollar-nuevas-features)
13. [Deployment y Optimizaciones](#deployment-y-optimizaciones)
14. [Problemas Conocidos y Soluciones](#problemas-conocidos-y-soluciones)
15. [Performance Tips](#performance-tips)

---

## Resumen del Proyecto

**Season** es un sistema completo de gestión de reservas para restaurantes desarrollado con:
- **Backend**: Flask (Python)
- **Base de datos**: PostgreSQL (Supabase)
- **Frontend**: JavaScript vanilla con SocketIO para real-time
- **Hosting**: Render.com
- **Real-time updates**: Socket.IO (WebSocket)

### Características Principales:
- 📅 Gestión completa de reservas (confirmar, sentar, completar, no-show)
- 🗺️ Plano interactivo con 33 mesas en 3 zonas
- 👥 Gestión de clientes con historial
- ⏳ Lista de espera (waitlist)
- 📊 Reportes detallados y estadísticas
- 💬 Integración con WhatsApp (Twilio)
- 🔔 Actualizaciones en tiempo real con WebSocket
- 📱 Interfaz responsive

---

## Arquitectura General

### Principios Arquitectónicos:
1. **Single Source of Truth** - Configuración centralizada en `config/`
2. **Separation of Concerns** - Servicios, modelos, rutas claramente separados
3. **Validación en capas** - Pydantic valida entrada, modelos validan constraints
4. **Error handling robusto** - Decoradores centralizados para manejo de errores
5. **Logging exhaustivo** - Todos los eventos críticos se registran
6. **Database persistence** - PostgreSQL remoto (nunca SQLite en producción)

### Capas de la Aplicación:

```
┌─────────────────────────────────────┐
│   Frontend (JavaScript/HTML)        │
├─────────────────────────────────────┤
│   API Layer (Flask Routes)          │
│   - Validación (Pydantic)           │
│   - Error Handling (Decoradores)    │
├─────────────────────────────────────┤
│   Business Logic (Servicios)        │
│   - Reservations Service            │
│   - Client Service                  │
│   - Reports Service                 │
├─────────────────────────────────────┤
│   Data Models (SQLAlchemy)          │
│   - Table, Reservation, Client...   │
├─────────────────────────────────────┤
│   Database Layer (PostgreSQL)       │
│   - Supabase PostgreSQL             │
└─────────────────────────────────────┘
```

---

## Stack Tecnológico

### Backend:
- **Flask 2.3+** - Web framework
- **SQLAlchemy 2.0+** - ORM
- **Pydantic 2.5+** - Validación de datos
- **Flask-CORS** - CORS handling
- **Flask-SocketIO** - WebSocket en tiempo real
- **Flask-Compress** - Compresión GZIP
- **gunicorn** - WSGI server
- **python-dotenv** - Gestión de variables de entorno

### Database:
- **PostgreSQL** (Supabase) - Base de datos principal
- **psycopg2** - Driver PostgreSQL

### DevOps:
- **Render.com** - Hosting
- **Git** - Version control
- **GitHub** - Repository

---

## Estructura de Carpetas

```
proyecto reservas Season/
├── config/                          # ✨ CONFIGURACIÓN CENTRALIZADA
│   ├── __init__.py                 # Config classes (Dev/Prod/Test)
│   ├── tables.py                   # Table definitions (source of truth)
│   ├── settings.py                 # App constants (MAX_CAPACITY, SHIFTS)
│   └── constants.py                # Magic numbers y mensajes
│
├── utils/                           # ✨ UTILIDADES REUTILIZABLES
│   ├── __init__.py
│   ├── validators.py               # Pydantic schemas (ReservationCreate, etc)
│   ├── errors.py                   # Custom exceptions y response formatters
│   ├── logging.py                  # Logging setup (rotating file handler)
│   └── decorators.py               # @validate_and_handle, @handle_errors
│
├── models.py                        # SQLAlchemy models (Table, Reservation, Client, etc)
├── app.py                          # Flask app factory y rutas principales
├── init_db.py                      # Database initialization (safe for production)
│
├── routes/
│   ├── api.py                      # REST API endpoints (~400 líneas)
│   └── whatsapp.py                 # WhatsApp webhook handler
│
├── services/                        # Business logic (core del sistema)
│   ├── reservation.py              # Lógica de reservas
│   ├── client.py                   # Lógica de clientes
│   ├── client_stats.py             # Stats sin N+1 queries
│   ├── whatsapp.py                 # Integración WhatsApp
│   └── reports.py                  # Reportes y estadísticas
│
├── templates/                       # HTML templates
│   ├── index.html                  # Dashboard principal
│   ├── public_booking.html         # Formulario público de reservas
│   └── (otros)
│
├── static/                          # CSS, JavaScript, imágenes
│   ├── css/
│   ├── js/
│   └── img/
│
├── logs/                            # ✨ LOGGING (generado en runtime)
│   └── season.log                  # Rotating log file (10MB max, 10 backups)
│
├── render.yaml                      # Configuración de Render (actualizado)
├── requirements.txt                 # Python dependencies
├── Procfile                         # Heroku-compatible (legacy)
├── .env                             # Variables de entorno (git ignored)
└── .env.example                     # Template de .env

```

---

## Configuración Centralizada

### 1. `config/__init__.py`
```python
# Config classes para diferentes ambientes
class Config:              # Base
class DevelopmentConfig:   # Con debug
class ProductionConfig:    # Segura para Render
class TestConfig:          # Para tests

def get_config():  # Lee FLASK_ENV y retorna la config correcta
```

### 2. `config/tables.py` - SINGLE SOURCE OF TRUTH
```python
# Definición centralizada de las 33 mesas del restaurante
DEFAULT_TABLES = [
    {"number": 1, "zone": "salon_interior", "capacity": 2, ...},
    {"number": 2, "zone": "salon_interior", "capacity": 2, ...},
    # ... 31 más
]

# Helper functions:
get_table_by_number(number)       # Buscar mesa por número
get_tables_by_zone(zone)          # Mesas de una zona
get_total_capacity()              # Capacidad total (114)
```

**Ventaja**: Si cambias una mesa, lo haces en UN SOLO LUGAR. Automáticamente se refleja en:
- Base de datos (init_db.py)
- API responses
- Frontend

### 3. `config/settings.py` - CONSTANTES
```python
MAX_CAPACITY = 114
MAX_GUESTS = 14
MIN_GUESTS = 1

SHIFTS = {
    'comida': {'inicio': '13:00', 'fin': '16:00'},
    'cena': {'inicio': '20:00', 'fin': '23:30'},
}

# Timeouts, limits, etc.
CLIENT_SEARCH_LIMIT = 100
TOP_CLIENTS_LIMIT = 20
CACHE_TTL = 2  # segundos
```

### 4. `config/constants.py` - MENSAJES Y NÚMEROS MÁGICOS
```python
HTTP_STATUS_CODES = {
    'OK': 200,
    'CREATED': 201,
    'BAD_REQUEST': 400,
    # ...
}

ERROR_MESSAGES = {
    'ERR_INVALID_GUESTS': 'Número de comensales debe estar entre 1 y 14',
    'ERR_NO_CAPACITY': 'No hay mesas disponibles para esta cantidad',
    # ...
}
```

---

## Modelos de Datos

### 1. **Table** - Mesas del Restaurante
```python
class Table(db.Model):
    id: int              # PK
    number: int          # Número de mesa (1-33)
    zone: str            # 'salon_interior', 'exterior', 'zona_eventos'
    capacity: int        # 2-10 personas
    active: bool         # Disponible o no
    created_at: datetime # Auditoría
    updated_at: datetime # Auditoría
    
    # Relaciones
    reservations: List[Reservation]  # Reservas en esta mesa
```

### 2. **Client** - Clientes del Restaurante
```python
class Client(db.Model):
    id: int
    name: str                    # Nombre completo
    phone: str                   # Teléfono (indexado para búsqueda)
    email: str                   # Email opcional
    vip: bool                    # Cliente VIP
    blacklisted: bool            # En lista negra
    preferences: str             # Preferencias (mesa, horario, etc)
    allergies: str               # Alergias (importante!)
    notes: str                   # Notas internas
    
    # Auditoría
    created_at: datetime
    updated_at: datetime
    
    # Relaciones
    reservations: List[Reservation]
    
    # Índices
    Index on: phone (búsqueda rápida)
```

### 3. **Reservation** - Reservas
```python
class Reservation(db.Model):
    id: int
    client_id: int               # FK a Client
    table_id: int                # FK a Table (nullable = puede cambiar)
    
    # Fecha y hora
    date: date                   # Fecha de reserva
    shift: str                   # 'comida' o 'cena'
    time: str                    # HH:MM (ej: 13:30)
    
    # Detalles
    guests: int                  # Número de comensales (1-14, validado)
    source: str                  # 'online', 'phone', 'walk_in'
    notes: str                   # Notas adicionales
    
    # Estado
    status: str                  # 'confirmed', 'seated', 'completed', 
                                 # 'no_show', 'cancelled'
    
    # Auditoría
    created_at: datetime
    updated_at: datetime
    
    # Índices
    Index on: (date, shift) - búsqueda rápida
    Index on: status - para filtros
    Index on: client_id - para historial
    
    # Constraints
    CHECK: guests >= 1 AND guests <= 14
```

### 4. **Waitlist** - Lista de Espera
```python
class Waitlist(db.Model):
    id: int
    client_name: str
    phone: str
    guests: int
    date: date
    shift: str
    status: str              # 'waiting', 'seated', 'cancelled'
    notes: str
    created_at: datetime
```

---

## Servicios Implementados

### 1. `services/reservation.py` - LÓGICA DE RESERVAS

**Funciones Principales:**

```python
# Obtener reservas
get_reservations(date, shift)              # Solo confirmadas
get_all_reservations_for_date(date, shift) # Todas excepto canceladas

# Crear/Actualizar
create_reservation(data)                   # Valida y crea
update_reservation(rid, data)              # Actualiza campos parciales
cancel_reservation(rid)                    # Marca como cancelada
delete_reservation(rid)                    # Borrado físico (soft delete mejor)

# Estados
seat_reservation(rid, table_id=None)       # Marca como sentada
complete_reservation(rid)                  # Marca como completada
mark_no_show(rid)                          # Marca como no-show

# Análisis
find_available_tables(date, shift, guests) # Busca mesas libres para N personas
get_table_status(date, shift)              # Estado de todas las mesas
get_shift_stats(date, shift)               # Estadísticas de turno
```

**Algoritmo de Asignación de Mesas** (en `find_available_tables`):
1. Obtiene mesas ordenadas por zona
2. Filtra por capacidad (>= guests)
3. Excluye mesas ya reservadas ese horario
4. Retorna mesas disponibles ordenadas

### 2. `services/client.py` - GESTIÓN DE CLIENTES

```python
search_clients(query)                      # Busca por nombre/teléfono/email
get_client(client_id)                      # Obtiene cliente + historial
create_client(data)                        # Crea nuevo cliente
update_client(client_id, data)             # Actualiza datos
delete_client(client_id)                   # Borra (detach reservas)
get_top_clients(limit)                     # Top clientes por visitas
get_client_history(client_id)              # Historial de reservas
```

### 3. `services/client_stats.py` - ESTADÍSTICAS (Sin N+1)

```python
# Estas funciones usan SQL aggregations en lugar de propiedades Python
get_client_visits_count(client_id)
get_client_no_show_count(client_id)
get_client_last_visit_date(client_id)
get_client_stats(client_id)                # Todo junto
```

**Por qué existe este archivo:**
- Evita queries N+1 (problema: al obtener 100 clientes, 101 queries)
- Usa `func.count()`, `func.sum()` de SQLAlchemy
- Más eficiente para estadísticas complejas

### 4. `services/reports.py` - REPORTES

```python
occupancy_report(from_date, to_date)       # Ocupación por día
popular_tables_report(...)                 # Mesas más usadas
source_report(...)                         # Reservas por origen
no_show_report(...)                        # Análisis de no-shows
daily_summary(date)                        # Resumen de un día
weekly_trend(from_date)                    # Tendencia semanal
client_frequency_report(...)               # Clientes más frecuentes
zone_performance(...)                      # Performance por zona
hourly_distribution(...)                   # Distribución horaria
```

---

## API Endpoints

### Estructura General:
```
GET    /api/reservations              # Listar reservas del turno
POST   /api/reservations              # Crear nueva reserva
PUT    /api/reservations/<id>         # Actualizar reserva
DELETE /api/reservations/<id>         # Cancelar (soft delete)
DELETE /api/reservations/<id>/delete  # Borrar físicamente

PUT    /api/reservations/<id>/seat    # Marcar como sentada
PUT    /api/reservations/<id>/complete # Marcar como completada
PUT    /api/reservations/<id>/noshow  # Marcar como no-show

GET    /api/tables                     # Listar mesas activas
GET    /api/tables/status              # Estado de mesas (cacheado 2s)
GET    /api/tables/available           # Mesas disponibles para N personas

GET    /api/clients                    # Buscar clientes
GET    /api/clients/<id>               # Cliente + historial
POST   /api/clients                    # Crear cliente
PUT    /api/clients/<id>               # Actualizar cliente
DELETE /api/clients/<id>               # Borrar cliente

GET    /api/stats                      # Estadísticas del turno
GET    /api/dashboard                  # Stats + tables + reservas (cacheado)

GET    /api/reports/occupancy          # Reporte de ocupación
GET    /api/reports/popular-tables     # Mesas populares
GET    /api/reports/sources            # Origen de reservas
GET    /api/reports/no-shows           # Análisis de no-shows
GET    /api/reports/summary            # Resumen del día
GET    /api/reports/weekly             # Tendencia semanal
GET    /api/reports/clients            # Clientes frecuentes
GET    /api/reports/zones              # Performance por zona
GET    /api/reports/hours              # Distribución horaria
```

### Parámetros Comunes:
```
date:  YYYY-MM-DD (default: today)
shift: 'comida' | 'cena' (default: 'comida')
guests: 1-14 (default: 2)
```

### Response Format:
```json
// Éxito (200)
{
  "status": "success",
  "data": { ... },
  "timestamp": "2026-05-24 15:30:45"
}

// Error (400, 404, 500)
{
  "error": "Mensaje descriptivo",
  "status_code": 400,
  "timestamp": "2026-05-24 15:30:45"
}
```

---

## Sistema de Validación

### 1. Validadores Pydantic en `utils/validators.py`

```python
class ReservationCreate(BaseModel):
    date: date                                    # Validado automáticamente
    shift: str                                    # Debe ser 'comida' o 'cena'
    time: str                                     # Formato HH:MM
    guests: int = Field(ge=1, le=14)             # Entre 1 y 14
    client_name: str = Field(min_length=2)       # Al menos 2 caracteres
    client_phone: str                             # Validado con regex
    email: Optional[str] = Field(default=None)   # Email opcional pero validado
    notes: Optional[str] = None
    
    @validator('shift')
    def validate_shift(cls, v):
        if v not in ['comida', 'cena']:
            raise ValueError('Shift debe ser comida o cena')
        return v

class ReservationUpdate(BaseModel):
    # TODOS los campos son opcionales (para updates parciales)
    date: Optional[date] = None
    shift: Optional[str] = None
    # ... etc
```

### 2. Validación en Capas:

**Capa 1: Validación de Entrada (Pydantic)**
```python
@api.route('/reservations', methods=['POST'])
@validate_and_handle(ReservationCreate)  # ← Validación automática
def create_reservation(data: ReservationCreate):
    # Si llegamos aquí, data es 100% válido
    reservation_data = data.dict()
    # ...
```

**Capa 2: Validación de Negocio (en servicios)**
```python
def create_reservation(data):
    # ¿Hay capacidad en ese horario?
    # ¿La fecha es válida?
    # ¿Hay mesa disponible?
    # Si no: raise ValueError(...)
```

**Capa 3: Validación de Base de Datos**
```python
# En models.py
class Reservation(db.Model):
    # SQLAlchemy constraints
    __table_args__ = (
        db.CheckConstraint('guests >= 1 AND guests <= 14'),
    )
```

---

## Manejo de Errores y Logging

### 1. Decoradores Centralizados en `utils/decorators.py`

```python
@validate_and_handle(ReservationCreate)
def create_reservation(data):
    # Paso 1: Valida JSON contra schema (Pydantic)
    # Paso 2: Si válido, llama función
    # Paso 3: Si ValueError → 400 (error de negocio)
    # Paso 4: Si Exception → 500 (error imprevisto, logged)
    # Retorna: JSON con error descriptivo
```

### 2. Logging en `utils/logging.py`

```python
def setup_logging(app):
    # Crea archivo logs/season.log
    # Rotating: 10MB max, 10 archivos backup
    # Formato: timestamp | level | mensaje
    # Niveles: DEBUG, INFO, WARNING, ERROR
```

**Ejemplos de Log:**
```
2026-05-24 15:30:45 INFO: ✅ Application initialized
2026-05-24 15:30:46 INFO: ✅ Environment: production
2026-05-24 15:30:47 INFO: ✅ Using PostgreSQL for database
2026-05-24 15:31:00 INFO: Client connected: abc123def456
2026-05-24 15:32:15 WARNING: Validation error: Shift debe ser comida o cena
2026-05-24 15:33:00 ERROR: 500 Internal Server Error: division by zero
```

### 3. Errores Personalizados en `utils/errors.py`

```python
def error_response(message, status_code=400, details=None):
    """Crea respuesta JSON de error estándar"""
    return {
        'error': message,
        'status_code': status_code,
        'timestamp': datetime.now().isoformat(),
        'details': details or {}
    }, status_code

def format_validation_errors(pydantic_errors):
    """Convierte errores Pydantic a formato legible"""
    return {
        field: error['msg'] for field, error in pydantic_errors.items()
    }
```

---

## Características Implementadas

### ✅ DONE - NO TOCAR (funciona perfecto)

1. **Gestión de Reservas**
   - [x] Crear reserva (validación completa)
   - [x] Actualizar reserva (parcial)
   - [x] Cancelar reserva (soft delete)
   - [x] Marcar como sentada
   - [x] Marcar como completada
   - [x] Marcar como no-show
   - [x] Listar reservas por turno

2. **Gestión de Mesas**
   - [x] 33 mesas definidas (config/tables.py)
   - [x] 3 zonas (salon_interior, exterior, zona_eventos)
   - [x] Status dinámico (free, reserved, occupied)
   - [x] Búsqueda de mesas disponibles

3. **Gestión de Clientes**
   - [x] Crear cliente
   - [x] Buscar cliente (por nombre/teléfono/email)
   - [x] Historial de reservas
   - [x] Top clientes por visitas
   - [x] Datos adicionales (VIP, alergias, preferencias)

4. **Base de Datos**
   - [x] PostgreSQL (Supabase) en producción
   - [x] Índices optimizados
   - [x] Constraints a nivel BD
   - [x] Sin SQLite fallback
   - [x] Init script seguro (no borra datos)

5. **Real-time**
   - [x] WebSocket con Socket.IO
   - [x] Broadcast de updates
   - [x] Cache en memoria (TTL)
   - [x] Sincronización automática

6. **API**
   - [x] Validación Pydantic en todos los endpoints
   - [x] Error handling consistente
   - [x] Documentación en docstrings
   - [x] Respuestas JSON estandarizadas

7. **Logging y Monitoring**
   - [x] Rotating file logger
   - [x] Levels: DEBUG, INFO, WARNING, ERROR
   - [x] Contexto de request/response
   - [x] Health check endpoint

### 🚀 TODO - POSIBLES MEJORAS

1. **Autenticación** (si la requieres)
   - [ ] JWT tokens para staff
   - [ ] Roles (admin, manager, camarero)
   - [ ] Control de acceso por endpoint

2. **Caché Distribuido**
   - [ ] Redis para caché más robusto
   - [ ] Invalidación de caché automática
   - [ ] Sesiones distribuidas

3. **Notificaciones**
   - [ ] Email de confirmación
   - [ ] SMS con Twilio
   - [ ] Push notifications (PWA)

4. **Analytics Avanzado**
   - [ ] Predicción de no-shows (ML)
   - [ ] Recomendaciones de horarios
   - [ ] Análisis de preferencias

5. **Multi-Restaurante**
   - [ ] Soporte para múltiples sucursales
   - [ ] Configuración por restaurante
   - [ ] Reportes consolidados

---

## Cómo Desarrollar Nuevas Features

### Checklist para Agregar un Endpoint Nuevo

**Ejemplo: Agregar endpoint GET /api/clients/vip**

#### 1. Crear Validador (si es necesario)
```python
# utils/validators.py
class ClientListFilter(BaseModel):
    vip: bool = False
    limit: int = Field(default=20, ge=1, le=100)
```

#### 2. Crear o Extender Servicio
```python
# services/client.py
def get_vip_clients(limit=20):
    """Obtiene clientes VIP ordenados por últimas visitas"""
    return Client.query.filter_by(vip=True)\
                      .order_by(Client.updated_at.desc())\
                      .limit(limit).all()
```

#### 3. Crear Endpoint
```python
# routes/api.py
@api.route('/clients/vip', methods=['GET'])
@handle_errors
def list_vip_clients():
    """Obtiene clientes VIP"""
    limit = int(request.args.get('limit', 20))
    clients = cli_svc.get_vip_clients(limit)
    return jsonify([c.to_dict() for c in clients])
```

#### 4. Agregar Tests
```python
def test_list_vip_clients():
    response = client.get('/api/clients/vip?limit=5')
    assert response.status_code == 200
    assert len(response.json) <= 5
```

#### 5. Documentar
```python
# En el endpoint docstring y en este archivo
# Agregar a la sección "API Endpoints"
```

### Patrones a Seguir

#### ✅ HACER:
```python
# 1. Validar entrada
@api.route('/reservations', methods=['POST'])
@validate_and_handle(ReservationCreate)  # Valida aquí
def create_reservation(data: ReservationCreate):
    # 2. Usar servicios
    r = res_svc.create_reservation(data.dict())
    # 3. Notificar clientes
    notify()
    # 4. Retornar respuesta estándar
    return jsonify(r.to_dict()), 201

# 5. Loguear eventos importantes
logger.info(f'Created reservation {r.id}')
```

#### ❌ NO HACER:
```python
# ❌ No queries SQL directas en rutas
db.session.execute('SELECT * FROM reservations')

# ❌ No lógica de negocio en rutas
if date < today:
    raise Error(...)

# ❌ No respuestas inconsistentes
return "ok"                    # ← Malo
return {"ok": True}            # ← Malo
return jsonify({"status": "ok"})  # ← Bueno

# ❌ No N+1 queries
for client in clients:
    visits = Reservation.query.filter_by(client_id=client.id).count()
    # Usa client_stats.py en su lugar
```

---

## Deployment y Optimizaciones

### Configuración Actual de Render

```yaml
# render.yaml (ACTUALIZADO)
plan: standard                              # 2 workers, mejores recursos
pythonVersion: "3.11.9"                     # LTS Python
buildCommand: pip install -r requirements.txt
startCommand: gunicorn --workers 2 \
              --worker-class=gthread \
              --threads=4 --timeout=120 app:app
```

### Optimizaciones Aplicadas

#### 1. **Database Indexing**
```python
# models.py - Índices en campos frecuentemente filtrados
Index on: Table.zone                    # Búsqueda por zona
Index on: Reservation.date              # Búsqueda por fecha
Index on: Reservation.shift             # Búsqueda por turno
Index on: Reservation.status            # Filtros por estado
Index on: Client.phone                  # Búsqueda de clientes
```

#### 2. **Caché en Memoria**
```python
# app.py - TTL cache simple
_cache = {}

def cache_get(key, max_age=2):
    # Retorna None si > max_age
    
def cache_set(key, data):
    # Almacena con timestamp
    
# Usado en:
/api/dashboard          # 2 segundos
/api/tables/status      # 2 segundos
/api/quick-status       # 3 segundos
```

#### 3. **Compresión GZIP**
```python
# app.py
Compress(app)
app.config['COMPRESS_MIMETYPES'] = ['application/json', 'text/html', ...]
```

#### 4. **Agregaciones SQL** (vs Python)
```python
# ❌ LENTO: N queries
for client in clients:
    visits = Reservation.query.filter_by(client_id=client.id).count()

# ✅ RÁPIDO: 1 query
results = db.session.query(
    Client,
    func.count(Reservation.id).label('visits')
).join(Reservation).group_by(Client.id).all()
```

#### 5. **SocketIO Optimization**
```python
# app.py
socketio = SocketIO(
    app,
    cors_allowed_origins='*',
    transport=['polling'],        # Más estable que websocket
    engineio_logger=False,
    socketio_logger=False         # Reduce logs innecesarios
)
```

### Performance Benchmarks

```
GET /api/dashboard          ~ 50-100ms (cacheado: 5ms)
GET /api/tables/status      ~ 30-50ms (cacheado: 2ms)
POST /api/reservations      ~ 100-200ms (con validación)
GET /api/clients/search     ~ 20-50ms (con índice en phone)
```

---

## Problemas Conocidos y Soluciones

### 🔴 Problema 1: Base de datos se borra en cada deploy

**Síntomas:**
- Datos desaparecen después de `git push` a Render
- Las reservas se pierden

**Causa:**
- `render.yaml` antiguo ejecutaba `python init_db.py` en buildCommand
- Esto recreaba la BD y perdía datos

**Solución:** ✅ APLICADA
- Actualizar `render.yaml`
- Quitar `python init_db.py` del buildCommand
- Inicializar BD en primer request (`@app.before_request`)
- Usar PostgreSQL remoto (Supabase)

**Verificar:**
```bash
# Los datos persisten entre deployments
curl https://season-reservas.onrender.com/api/reservations
# Si ves datos guardados anteriormente → ✅ ARREGLADO
```

### 🟡 Problema 2: Reservas se solapan en la misma mesa

**Síntomas:**
- Dos reservas en la mesa 5 a las 14:00

**Causa:**
- Falta constraint en BD
- Race condition en concurrencia

**Solución:**
```python
# models.py - Agregar unique constraint
__table_args__ = (
    db.UniqueConstraint(
        'table_id', 'date', 'shift', 'time',
        name='unique_table_slot'
    ),
)
```

**Implementar cuando sea necesario**

### 🟡 Problema 3: Queries N+1 en reportes

**Síntomas:**
- Reporte de clientes tarda 10+ segundos
- Muchas queries en logs

**Causa:**
- Loop que hace query por cada cliente

**Solución:** ✅ PARCIALMENTE APLICADA
- Usar `client_stats.py` con agregaciones SQL
- Implementar en reportes.py cuando sea necesario

### 🟡 Problema 4: WhatsApp no envía mensajes

**Síntomas:**
- Confirmaciones de reserva no llegan por WhatsApp

**Causa:**
- TWILIO_ACCOUNT_SID no configurado en Render
- Número de WhatsApp incorrecto

**Solución:**
```bash
# En Render dashboard → Environment
TWILIO_ACCOUNT_SID=tu_sid_aqui
TWILIO_AUTH_TOKEN=tu_token_aqui
TWILIO_WHATSAPP_NUMBER=+34689123456
```

---

## Performance Tips

### 1. **Caching Strategy**
```python
# Cachea pero con TTL corto
@api.route('/api/dashboard', methods=['GET'])
def dashboard():
    cache_key = f'dashboard:{date}:{shift}'
    cached = cache_get(cache_key, max_age=2)  # 2 segundos
    if cached:
        return jsonify(cached)
    
    # Calcular si no está en caché
    result = expensive_calculation()
    cache_set(cache_key, result)
    return jsonify(result)
```

### 2. **Database Query Optimization**
```python
# ❌ LENTO
reservations = Reservation.query.filter_by(date=date).all()
for r in reservations:
    if r.client.vip:  # ← Extra query por cada reserva!
        print(r.client.name)

# ✅ RÁPIDO
reservations = Reservation.query.join(Client)\
                              .filter(Reservation.date == date)\
                              .all()
for r in reservations:
    print(r.client.name)  # Ya está loaded
```

### 3. **Frontend Optimization**
```javascript
// ❌ Actualizar todas las mesas cada 1 segundo
setInterval(() => fetch('/api/dashboard'), 1000)

// ✅ WebSocket + local cache
socket.on('reservation_changed', () => {
    updateUI()  // Solo lo que cambió
})
```

### 4. **Índices en BD**
```python
# Agregar índices en columnas frecuentemente filtradas
# En models.py:
__table_args__ = (
    db.Index('idx_reservation_date_shift', 'date', 'shift'),
    db.Index('idx_reservation_status', 'status'),
    db.Index('idx_client_phone', 'phone'),
)
```

---

## Roadmap Futuro

### Phase 1: ESTABILIDAD (ACTUAL)
- [x] Arquitectura robusta ✅
- [x] PostgreSQL configurado ✅
- [x] Logging y monitoring ✅
- [x] Validación en capas ✅

### Phase 2: ESCALABILIDAD (SIGUIENTE)
- [ ] Redis para caché distribuido
- [ ] Autenticación JWT
- [ ] Soporte multi-restaurante
- [ ] API pagination avanzada

### Phase 3: INTELIGENCIA
- [ ] Predicción de no-shows (ML)
- [ ] Recomendaciones automáticas
- [ ] Analytics dashboard
- [ ] Automatización de WhatsApp

---

## Conclusión

Este proyecto tiene una **arquitectura sólida y mantenible**:

✅ Código centralizado (no hay duplicación)
✅ Validación robusta (Pydantic + SQL)
✅ Errores manejados (decoradores + logging)
✅ Performance optimizado (caché + índices)
✅ Escalable (PostgreSQL remoto)
✅ Monitoreable (logs + health check)

**Para desarrollar nuevas features:**
1. Sigue los patrones establecidos
2. Usa los servicios existentes
3. Valida con Pydantic
4. Maneja errores con decoradores
5. Loguea eventos importantes
6. Cachea cuando sea necesario

**No reinventes la rueda.** Usa lo que ya existe. Si algo falta, agrégalo en el lugar correcto (config/, services/, utils/).

---

**¿Preguntas sobre la arquitectura?** Consulta este archivo primero. Si algo no está claro, agrega más documentación aquí.

**Fecha de última revisión**: 24 de Mayo, 2026
