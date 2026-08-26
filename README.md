# Brugali · Tablero de costos y precios

MVP local para importar la planilla comercial, revisar calidad de datos, consultar costos y precios vigentes, simular márgenes en doble vía y exportar un Excel analítico.

## Estructura

- `apps/api`: FastAPI, reglas comerciales, importación, persistencia y exportación.
- `apps/web`: Next.js y sistema visual derivado de la identidad Brugali.
- `docs`: reglas funcionales, decisiones y guía de operación.
- `infra`: configuración para PostgreSQL.

## Inicio rápido

1. Copiar `.env.example` como `.env` y definir secretos locales.
2. Ejecutar `docker compose up -d db` para PostgreSQL, o usar SQLite durante desarrollo.
3. Instalar y ejecutar la API desde `apps/api`.
4. Instalar y ejecutar la interfaz desde `apps/web`.

Las instrucciones completas se encuentran en `docs/puesta-en-marcha.md`.

