from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT_DIR = Path(__file__).resolve().parents[4]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(ROOT_DIR / ".env",),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "Brugali · Costos y precios"
    app_secret: str = Field(default="development-only-change-this-secret", min_length=32)
    database_url: str = f"sqlite:///{(ROOT_DIR / 'data' / 'brugali.db').as_posix()}"
    bootstrap_admin_email: str = "alexis.carrera@brugali.com.ar"
    bootstrap_admin_password: str | None = None
    allowed_origins: str = "http://localhost:3000"
    max_upload_mb: int = 25
    access_token_minutes: int = 480

    @property
    def origin_list(self) -> list[str]:
        return [item.strip() for item in self.allowed_origins.split(",") if item.strip()]

    @property
    def data_dir(self) -> Path:
        path = ROOT_DIR / "data"
        path.mkdir(parents=True, exist_ok=True)
        return path


@lru_cache
def get_settings() -> Settings:
    return Settings()

