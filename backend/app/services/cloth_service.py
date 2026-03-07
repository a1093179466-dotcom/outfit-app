import json
from pathlib import Path
from typing import List, Optional
from app.core.config import UPLOAD_DIR
from app.repositories import cloth_repo

def row_to_out(row: dict, base_url: str = "") -> dict:
    seasons = json.loads(row["seasons"])
    image_path = row.get("image_path")
    image_url = f"{base_url}{image_path}" if image_path else None

    # 新字段
    category = row.get("category") or "top"
    layer = row.get("layer") or "inner"
    try:
        features = json.loads(row.get("features") or "[]")
    except:
        features = []
    vlevel = row.get("versatile_level")
    if vlevel is None:
        vlevel = 2 if row["versatile"] == 1 else 0

    return {
        "id": row["id"],
        "name": row["name"],
        "type": row["type"],
        "seasons": seasons,
        "versatile": row["versatile"] == 1,
        "category": category,
        "layer": layer,
        "features": features,
        "versatile_level": int(vlevel),
        "image_url": image_url,
        "created_at": row["created_at"],
    }

def list_clothes(base_url: str = "") -> List[dict]:
    return [row_to_out(r, base_url) for r in cloth_repo.list_clothes()]

def create_cloth(name: str, type_: str, seasons: list, versatile: bool, base_url: str = "",
                 category=None, layer=None, features=None, versatile_level=None) -> dict:
    row = cloth_repo.create_cloth(name, type_, seasons, versatile, category, layer, features, versatile_level)
    return row_to_out(row, base_url)


def update_cloth(
    cloth_id: str,
    name=None,
    type_=None,
    seasons=None,
    versatile=None,
    kind=None,          # ✅ 加这一行
    base_url: str = "",
):
    row = cloth_repo.update_cloth(
        cloth_id,
        name=name,
        type_=type_,
        seasons=seasons,
        versatile=versatile,
        kind=kind,       # ✅ 加这一行
    )
    return row_to_out(row, base_url) if row else None


def delete_cloth(cloth_id: str) -> bool:
    row = cloth_repo.get_cloth(cloth_id)
    if not row:
        return False

    # 先删图片文件（如果有）
    image_path = row.get("image_path")
    if image_path:
        file_path = UPLOAD_DIR / Path(image_path).name
        if file_path.exists():
            try:
                file_path.unlink()
            except:
                pass

    # 再删 DB 记录
    return cloth_repo.delete_cloth(cloth_id)

def _infer_kind(row: dict) -> str:
    # 1) 如果数据库已有 kind，直接用
    k = row.get("kind")
    if k:
        return k

    # 2) 否则尽量从旧 type/category 推断
    t = row.get("type")

    # 套装
    if t in ["jk_set", "daily_set"]:
        return t

    # 旧 top -> inner
    if t == "top":
        return "inner"

    # 旧 skirt/pants -> bottom
    if t in ["skirt", "pants"]:
        return "bottom"

    # 旧 socks/shoes
    if t == "socks":
        return "socks"
    if t == "shoes":
        return "shoes"

    # 兜底
    return "inner"

def row_to_out(row: dict, base_url: str = "") -> dict:
    seasons = json.loads(row["seasons"])
    image_path = row.get("image_path")
    image_url = f"{base_url}{image_path}" if image_path else None

    kind = _infer_kind(row)

    return {
        "id": row["id"],
        "name": row["name"],
        "seasons": seasons,
        "kind": kind,
        "type": row.get("type"),
        "image_url": image_url,
        "created_at": row["created_at"],
    }