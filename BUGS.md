# 🐛 BUGS - Season Restaurant System

## Bug #1: Mesa se desasigna al cambiar comensales en edición
**Estado:** 🔴 ACTIVO  
**Severidad:** Media  
**Reportado:** 2026-05-25  
**Asignado a:** Implementación futura  

### Descripción
Cuando editas una reserva y cambias el número de comensales, la mesa asignada se desasigna y marca la reserva como "pendiente".

### Pasos para reproducir
1. Crear una reserva para 4 personas en una mesa específica (ej: Mesa 3)
2. Abrir la reserva para editar
3. Cambiar comensales de 4 a 2 o 3
4. Observar que la mesa se deselecciona ("Asignar después")
5. La reserva queda en rojo como "Pendiente"

### Causa técnica
En `static/js/reservations.js`:
- **Línea 238:** Evento `change` en `resGuests` llama a `loadAvailableTables()`
- **Línea 189:** `loadAvailableTables()` limpia el select: `select.innerHTML = '<option value="">Asignar después</option>';`
- **Resultado:** Pérdida de la mesa previamente asignada

### Lógica esperada
- Si estamos editando una reserva con mesa asignada
- Y la mesa actual sigue siendo válida para el nuevo número de comensales
- **DEBE preservar la mesa asignada** en lugar de limpiar el select

### Solución propuesta
Modificar `loadAvailableTables()` para:
1. Detectar si está en modo edición
2. Preservar la mesa asignada actual en la opción "actual"
3. Solo agregar nuevas mesas disponibles, sin limpiar la actual

```javascript
// ANTES (línea 189):
select.innerHTML = '<option value="">Asignar después</option>';

// DESPUÉS (propuesto):
const currentTableId = select.value; // Preservar mesa actual
select.innerHTML = '<option value="">Asignar después</option>';
if (currentTableId && !isEdit) {
    // Solo limpiar si NO estamos editando
}
```

### Impacto
- 🔴 El usuario no puede cambiar solo el número de comensales sin reasignar mesa
- 🔴 Las reservas quedan marcadas como "Pendiente" incorrectamente
- 🔴 Flujo de edición es confuso y no intuitivo

### Archivos afectados
- `static/js/reservations.js` (líneas 177-220, 238-240)
- `routes/api.py` (validación de actualización)

---

## Bug #2: [Próximos bugs irán aquí]
