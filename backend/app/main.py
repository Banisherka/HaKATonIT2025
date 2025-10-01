from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path

from .routers import uploads, runs, logs, export, timeline
from .database import init_db


def create_app() -> FastAPI:
    app = FastAPI(title="Terraform LogViewer API", version="0.1.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(uploads.router, prefix="/api")
    app.include_router(runs.router, prefix="/api")
    app.include_router(logs.router, prefix="/api")
    app.include_router(export.router, prefix="/api")
    app.include_router(timeline.router, prefix="/api")

    # Static files serving
    frontend_path = Path(__file__).resolve().parent.parent.parent / "frontend"
    if frontend_path.exists():
        app.mount("/static", StaticFiles(directory=str(frontend_path)), name="static")
        
        @app.get("/")
        async def serve_frontend():
            return FileResponse(str(frontend_path / "index.html"))
            
        # Serve CSS and JS files directly from root for backward compatibility
        @app.get("/styles.css")
        async def serve_css():
            return FileResponse(str(frontend_path / "styles.css"))
            
        @app.get("/app.js")
        async def serve_js():
            return FileResponse(str(frontend_path / "app.js"))

    @app.on_event("startup")
    async def _startup() -> None:
        init_db()

    return app


app = create_app()


