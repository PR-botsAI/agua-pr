# Agua PR

PWA móvil, accesible y de bajo consumo de datos para información confiable sobre agua en Puerto Rico. La primera versión se pilota en **Arecibo**.

## Principios del MVP

1. Decir si hay agua o no.
2. Mostrar cuándo regresa el servicio.
3. Encontrar agua cercana.
4. Mostrar el pronóstico en lenguaje sencillo.
5. Proveer teléfonos confiables.

Los datos no verificados se muestran explícitamente como pendientes. El MVP **no inventa** teléfonos, puntos de distribución, horarios ni estados de servicio.

## Stack

- Next.js 16 App Router + TypeScript
- Exportación estática para GitHub Pages
- PWA ligera con service worker
- PMGPT + Google Sheets como fuente de datos del prototipo
- Arquitectura preparada para migrar a PostgreSQL/PostGIS + API

## Desarrollo

```bash
npm install
npm run dev
```

Para conectar la fuente PMGPT:

```bash
NEXT_PUBLIC_AGUA_PR_DATA_URL="https://<host>/api/public/landing-pages/<pageId>/sheet-data" npm run dev
```

## Despliegue

El workflow de GitHub Pages compila el proyecto como `output: export`.

## Seguridad y confianza

- No requiere cuenta para consultar.
- Ubicación solo al tocar “Usar mi ubicación”.
- No almacena dirección exacta.
- Todo dato debe llevar fuente y fecha de actualización.
- Reportes comunitarios se consideran no confirmados hasta revisión.
