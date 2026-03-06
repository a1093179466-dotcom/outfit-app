from fastapi import APIRouter, HTTPException, Query
from app.models.outfit import OutfitCreate, OutfitOut
from app.services import outfit_service

router = APIRouter(prefix="/outfits", tags=["outfits"])

@router.get("", response_model=list[OutfitOut])
def get_outfits(limit: int = Query(30, ge=1, le=200)):
    return outfit_service.list_outfits(limit=limit)

@router.post("", response_model=OutfitOut)
def post_outfit(payload: OutfitCreate):
    return outfit_service.create_outfit(payload.date, payload.items, payload.note, payload.rating)

@router.delete("/{oid}")
def delete_outfit(oid: str):
    ok = outfit_service.delete_outfit(oid)
    if not ok:
        raise HTTPException(status_code=404, detail="Outfit not found")
    return {"ok": True}