# Puesta en marcha local

## Requisitos

- Python 3.12
- Node.js 20+ (probado con Node 24) y npm
- PostgreSQL sólo si se quiere usar en lugar de SQLite (opcional en desarrollo)

## API

```powershell
cd apps/api
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -e ".[dev]"
Copy-Item ../../.env.example ../../.env   # completar APP_SECRET y BOOTSTRAP_ADMIN_PASSWORD
python -m app.cli init-db
uvicorn app.main:app --reload --port 8000
```

Notas:

- Las dependencias se instalan desde `pyproject.toml` (`pip install -e ".[dev]"`), no hay `requirements.txt`.
- Para SQLite local dejá `DATABASE_URL` sin definir en `.env`: se usa el archivo por defecto en `<repo>/data/brugali.db`. Definí `DATABASE_URL` sólo para PostgreSQL.
- El primer usuario administrador se crea al ejecutar `init-db` con `BOOTSTRAP_ADMIN_PASSWORD` (mínimo 10 caracteres) y `BOOTSTRAP_ADMIN_EMAIL` definidos en `.env`. La contraseña no se guarda en el repositorio.

### Crear usuarios adicionales

Para los roles `functional` y `tester` (o más administradores), la contraseña se
pasa por variable de entorno, nunca por argumento:

```powershell
$env:BRUGALI_NEW_USER_PASSWORD = "una-clave-larga"
python -m app.cli create-user --email persona@brugali.com.ar --name "Nombre Apellido" --role functional
```

Roles válidos: `admin_importer`, `functional`, `tester`.

### Pruebas y calidad del backend

```powershell
cd apps/api
.venv\Scripts\python.exe -m pytest        # pruebas de dominio, datos e integración
.venv\Scripts\ruff.exe check .            # lint
```

## Interfaz

```powershell
cd apps/web
npm install
npm run dev
```

Abrir `http://localhost:3000`. La API expone documentación local en `http://localhost:8000/docs`.

### Calidad de la interfaz

```powershell
cd apps/web
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
```

## Migraciones

En este primer corte la base se crea con `create_all` (adecuado para SQLite en
desarrollo). Alembic queda pendiente para el pasaje a PostgreSQL productivo.
