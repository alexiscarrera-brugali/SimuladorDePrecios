from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.api.dependencies import CurrentUser, DbSession
from app.core.security import create_access_token, verify_password
from app.db.base import User
from app.schemas.api import LoginRequest, LoginResponse, UserView

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: DbSession) -> LoginResponse:
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if user is None or not user.is_active or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    return LoginResponse(
        access_token=create_access_token(user.id, user.role),
        user=UserView.model_validate(user),
    )


@router.get("/me", response_model=UserView)
def me(user: CurrentUser) -> UserView:
    return UserView.model_validate(user)

