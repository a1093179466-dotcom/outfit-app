import json
from typing import List, Optional
from app.repositories import preset_repo

def row_to_out(row: dict) -> dict:
    return {
        "id": row["id"],
        "season": row["season"],
        "items": json.loads(row["items"]),
        "note": row.get("note"),
        "created_at": row["created_at"],
    }

def list_presets(season: Optional[str] = None, limit: int = 200) -> List[dict]:
    return [row_to_out(r) for r in preset_repo.list_presets(season=season, limit=limit)]

def create_preset(season: str, items: list, note: Optional[str]) -> dict:
    row = preset_repo.create_preset(season, items, note)
    return row_to_out(row)

def delete_preset(pid: str) -> bool:
    return preset_repo.delete_preset(pid)