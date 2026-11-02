from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

class Settings(BaseSettings):
    # 1. Cấu hình API chung
    PROJECT_NAME: str = "Planify Pro API"
    API_V1_STR: str = "/api/v1"

    # 2. Tài khoản Admin
    ADMIN_USERNAME: str = "Admin"
    ADMIN_EMAIL: str = "admin@planify.local"
    ADMIN_PASSWORD: str = "Admin@123456"

    # 3. Cấu hình Bảo mật (JWT)
    SECRET_KEY: str = "planify_super_secret_jwt_key_2026_secure"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 11520

    # 4. Cấu hình kết nối Cơ sở dữ liệu
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_DB: str = "web_base"
    HOST_PORT_DB: str = "5432"
    DATABASE_URL: Optional[str] = None

    # 5. Cấu hình kết nối Redis
    HOST_PORT_REDIS: str = "6379"
    REDIS_PASSWORD: Optional[str] = None
    REDIS_URL: Optional[str] = None

    # 6. Cấu hình AI Agent (Groq / OpenAI compatible)
    AI_API_KEY: Optional[str] = None
    API_KEY: Optional[str] = None
    AI_MODEL: str = "openai/gpt-oss-120b"

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
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
