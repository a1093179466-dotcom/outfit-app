from pydantic import BaseModel, Field
from typing import List, Optional, Literal

ClothType = Literal["jk_set", "daily_set", "skirt", "top", "socks", "shoes"]
Season = Literal["spring", "summer", "autumn", "winter"]

class ClothCreate(BaseModel):
    name: str = Field(min_length=1)
    type: ClothType
    seasons: List[Season] = Field(min_length=1, max_length=2)
    versatile: bool = False

class ClothUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1)
    type: Optional[ClothType] = None
    seasons: Optional[List[Season]] = Field(default=None, min_length=1, max_length=2)
    versatile: Optional[bool] = None

class ClothOut(BaseModel):
    id: str
    name: str
    type: ClothType
    seasons: List[Season]
    versatile: bool
    image_url: Optional[str] = None
    created_at: int