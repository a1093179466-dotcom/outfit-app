import json
from typing import List, Optional
from app.repositories import outfit_repo

def row_to_out(row: dict) -> dict:
    return {
        "id": row["id"],
        "date": row["date"],
        "items": json.loads(row["items"]),
        "note": row.get("note"),
        "rating": row.get("rating"),
        "created_at": row["created_at"],
    }

def list_outfits(limit: int = 30) -> List[dict]:
    return [row_to_out(r) for r in outfit_repo.list_outfits(limit=limit)]

def create_outfit(date: str, items: list, note: Optional[str], rating: Optional[int]) -> dict:
    row = outfit_repo.create_outfit(date, items, note, rating)
    return row_to_out(row)

def delete_outfit(oid: str) -> bool:
    return outfit_repo.delete_outfit(oid)