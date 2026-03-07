import shutil
from pathlib import Path

from fastapi import APIRouter, UploadFile, File, HTTPException, Request
from app.models.cloth import ClothCreate, ClothUpdate, ClothOut
from app.services import cloth_service
from app.repositories import cloth_repo
from app.core.config import UPLOAD_DIR

router = APIRouter(prefix="/clothes", tags=["clothes"])


@router.get("", response_model=list[ClothOut])
def get_clothes(request: Request):
    base_url = str(request.base_url).rstrip("/")
    return cloth_service.list_clothes(base_url=base_url)


@router.post("", response_model=ClothOut)
def post_cloth(payload: ClothCreate, request: Request):
    base_url = str(request.base_url).rstrip("/")
    return cloth_service.create_cloth(
    payload.name, payload.type, payload.seasons, payload.versatile,
    base_url=base_url,
    category=payload.category,
    layer=payload.layer,
    features=payload.features,
    versatile_level=payload.versatile_level,
)


@router.put("/{cloth_id}", response_model=ClothOut)
def put_cloth(cloth_id: str, payload: ClothUpdate, request: Request):
    base_url = str(request.base_url).rstrip("/")
    updated = cloth_service.update_cloth(
    cloth_id,
    name=payload.name,
    type_=payload.type,
    seasons=payload.seasons,
    kind=payload.kind,              # ✅ 新增参数
    base_url=base_url,
)   
    if not updated:
        raise HTTPException(status_code=404, detail="Cloth not found")
    return updated


@router.post("/{cloth_id}/image", response_model=ClothOut)
def upload_image(cloth_id: str, request: Request, file: UploadFile = File(...)):
    row = cloth_repo.get_cloth(cloth_id)
    if not row:
        raise HTTPException(status_code=404, detail="Cloth not found")

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

    suffix = Path(file.filename).suffix.lower() if file.filename else ".jpg"
    if suffix not in [".jpg", ".jpeg", ".png", ".webp", ".gif"]:
        # 你也可以放开限制，这里先保守一点
        suffix = ".jpg"

    safe_name = f"{cloth_id}{suffix}"
    dst = UPLOAD_DIR / safe_name

    with dst.open("wb") as f:
        shutil.copyfileobj(file.file, f)

    image_path = f"/uploads/{safe_name}"
    cloth_repo.set_image_path(cloth_id, image_path)

    base_url = str(request.base_url).rstrip("/")
    row2 = cloth_repo.get_cloth(cloth_id)
    assert row2 is not None
    return cloth_service.create_cloth(
    payload.name,
    payload.type or payload.kind,   # type 可选，不给就用 kind
    payload.seasons,
    False,                          # versatile 不再使用，先固定 False
    base_url=base_url,
    kind=payload.kind,              # ✅ 新增参数
)


@router.delete("/{cloth_id}")
def delete_cloth(cloth_id: str):
    ok = cloth_service.delete_cloth(cloth_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Cloth not found")
    return {"ok": True}