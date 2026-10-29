from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.auth import router as auth_router
from app.api.tasks import router as tasks_router
from app.api.static import install_frontend
from app.api.chat import router as chat_router
from app.core.config import get_settings
from app.core.errors import install_handlers
from app.core.security import write_guard
from app.core.http_safety import RateLimiter, http_safety
from app.core.database import get_engine
from app.core.errors import AppError
from sqlalchemy import text


def create_app(dist=None):
    settings = get_settings()
    app = FastAPI(title="Todo Calendar API", version="1.0.0")
    app.state.limiter = RateLimiter()
    install_handlers(app)
    app.middleware("http")(write_guard)
    app.middleware("http")(http_safety)
    app.add_middleware(CORSMiddleware, allow_origins=settings.origins, allow_credentials=True,
                       allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
                       allow_headers=["Content-Type", "X-Requested-With"])
    app.include_router(auth_router)
    app.include_router(tasks_router)
    app.include_router(chat_router)

    @app.get("/health", tags=["Health"])
    def health():
        return {"data": {"status": "ok"}}

    @app.get("/ready", tags=["Health"])
    def ready():
        with get_engine().connect() as connection:
            connection.execute(text("SELECT 1"))
        return {"data": {"status": "ready"}}

    install_frontend(app, dist)
    return app


app = create_app()
