# Arquitectura — Agua PR MVP

## Objetivo

Entregar una experiencia móvil simple, accesible y rápida aun con señal limitada. El prototipo usa PMGPT + Google Sheets como backend editorial ligero; la evolución recomendada usa PostgreSQL/PostGIS.

## Capas

### Web
Next.js App Router con exportación estática. La interfaz carga primero HTML/CSS y luego intenta actualizar datos desde `NEXT_PUBLIC_AGUA_PR_DATA_URL`.

### Caché
La última respuesta válida se guarda en `localStorage`. El service worker conserva las rutas principales. La UI identifica explícitamente el modo sin conexión.

### Datos PMGPT
Tabs:
- Municipios
- Estado
- PuntosAgua
- Racionamiento
- Pronostico
- Embalses
- Contactos
- Alertas

### Evolución
1. Reemplazar Sheet por API `/api/v1`.
2. PostgreSQL + PostGIS.
3. Caché de lectura.
4. Jobs oficiales para AAA/NOAA.
5. Panel administrativo con auditoría y 2FA.

## Regla de confianza

La ausencia de datos nunca equivale a “servicio normal”. El estado por defecto es `PENDIENTE`.
