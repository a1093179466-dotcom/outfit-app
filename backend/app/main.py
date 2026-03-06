from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from app.core.config import API_PREFIX, UPLOAD_DIR
from app.core.cors import add_cors
from app.api.router import api_router
from app.db.init_db import init_db

def create_app() -> FastAPI:
    app = FastAPI(title="Outfit App API")

    add_cors(app)
    init_db()

    app.include_router(api_router, prefix=API_PREFIX)

    # 让图片可通过 /uploads/... 访问
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

    return app

app = create_app()