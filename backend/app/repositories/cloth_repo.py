import json
import time
import uuid
from typing import List, Optional

from app.db.database import get_conn


def _infer_kind_from_type(type_: Optional[str]) -> str:
    """
    将旧 type 推断到新 kind（你目前的新体系）
    kind ∈ jk_set | daily_set | outer | inner | bottom | socks | shoes
    """
    if type_ in ["jk_set", "daily_set"]:
        return type_
    if type_ == "top":
        return "inner"
    if type_ in ["skirt", "pants"]:
        return "bottom"
    if type_ == "socks":
        return "socks"
    if type_ == "shoes":
        return "shoes"
    # 兜底：当成内搭
    return "inner"


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


def create_cloth(
    name: str,
    type_: str,
    seasons: list,
    versatile: bool,
    kind: Optional[str] = None,
) -> dict:
    """
    兼容旧字段：
    - 数据库仍有 type/seasons/versatile/image_path/created_at 等
    - 新增 kind 列：用于你新的 7 类体系
    """
    cloth_id = str(uuid.uuid4())
    created_at = int(time.time())

    seasons_json = json.dumps(seasons, ensure_ascii=False)
    versatile_int = 1 if versatile else 0

    if kind is None:
        kind = _infer_kind_from_type(type_)

    conn = get_conn()
    try:
        # 注意：数据库里 kind 列必须已存在（init_db.py 已自动迁移）
        conn.execute(
            """
            INSERT INTO clothes (id, name, type, seasons, versatile, image_path, created_at, kind)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (cloth_id, name, type_, seasons_json, versatile_int, None, created_at, kind),
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
    kind=None,
) -> Optional[dict]:
    """
    更新字段（新旧兼容）：
    - name/type/seasons/versatile/kind
    """
    cur = get_cloth(cloth_id)
    if not cur:
        return None

    new_name = name if name is not None else cur["name"]
    new_type = type_ if type_ is not None else cur.get("type")
    # seasons 存在 DB 中为 JSON 字符串
    if seasons is not None:
        new_seasons = seasons
    else:
        try:
            new_seasons = json.loads(cur["seasons"])
        except Exception:
            new_seasons = ["spring"]

    new_versatile = versatile if versatile is not None else (cur.get("versatile") == 1)

    # kind：如果传了就用；没传就保留；仍为空则从 type 推断
    if kind is not None:
        new_kind = kind
    else:
        new_kind = cur.get("kind") or _infer_kind_from_type(new_type)

    seasons_json = json.dumps(new_seasons, ensure_ascii=False)
    versatile_int = 1 if new_versatile else 0

    conn = get_conn()
    try:
        conn.execute(
            """
            UPDATE clothes
            SET name=?, type=?, seasons=?, versatile=?, kind=?
            WHERE id=?
            """,
            (new_name, new_type, seasons_json, versatile_int, new_kind, cloth_id),
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