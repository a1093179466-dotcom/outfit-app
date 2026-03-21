from pydantic import BaseModel, Field
from typing import Optional, Literal

RuleType = Literal["prefer", "deny", "allow"]  # ✅ 加 allow 兼容旧数据

class PairRuleCreate(BaseModel):
    other_id: str = Field(min_length=1)
    rule: RuleType
    note: Optional[str] = None

class PairRuleOut(BaseModel):
    id: str
    a_id: str
    b_id: str
    rule: str
    note: Optional[str] = None
    created_at: int