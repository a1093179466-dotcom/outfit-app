from fastapi import APIRouter
from app.api.routes.clothes import router as clothes_router
from app.api.routes.outfits import router as outfits_router
from app.api.routes.pair_rules import router as pair_rules_router
from app.api.routes.presets import router as presets_router

api_router = APIRouter()
api_router.include_router(clothes_router)
api_router.include_router(outfits_router)
api_router.include_router(pair_rules_router)
api_router.include_router(presets_router)