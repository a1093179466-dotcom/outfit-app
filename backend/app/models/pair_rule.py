from pydantic import BaseModel, Field
from typing import Optional, Literal

RuleType = Literal["allow", "deny"]

class PairRuleCreate(BaseModel):
    other_id: str = Field(min_length=1)     # 另一个衣服 id
    rule: RuleType
    note: Optional[str] = None

class PairRuleOut(BaseModel):
    id: str
    a_id: str
    b_id: str
    rule: RuleType
    note: Optional[str] = None
    created_at: int