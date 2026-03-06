import json
import time
import uuid
from typing import List, Optional
from app.db.database import get_conn

def list_presets(season: Optional[str] = None, limit: int = 200) -> List[dict]:
    conn = get_conn()
    try:
        if season:
            rows = conn.execute(
                "SELECT * FROM outfit_presets WHERE season=? ORDER BY created_at DESC LIMIT ?",
                (season, limit),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM outfit_presets ORDER BY created_at DESC LIMIT ?",
                (limit,),
            ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()

def create_preset(season: str, items: list, note: Optional[str]) -> dict:
    pid = str(uuid.uuid4())
    created_at = int(time.time())
    items_json = json.dumps(items, ensure_ascii=False)

    conn = get_conn()
    try:
        conn.execute(
            """
            INSERT INTO outfit_presets (id, season, items, note, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (pid, season, items_json, note, created_at),
        )
        conn.commit()
    finally:
        conn.close()

    return get_preset(pid)  # type: ignore

def get_preset(pid: str) -> Optional[dict]:
    conn = get_conn()
    try:
        row = conn.execute("SELECT * FROM outfit_presets WHERE id=?", (pid,)).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()

def delete_preset(pid: str) -> bool:
    conn = get_conn()
    try:
        cur = conn.execute("DELETE FROM outfit_presets WHERE id=?", (pid,))
        conn.commit()
        return cur.rowcount > 0
    finally:
        conn.close()