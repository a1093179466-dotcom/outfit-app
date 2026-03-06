import json
from pathlib import Path
from typing import List, Optional

from app.core.config import UPLOAD_DIR
from app.repositories import cloth_repo


def row_to_out(row: dict, base_url: str = "") -> dict:
    seasons = json.loads(row["seasons"])
    image_path = row.get("image_path")
    image_url = f"{base_url}{image_path}" if image_path else None
    return {
        "id": row["id"],
        "name": row["name"],
        "type": row["type"],
        "seasons": seasons,
        "versatile": row["versatile"] == 1,
        "image_url": image_url,
        "created_at": row["created_at"],
    }


def list_clothes(base_url: str = "") -> List[dict]:
    return [row_to_out(r, base_url) for r in cloth_repo.list_clothes()]


def create_cloth(name: str, type_: str, seasons: list, versatile: bool, base_url: str = "") -> dict:
    row = cloth_repo.create_cloth(name, type_, seasons, versatile)
    return row_to_out(row, base_url)


def update_cloth(
    cloth_id: str,
    name=None,
    type_=None,
    seasons=None,
    versatile=None,
    base_url: str = "",
) -> Optional[dict]:
    row = cloth_repo.update_cloth(cloth_id, name=name, type_=type_, seasons=seasons, versatile=versatile)
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