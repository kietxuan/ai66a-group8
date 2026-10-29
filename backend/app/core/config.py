from pathlib import Path
from functools import lru_cache
from urllib.parse import urlsplit

from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import make_url

ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT / ".env", extra="ignore")
    database_url: str
    test_database_url: str | None = None
    jwt_secret_key: str
    jwt_expire_minutes: int = 60
    cors_origins: str = "http://localhost:5173"
    cookie_secure: bool = False
    groq_api_key: SecretStr = Field(default=SecretStr(""), repr=False)
    groq_model: str = "openai/gpt-oss-20b"
    ai_timeout_seconds: int = 20
    ai_max_completion_tokens: int = 1024
    chat_execution_enabled: bool = True
    db_connect_timeout: int = Field(default=5, ge=1, le=30)
    db_statement_timeout_ms: int = Field(default=15000, ge=1000, le=60000)
    db_lock_timeout_ms: int = Field(default=5000, ge=500, le=30000)
    max_request_bytes: int = Field(default=32768, ge=8192, le=1048576)
    rate_limit_enabled: bool = True

    @field_validator("jwt_secret_key")
    @classmethod
    def secret(cls, value):
        if len(value.strip()) < 32 or any(x in value.lower() for x in ("replace", "example", "change-me")):
            raise ValueError("JWT_SECRET_KEY must be a random secret of at least 32 characters")
        return value

    @field_validator("database_url")
    @classmethod
    def database(cls, value):
        if make_url(value).drivername != "postgresql+psycopg":
            raise ValueError("DATABASE_URL must use postgresql+psycopg")
        return value

    @model_validator(mode="after")
    def limits(self):
        if not 1 <= self.jwt_expire_minutes <= 1440 or not 1 <= self.ai_timeout_seconds <= 60:
            raise ValueError("Invalid JWT expiry or AI timeout")
        if not 256 <= self.ai_max_completion_tokens <= 4096:
            raise ValueError("AI_MAX_COMPLETION_TOKENS must be between 256 and 4096")
        if not self.groq_model.strip() or self.groq_model != self.groq_model.strip():
            raise ValueError("GROQ_MODEL must be a nonempty model ID without surrounding whitespace")
        if not self.origins or "*" in self.origins:
            raise ValueError("Explicit CORS_ORIGINS required")
        for origin in self.origins:
            parsed = urlsplit(origin)
            try:
                valid_port = parsed.port
            except ValueError:
                raise ValueError("Invalid origin port") from None
            if (parsed.scheme not in ("http", "https") or not parsed.hostname
                    or parsed.username or parsed.password or parsed.path
                    or parsed.query or parsed.fragment or "*" in origin):
                raise ValueError("Origins must contain only scheme, host and optional port")
        if self.cookie_secure and any(not x.startswith("https://") for x in self.origins):
            raise ValueError("Secure cookies require HTTPS origins")
        return self

    @property
    def origins(self):
        return [x.strip().rstrip("/") for x in self.cors_origins.split(",") if x.strip()]


@lru_cache
def get_settings():
    return Settings()
