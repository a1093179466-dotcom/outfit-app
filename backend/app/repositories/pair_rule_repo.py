import time
import uuid
from typing import List, Optional
from app.db.database import get_conn

def _normalize_pair(id1: str, id2: str) -> tuple[str, str]:
    return (id1, id2) if id1 < id2 else (id2, id1)

def list_rules_for_cloth(cloth_id: str) -> List[dict]:
    conn = get_conn()
    try:
        rows = conn.execute(
            """
            SELECT * FROM pair_rules
            WHERE a_id = ? OR b_id = ?
            ORDER BY created_at DESC
            """,
            (cloth_id, cloth_id),
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()

def upsert_rule(cloth_id: str, other_id: str, rule: str, note: Optional[str]) -> dict:
    a_id, b_id = _normalize_pair(cloth_id, other_id)
    rid = str(uuid.uuid4())
    created_at = int(time.time())

    conn = get_conn()
    try:
        # 如果已存在同一对 (a_id,b_id)，则更新 rule/note；否则插入
        conn.execute(
            """
            INSERT INTO pair_rules (id, a_id, b_id, rule, note, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(a_id, b_id) DO UPDATE SET
              rule=excluded.rule,
              note=excluded.note
            """,
            (rid, a_id, b_id, rule, note, created_at),
        )
        conn.commit()
    finally:
        conn.close()

    # 取回最新记录（按唯一键）
    conn = get_conn()
    try:
        row = conn.execute(
            "SELECT * FROM pair_rules WHERE a_id=? AND b_id=?",
            (a_id, b_id),
        ).fetchone()
        return dict(row)  # type: ignore
    finally:
        conn.close()

def delete_rule(rule_id: str) -> bool:
    conn = get_conn()
    try:
        cur = conn.execute("DELETE FROM pair_rules WHERE id=?", (rule_id,))
        conn.commit()
        return cur.rowcount > 0
    finally:
        conn.close()