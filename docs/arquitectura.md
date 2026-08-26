# Arquitectura del MVP

## Decisiones

- Aplicación de una sola empresa: Brugali.
- Next.js sirve la experiencia de usuario y mantiene los tokens en cookies HTTP-only.
- FastAPI es la única autoridad para reglas, archivos, permisos, cálculos y exportaciones.
- PostgreSQL es el destino operativo; SQLite permite trabajar localmente sin infraestructura.
- Los archivos cargados, secretos y exportaciones se mantienen fuera del repositorio.
- Importaciones confirmadas, simulaciones guardadas y exportaciones producen eventos de auditoría.

## Flujo

```text
Navegador → Next.js → FastAPI → capa de servicio → repositorio → PostgreSQL/SQLite
```

El simulador calcula de inmediato en el navegador con aritmética decimal. FastAPI repite el cálculo antes de guardar o exportar y prevalece ante cualquier diferencia.

