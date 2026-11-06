from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Literal, Optional
from pydantic import Field

class Settings(BaseSettings):
    # 1. Cấu hình API chung
    PROJECT_NAME: str = "Planify Pro API"
    API_V1_STR: str = "/api/v1"

    # 2. Tài khoản Admin (không dùng mật khẩu này để gửi mail)
    ADMIN_USERNAME: str = "Admin"
    ADMIN_EMAIL: str = "admin@planify.local"
    ADMIN_PASSWORD: str = ""
    SMTP_EMAIL: str = ""
    SMTP_PASSWORD: str = ""
    MAIL_PROVIDER: Literal["smtp", "brevo"] = "smtp"
    BREVO_API_KEY: str = ""
    MAIL_FROM_EMAIL: str = ""
    MAIL_FROM_NAME: str = "Planify Pro"

    # 3. Cấu hình Bảo mật (JWT)
    SECRET_KEY: str = ""
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 11520

    # 4. Cấu hình kết nối Cơ sở dữ liệu
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_DB: str = "web_base"
    HOST_PORT_DB: str = "5432"
    DATABASE_URL: Optional[str] = None
    DATABASE_SSL: bool = False
    DATABASE_POOL_SIZE: int = Field(default=20, ge=1)
    DATABASE_MAX_OVERFLOW: int = Field(default=10, ge=0)

    # 5. Cấu hình kết nối Redis
    HOST_PORT_REDIS: str = "6379"
    REDIS_PASSWORD: Optional[str] = None
    REDIS_URL: Optional[str] = None

    # 6. Cấu hình AI Agent (Groq / OpenAI compatible)
    AI_API_KEY: Optional[str] = None
    API_KEY: Optional[str] = None
    AI_MODEL: str = "openai/gpt-oss-20b"
    SCHEDULER_ENABLED: bool = True

    def validate_security(self) -> None:
        if len(self.SECRET_KEY) < 32 or self.SECRET_KEY in {
            "planify_super_secret_jwt_key_2026_secure", "CHANGE_ME_GENERATE_A_RANDOM_SECRET_KEY"
        } or any(marker in self.SECRET_KEY.lower() for marker in ("your_", "change_me", "replace-with", "example")):
            raise RuntimeError("SECRET_KEY must be a private random value of at least 32 characters.")
        if self.ADMIN_PASSWORD and (len(self.ADMIN_PASSWORD) < 8 or self.ADMIN_PASSWORD in {
            "Admin@123456", "YOUR_SECRET_PASSWORD", "MAT_KHAU_ADMIN"
        }):
            raise RuntimeError("Replace the example ADMIN_PASSWORD or leave it empty to disable bootstrap.")

    @property
    def get_ai_api_key(self) -> str:
        key = (self.AI_API_KEY or self.API_KEY or "").strip()
        if key in ("", "your_groq_api_key_here", "none", "null"):
            return ""
        return key

    @property
    def get_redis_url(self) -> str:
        if self.REDIS_URL:
            return self.REDIS_URL
        password_part = f":{self.REDIS_PASSWORD}@" if self.REDIS_PASSWORD else ""
        return f"redis://{password_part}localhost:{self.HOST_PORT_REDIS}/0"

    @property
    def get_database_url(self) -> str:
        if self.DATABASE_URL:
            return self.DATABASE_URL
        return f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@localhost:{self.HOST_PORT_DB}/{self.POSTGRES_DB}"

    model_config = SettingsConfigDict(
        case_sensitive=True,
        env_file=(".env", "/workspace/.env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
