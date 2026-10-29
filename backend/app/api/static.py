from pathlib import Path

from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.core.config import ROOT
from app.core.errors import AppError


def install_frontend(app, dist=None):
    dist = Path(dist or ROOT / "frontend/dist").resolve()
    if not (dist / "index.html").is_file():
        return
    if (dist / "assets").is_dir():
        app.mount("/assets", StaticFiles(directory=dist / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        first = path.split("/")[0]
        if first in {"api", "health", "ready", "docs", "redoc", "openapi.json", "assets"}:
            raise AppError(404, "NOT_FOUND", "Không tìm thấy tài nguyên")
        candidate = (dist / path).resolve()
        if candidate.is_relative_to(dist) and candidate.is_file():
            return FileResponse(candidate)
        if Path(path).suffix:
            raise AppError(404, "NOT_FOUND", "Không tìm thấy tài nguyên")
        return FileResponse(dist / "index.html", headers={"Cache-Control": "no-cache"})
