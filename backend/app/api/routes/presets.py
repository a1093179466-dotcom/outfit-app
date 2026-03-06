from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from app.models.preset import PresetCreate, PresetOut
from app.services import preset_service

router = APIRouter(prefix="/presets", tags=["presets"])

@router.get("", response_model=list[PresetOut])
def get_presets(
    season: Optional[str] = Query(default=None),
    limit: int = Query(200, ge=1, le=500),
):
    return preset_service.list_presets(season=season, limit=limit)

@router.post("", response_model=PresetOut)
def post_preset(payload: PresetCreate):
    return preset_service.create_preset(payload.season, payload.items, payload.note)

@router.delete("/{pid}")
def delete_preset(pid: str):
    ok = preset_service.delete_preset(pid)
    if not ok:
        raise HTTPException(status_code=404, detail="Preset not found")
    return {"ok": True}