from app.db.database import get_conn

DDL_CLOTHES = """
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
  date TEXT NOT NULL,
  items TEXT NOT NULL,
  note TEXT,
  rating INTEGER,
  created_at INTEGER NOT NULL
);
"""

# Step 1: 新增列（若已存在则跳过）
NEW_COLUMNS = [
    ("category", "TEXT"),
    ("layer", "TEXT"),
    ("features", "TEXT"),
    ("versatile_level", "INTEGER"),
]

def _column_exists(conn, table: str, column: str) -> bool:
    rows = conn.execute(f"PRAGMA table_info({table})").fetchall()
    return any(r[1] == column for r in rows)

def _ensure_columns(conn) -> None:
    for col, col_type in NEW_COLUMNS:
        if not _column_exists(conn, "clothes", col):
            conn.execute(f"ALTER TABLE clothes ADD COLUMN {col} {col_type}")

def init_db() -> None:
    conn = get_conn()
    try:
        conn.execute(DDL_CLOTHES)
        conn.execute(DDL_OUTFITS)
        conn.execute(DDL_PAIR_RULES)
        conn.execute(DDL_PRESETS)
        _ensure_columns(conn)
        conn.commit()
    finally:
        conn.close()

DDL_PAIR_RULES = """
CREATE TABLE IF NOT EXISTS pair_rules (
  id TEXT PRIMARY KEY,
  a_id TEXT NOT NULL,
  b_id TEXT NOT NULL,
  rule TEXT NOT NULL,         -- "allow" or "deny"
  note TEXT,
  created_at INTEGER NOT NULL,
  UNIQUE(a_id, b_id)
);
"""

DDL_PRESETS = """
CREATE TABLE IF NOT EXISTS outfit_presets (
  id TEXT PRIMARY KEY,
  season TEXT NOT NULL,        -- spring/summer/autumn/winter
  items TEXT NOT NULL,         -- JSON array of cloth ids
  note TEXT,
  created_at INTEGER NOT NULL
);
"""