from fastapi import APIRouter, HTTPException, Query
from app.models.pair_rule import PairRuleCreate, PairRuleOut
from app.services import pair_rule_service

router = APIRouter(prefix="/pair-rules", tags=["pair_rules"])

@router.get("", response_model=list[PairRuleOut])
def get_rules(cloth_id: str = Query(..., min_length=1)):
    return pair_rule_service.list_rules(cloth_id)

@router.post("/{cloth_id}", response_model=PairRuleOut)
def upsert_rule(cloth_id: str, payload: PairRuleCreate):
    try:
        return pair_rule_service.set_rule(cloth_id, payload.other_id, payload.rule, payload.note)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/{rule_id}")
def delete_rule(rule_id: str):
    ok = pair_rule_service.delete_rule(rule_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Rule not found")
    return {"ok": True}

@router.get("/all", response_model=list[PairRuleOut])
def get_all_rules(limit: int = Query(100000, ge=1, le=200000)):
    return pair_rule_service.list_all_rules(limit=limit)