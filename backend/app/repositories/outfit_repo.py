import json
import time
import uuid
from typing import List, Optional

from app.db.database import get_conn

def list_outfits(limit: int = 30) -> List[dict]:
    conn = get_conn()
    try:
        rows = conn.execute(
            "SELECT * FROM outfits ORDER BY created_at DESC LIMIT ?",
            (limit,),
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()

def create_outfit(date: str, items: list, note: str | None, rating: int | None) -> dict:
    oid = str(uuid.uuid4())
    created_at = int(time.time())
    items_json = json.dumps(items, ensure_ascii=False)

    conn = get_conn()
    try:
        conn.execute(
            """
            INSERT INTO outfits (id, date, items, note, rating, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (oid, date, items_json, note, rating, created_at),
        )
        conn.commit()
    finally:
        conn.close()

    return get_outfit(oid)  # type: ignore

def get_outfit(oid: str) -> Optional[dict]:
    conn = get_conn()
    try:
        row = conn.execute("SELECT * FROM outfits WHERE id=?", (oid,)).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()

def delete_outfit(oid: str) -> bool:
    conn = get_conn()
    try:
        cur = conn.execute("DELETE FROM outfits WHERE id=?", (oid,))
        conn.commit()
        return cur.rowcount > 0
    finally:
        conn.close()