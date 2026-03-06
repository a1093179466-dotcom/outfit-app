import json
import time
import uuid
from typing import List, Optional

from app.db.database import get_conn


def list_clothes() -> List[dict]:
    conn = get_conn()
    try:
        rows = conn.execute("SELECT * FROM clothes ORDER BY created_at DESC").fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def get_cloth(cloth_id: str) -> Optional[dict]:
    conn = get_conn()
    try:
        row = conn.execute("SELECT * FROM clothes WHERE id=?", (cloth_id,)).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def create_cloth(name: str, type_: str, seasons: list, versatile: bool) -> dict:
    cloth_id = str(uuid.uuid4())
    created_at = int(time.time())
    seasons_json = json.dumps(seasons, ensure_ascii=False)
    versatile_int = 1 if versatile else 0

    conn = get_conn()
    try:
        conn.execute(
            """
            INSERT INTO clothes (id, name, type, seasons, versatile, image_path, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (cloth_id, name, type_, seasons_json, versatile_int, None, created_at),
        )
        conn.commit()
    finally:
        conn.close()

    row = get_cloth(cloth_id)
    assert row is not None
    return row


def update_cloth(
    cloth_id: str,
    *,
    name=None,
    type_=None,
    seasons=None,
    versatile=None,
) -> Optional[dict]:
    cur = get_cloth(cloth_id)
    if not cur:
        return None

    new_name = name if name is not None else cur["name"]
    new_type = type_ if type_ is not None else cur["type"]
    new_seasons = seasons if seasons is not None else json.loads(cur["seasons"])
    new_versatile = versatile if versatile is not None else (cur["versatile"] == 1)

    seasons_json = json.dumps(new_seasons, ensure_ascii=False)
    versatile_int = 1 if new_versatile else 0

    conn = get_conn()
    try:
        conn.execute(
            "UPDATE clothes SET name=?, type=?, seasons=?, versatile=? WHERE id=?",
            (new_name, new_type, seasons_json, versatile_int, cloth_id),
        )
        conn.commit()
    finally:
        conn.close()

    return get_cloth(cloth_id)


def set_image_path(cloth_id: str, image_path: Optional[str]) -> Optional[dict]:
    conn = get_conn()
    try:
        conn.execute("UPDATE clothes SET image_path=? WHERE id=?", (image_path, cloth_id))
        conn.commit()
    finally:
        conn.close()
    return get_cloth(cloth_id)


def delete_cloth(cloth_id: str) -> bool:
    conn = get_conn()
    try:
        cur = conn.execute("DELETE FROM clothes WHERE id=?", (cloth_id,))
        conn.commit()
        return cur.rowcount > 0
    finally:
        conn.close()