from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[3]  # .../outfit-app
BACKEND_DIR = BASE_DIR / "backend"

DATA_DIR = BACKEND_DIR / "data"
UPLOAD_DIR = BACKEND_DIR / "uploads"

DB_PATH = DATA_DIR / "app.db"

API_PREFIX = "/api"