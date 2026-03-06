from pydantic import BaseModel, Field
from typing import List, Optional, Literal

ClothType = Literal["jk_set", "daily_set", "skirt", "top", "socks", "shoes"]
Season = Literal["spring", "summer", "autumn", "winter"]

Category = Literal["outer", "top", "skirt", "dress", "shoes", "socks"]
Layer = Literal["inner", "outer", "none"]

# Step1 features：先给常用几个，后续你可继续加
Feature = Literal[
    "strappy",        # 吊带
    "cardigan",       # 开衫
    "sun_protection", # 防晒衣
    "thick_outerwear",# 厚外套
    "tshirt",         # T恤
]

class ClothCreate(BaseModel):
    name: str = Field(min_length=1)
    type: ClothType
    seasons: List[Season] = Field(min_length=1, max_length=2)
    versatile: bool = False

    # Step 1 新字段（可选：没传就后端根据 type 推断）
    category: Optional[Category] = None
    layer: Optional[Layer] = None
    features: List[Feature] = Field(default_factory=list)
    versatile_level: Optional[int] = Field(default=None, ge=0, le=2)

class ClothUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1)
    type: Optional[ClothType] = None
    seasons: Optional[List[Season]] = Field(default=None, min_length=1, max_length=2)
    versatile: Optional[bool] = None

    category: Optional[Category] = None
    layer: Optional[Layer] = None
    features: Optional[List[Feature]] = None
    versatile_level: Optional[int] = Field(default=None, ge=0, le=2)

class ClothOut(BaseModel):
    id: str
    name: str
    type: ClothType
    seasons: List[Season]
    versatile: bool

    category: Category
    layer: Layer
    features: List[Feature]
    versatile_level: int

    image_url: Optional[str] = None
    created_at: int