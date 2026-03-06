from pydantic import BaseModel, Field
from typing import List, Optional

class OutfitCreate(BaseModel):
    date: str = Field(min_length=10, max_length=10)  # "YYYY-MM-DD"
    items: List[str] = Field(min_length=1)           # cloth ids
    note: Optional[str] = None
    rating: Optional[int] = Field(default=None, ge=1, le=5)

class OutfitOut(BaseModel):
    id: str
    date: str
    items: List[str]
    note: Optional[str] = None
    rating: Optional[int] = None
    created_at: int