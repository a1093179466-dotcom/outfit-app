from pydantic import BaseModel, Field
from typing import List, Optional, Literal

Season = Literal["spring", "summer", "autumn", "winter"]

class PresetCreate(BaseModel):
    season: Season
    items: List[str] = Field(min_length=1)
    note: Optional[str] = None

class PresetOut(BaseModel):
    id: str
    season: Season
    items: List[str]
    note: Optional[str] = None
    created_at: int