from typing import List, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.db.session import get_db
from app.models.pricing_rule import PricingRule
from app.api.deps import get_current_user

router = APIRouter()

class PricingRuleBase(BaseModel):
    min_qty: int
    max_qty: int
    fabric_type: str
    unit_price: float

class PricingRuleCreate(PricingRuleBase):
    pass

class PricingRuleOut(PricingRuleBase):
    id: int

    class Config:
        from_attributes = True 

# --- GET: Public Access (No Login Required) ---
@router.get("/", response_model=List[PricingRuleOut])
def read_pricing_rules(
    db: Session = Depends(get_db),
    # ลบ current_user ออกแล้ว เพื่อให้ Frontend ดึงข้อมูลได้
):
    rules = db.query(PricingRule).order_by(PricingRule.fabric_type, PricingRule.min_qty).all()
    return rules

# --- POST: Restricted (Login Required) ---
@router.post("/", response_model=PricingRuleOut)
def create_pricing_rule(
    rule_in: PricingRuleCreate,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user)
):
    rule = PricingRule(**rule_in.dict())
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule

# --- DELETE: Restricted (Login Required) ---
@router.delete("/{id}")
def delete_pricing_rule(
    id: int,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user)
):
    rule = db.query(PricingRule).filter(PricingRule.id == id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Pricing rule not found")
    db.delete(rule)
    db.commit()
    return {"ok": True}