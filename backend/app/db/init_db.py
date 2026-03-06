from app.db.database import get_conn

DDL = """
CREATE TABLE IF NOT EXISTS clothes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  seasons TEXT NOT NULL,
  versatile INTEGER NOT NULL DEFAULT 0,
  image_path TEXT,
  created_at INTEGER NOT NULL
);
"""
DDL_OUTFITS = """
CREATE TABLE IF NOT EXISTS outfits (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,          -- YYYY-MM-DD
  items TEXT NOT NULL,         -- JSON array of cloth ids
  note TEXT,
  rating INTEGER,              -- 1..5 or NULL
  created_at INTEGER NOT NULL
);
"""
def init_db() -> None:
    conn = get_conn()
    try:
        conn.execute(DDL)
        conn.execute(DDL_OUTFITS)
        conn.commit()
    finally:
        conn.close()
