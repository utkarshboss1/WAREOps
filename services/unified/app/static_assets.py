"""
static_assets.py — Serve the pre-built React SPA at '/' with index.html fallback.

The Dockerfile builds the SPA in a first stage and copies dist/ to /app/static.
Any request that is not an API route (/api/v1/*) and not a socket.io request
falls through to the SPA. The React router handles client-side routing.
"""
from __future__ import annotations

from pathlib import Path

from fastapi import Request
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles

_STATIC_DIR = Path("/app/static")
_INDEX_FILE = _STATIC_DIR / "index.html"

# Fallback if not running inside Docker (e.g. for local pytest)
if not _STATIC_DIR.exists():
    _STATIC_DIR = Path(__file__).parent / "static"
    _INDEX_FILE = _STATIC_DIR / "index.html"


def get_static_dir() -> Path:
    return _STATIC_DIR


def mount_spa(app) -> None:
    """
    Mount the React SPA static files on the FastAPI app.

    - /assets/* and /favicon.svg etc. are served as true static files.
    - Any other non-API path returns index.html for the React router.

    Must be called AFTER all API routers are registered so the static
    mount doesn't shadow API routes.
    """
    if _STATIC_DIR.exists():
        app.mount(
            "/assets",
            StaticFiles(directory=str(_STATIC_DIR / "assets"), html=False),
            name="assets",
        )

    @app.get("/favicon.svg", include_in_schema=False)
    @app.get("/favicon.ico", include_in_schema=False)
    async def favicon():
        fav = _STATIC_DIR / "favicon.svg"
        if fav.exists():
            return FileResponse(str(fav))
        return HTMLResponse("", status_code=204)

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa_fallback(full_path: str, request: Request):
        """
        SPA fallback: serve index.html for any path not matched by API routers.
        Excludes /api/v1/*, /socket.io/*, /health, /metrics, /docs, /redoc.
        """
        excluded_prefixes = ("/api/v1/", "/socket.io/", "/health", "/metrics", "/docs", "/redoc", "/openapi")
        for prefix in excluded_prefixes:
            if request.url.path.startswith(prefix):
                from fastapi.responses import JSONResponse
                return JSONResponse({"detail": "Not Found"}, status_code=404)

        if _INDEX_FILE.exists():
            return FileResponse(str(_INDEX_FILE), media_type="text/html")

        return HTMLResponse(
            "<html><body><h1>WAREOps</h1>"
            "<p>Frontend not built. Run: cd apps/ops-dashboard && npm run build</p>"
            "</body></html>",
            status_code=200,
        )
