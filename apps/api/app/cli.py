import argparse
import os
import sys

from sqlalchemy import select

from app.core.security import hash_password
from app.db.base import Role, User
from app.db.init import initialize_database
from app.db.session import SessionLocal

PASSWORD_ENV = "BRUGALI_NEW_USER_PASSWORD"


def _create_user(email: str, name: str, role: str) -> int:
    if role not in {item.value for item in Role}:
        print(f"Rol inválido: {role}. Use uno de: {', '.join(r.value for r in Role)}.")
        return 2
    password = os.environ.get(PASSWORD_ENV)
    if not password or len(password) < 10:
        print(
            f"Definí la contraseña en la variable de entorno {PASSWORD_ENV} "
            "(mínimo 10 caracteres). No se acepta por argumento."
        )
        return 2

    initialize_database()
    email = email.strip().lower()
    with SessionLocal() as session:
        if session.scalar(select(User).where(User.email == email)):
            print(f"Ya existe un usuario con el correo {email}.")
            return 1
        session.add(
            User(
                email=email,
                name=name.strip(),
                role=role,
                password_hash=hash_password(password),
            )
        )
        session.commit()
    print(f"Usuario creado: {email} ({role}).")
    return 0


def main() -> None:
    parser = argparse.ArgumentParser(description="Brugali API utilities")
    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser("init-db", help="Crea las tablas y el usuario bootstrap.")

    create = subparsers.add_parser(
        "create-user",
        help=f"Crea un usuario. La contraseña se lee de la variable {PASSWORD_ENV}.",
    )
    create.add_argument("--email", required=True)
    create.add_argument("--name", required=True)
    create.add_argument(
        "--role",
        required=True,
        choices=[item.value for item in Role],
    )

    args = parser.parse_args()
    if args.command == "init-db":
        initialize_database()
        print("Database initialized.")
    elif args.command == "create-user":
        sys.exit(_create_user(args.email, args.name, args.role))


if __name__ == "__main__":
    main()
