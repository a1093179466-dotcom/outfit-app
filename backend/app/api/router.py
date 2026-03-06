from fastapi import APIRouter
from app.api.routes.clothes import router as clothes_router

api_router = APIRouter()
api_router.include_router(clothes_router)