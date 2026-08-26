from sqlalchemy import select

from app.core.config import get_settings
from app.core.security import hash_password
from app.db.base import Base, Role, User
from app.db.session import SessionLocal, engine


def initialize_database() -> None:
    settings = get_settings()
    # Acceder a la property crea el directorio de datos (destino del SQLite local).
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    Base.metadata.create_all(bind=engine)
    if not settings.bootstrap_admin_password:
        return
    with SessionLocal() as session:
        existing = session.scalar(select(User).where(User.email == settings.bootstrap_admin_email))
        if existing:
            return
        session.add(
            User(
                email=settings.bootstrap_admin_email,
                name="Alexis Carrera",
                role=Role.ADMIN_IMPORTER.value,
                password_hash=hash_password(settings.bootstrap_admin_password),
            )
        )
        session.commit()

