"""Small single-process protections. Never log bodies, cookies or credentials."""
import logging
from collections import deque
from threading import Lock
from time import monotonic
from uuid import uuid4

from app.core.config import get_settings
from app.core.errors import AppError, error_response
from app.core.security import token_user_id

logger = logging.getLogger("uvicorn.error.todo")


class RateLimiter:
    def __init__(self, clock=monotonic):
        self.clock, self.buckets, self.lock = clock, {}, Lock()

    def allow(self, key, limit, window=60):
        with self.lock:
            now = self.clock()
            for old in list(self.buckets):
                if not self.buckets[old] or now - self.buckets[old][-1] >= window:
                    self.buckets.pop(old, None)
            if key not in self.buckets and len(self.buckets)>=10000:
                return window
            queue = self.buckets.setdefault(key, deque())
            while queue and now - queue[0] >= window:
                queue.popleft()
            if len(queue) >= limit:
                return max(1, int(window - (now - queue[0])) + 1)
            queue.append(now)
            return 0


async def http_safety(request, call_next):
    request_id = uuid4().hex
    started = monotonic()
    response = None
    path = request.url.path
    if get_settings().rate_limit_enabled and request.method == "POST":
        group = "auth" if path in ("/api/auth/login", "/api/auth/register") else "ai" if path == "/api/chat" else None
        if group:
            identity = request.client.host if request.client else "unknown"
            if group == "ai":
                try:
                    identity = f"user:{token_user_id(request)}"
                except AppError:
                    pass
            delay = request.app.state.limiter.allow((group, identity), 12 if group == "auth" else 10)
            if delay:
                response = error_response(429, "RATE_LIMITED", "Bạn đang gửi quá nhanh. Hãy chờ rồi thử lại.", {"retry_after_seconds": delay})
                response.headers["Retry-After"] = str(delay)
    try:
        response = response if response is not None else await call_next(request)
    except Exception as exc:
        # Exception type is enough for correlation; exception strings can contain SQL/secrets.
        logger.error("request_id=%s error_type=%s", request_id, type(exc).__name__)
        response = error_response(500, "INTERNAL_ERROR", "Có lỗi ngoài dự kiến. Hãy kiểm tra dữ liệu trước khi gửi lại.")
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    response.headers["Content-Security-Policy"] = ("default-src 'self'; script-src 'self'; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; "
        "img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'") if path not in ("/docs", "/redoc") else "frame-ancestors 'none'"
    if path == "/api" or path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store"
    elif path.startswith("/assets/") and response.status_code == 200:
        response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
    logger.info("request_id=%s method=%s status=%s duration_ms=%s", request_id, request.method, response.status_code, round((monotonic()-started)*1000))
    return response
