from pydantic import BaseModel, Field
from typing import List, Optional, Literal

Season = Literal["spring", "summer", "autumn", "winter"]
Kind = Literal["jk_set", "daily_set", "outer", "inner", "bottom", "socks", "shoes"]

# 兼容旧字段（你数据库里仍有 type）
ClothType = Literal["jk_set", "daily_set", "skirt", "pants", "top", "socks", "shoes"]

class ClothCreate(BaseModel):
    name: str = Field(min_length=1)
    seasons: List[Season] = Field(min_length=1, max_length=4)

    # 新字段：最终类别
    kind: Kind

    # 兼容：如果前端还传 type，我们忽略或用于推断（可选）
    type: Optional[ClothType] = None

class ClothUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1)
    seasons: Optional[List[Season]] = Field(default=None, min_length=1, max_length=4)
    kind: Optional[Kind] = None
    type: Optional[ClothType] = None

class ClothOut(BaseModel):
    id: str
    name: str
    seasons: List[Season]
    kind: Kind

    # 保留：方便你排查旧数据来源（可不返回也行）
    type: Optional[str] = None

    image_url: Optional[str] = None
    created_at: int