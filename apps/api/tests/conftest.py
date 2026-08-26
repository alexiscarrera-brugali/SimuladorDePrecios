"""Fixtures de prueba.

Se fuerza una base SQLite temporal y un secreto de prueba **antes** de importar
la aplicación, de modo que el motor real apunte a un archivo desechable y nunca
se toque la base de desarrollo ni se ejecute el bootstrap de administrador.
"""

import os
import tempfile
from collections.abc import Iterator
from pathlib import Path

import pytest

_TMP_DIR = Path(tempfile.mkdtemp(prefix="brugali-tests-"))
os.environ["DATABASE_URL"] = f"sqlite:///{(_TMP_DIR / 'test.db').as_posix()}"
os.environ["APP_SECRET"] = "test-secret-value-that-is-long-enough-1234"
os.environ["BOOTSTRAP_ADMIN_PASSWORD"] = ""

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app.core.security import hash_password  # noqa: E402
from app.db.base import Base, Role, User  # noqa: E402
from app.db.session import SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(autouse=True)
def _reset_database() -> Iterator[None]:
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db_session() -> Iterator[Session]:
    with SessionLocal() as session:
        yield session


@pytest.fixture
def make_user():
    def _make(
        email: str,
        role: Role,
        password: str = "clave-de-prueba-larga",
        name: str = "Persona de prueba",
    ) -> User:
        with SessionLocal() as session:
            user = User(
                email=email.lower(),
                name=name,
                role=role.value,
                password_hash=hash_password(password),
            )
            session.add(user)
            session.commit()
            session.refresh(user)
            session.expunge(user)
            return user

    return _make


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def auth_header(client: TestClient, make_user):
    def _login(email: str, role: Role, password: str = "clave-de-prueba-larga") -> dict[str, str]:
        make_user(email, role, password)
        response = client.post("/auth/login", json={"email": email, "password": password})
        assert response.status_code == 200, response.text
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    return _login
