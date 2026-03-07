from typing import List, Optional
from app.repositories import pair_rule_repo

def list_rules(cloth_id: str) -> List[dict]:
    return pair_rule_repo.list_rules_for_cloth(cloth_id)

def set_rule(cloth_id: str, other_id: str, rule: str, note: Optional[str]) -> dict:
    if cloth_id == other_id:
        raise ValueError("不能和自己建立搭配规则")
    if rule not in ["allow", "deny"]:
        raise ValueError("rule 必须是 allow 或 deny")
    return pair_rule_repo.upsert_rule(cloth_id, other_id, rule, note)

def delete_rule(rule_id: str) -> bool:
    return pair_rule_repo.delete_rule(rule_id)

def list_all_rules(limit: int = 100000) -> List[dict]:
    return pair_rule_repo.list_all_rules(limit=limit)