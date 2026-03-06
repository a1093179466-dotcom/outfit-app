import json
import time
import uuid
from typing import List, Optional
from app.db.database import get_conn

def _infer_category_layer_from_type(type_: str) -> tuple[str, str]:
    # category, layer
    if type_ in ["jk_set", "daily_set"]:
        return ("dress", "none")
    if type_ == "top":
        return ("top", "inner")
    if type_ == "skirt":
        return ("skirt", "none")
    if type_ == "shoes":
        return ("shoes", "none")
    if type_ == "socks":
        return ("socks", "none")
    return ("top", "inner")

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
    category: Optional[str] = None,
    layer: Optional[str] = None,
    features: Optional[list] = None,
    versatile_level: Optional[int] = None,
) -> dict:
    cloth_id = str(uuid.uuid4())
    created_at = int(time.time())
    seasons_json = json.dumps(seasons, ensure_ascii=False)
    versatile_int = 1 if versatile else 0

    if category is None or layer is None:
        cat, lay = _infer_category_layer_from_type(type_)
        category = category or cat
        layer = layer or lay

    features = features or []
    features_json = json.dumps(features, ensure_ascii=False)

    if versatile_level is None:
        versatile_level = 2 if versatile else 0

    conn = get_conn()
    try:
        conn.execute(
            """
            INSERT INTO clothes (id, name, type, seasons, versatile, image_path, created_at, category, layer, features, versatile_level)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (cloth_id, name, type_, seasons_json, versatile_int, None, created_at, category, layer, features_json, versatile_level),
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
    category=None,
    layer=None,
    features=None,
    versatile_level=None,
) -> Optional[dict]:
    cur = get_cloth(cloth_id)
    if not cur:
        return None

    new_name = name if name is not None else cur["name"]
    new_type = type_ if type_ is not None else cur["type"]
    new_seasons = seasons if seasons is not None else json.loads(cur["seasons"])
    new_versatile = versatile if versatile is not None else (cur["versatile"] == 1)

    # 新字段（若不存在则推断/默认）
    cur_category = cur.get("category")
    cur_layer = cur.get("layer")
    cur_features = cur.get("features")
    cur_vlevel = cur.get("versatile_level")

    inferred_cat, inferred_layer = _infer_category_layer_from_type(new_type)

    new_category = category if category is not None else (cur_category or inferred_cat)
    new_layer = layer if layer is not None else (cur_layer or inferred_layer)

    if features is not None:
        new_features = features
    else:
        try:
            new_features = json.loads(cur_features) if cur_features else []
        except:
            new_features = []

    if versatile_level is not None:
        new_vlevel = versatile_level
    else:
        if cur_vlevel is None:
            new_vlevel = 2 if new_versatile else 0
        else:
            new_vlevel = int(cur_vlevel)

    seasons_json = json.dumps(new_seasons, ensure_ascii=False)
    features_json = json.dumps(new_features, ensure_ascii=False)
    versatile_int = 1 if new_versatile else 0

    conn = get_conn()
    try:
        conn.execute(
            """
            UPDATE clothes
            SET name=?, type=?, seasons=?, versatile=?, category=?, layer=?, features=?, versatile_level=?
            WHERE id=?
            """,
            (new_name, new_type, seasons_json, versatile_int, new_category, new_layer, features_json, new_vlevel, cloth_id),
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