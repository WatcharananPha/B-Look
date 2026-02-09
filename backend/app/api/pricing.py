from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Dict, Optional
from decimal import Decimal
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.product import NeckType

router = APIRouter()

class PricingRequestItem(BaseModel):
    product_type: str = "shirt"
    neck_type: str
    quantity_matrix: Dict[str, int]
    selected_add_ons: List[str] = []
    is_oversize: bool = False

class PricingRequest(BaseModel):
    items: List[PricingRequestItem]

@router.post("/calc")
def calculate_price(payload: PricingRequest, db: Session = Depends(get_db)):
    """
    Real-time price calculation endpoint
    Used by frontend to preview price before saving order
    """
    total_price = Decimal(0)
    
    # Pricing Constants (Same as orders.py)
    STEP_PRICING = {
        "roundVNeck": [
            {"min": 10, "max": 30, "price": 240},
            {"min": 31, "max": 50, "price": 220},
            {"min": 51, "max": 100, "price": 190},
            {"min": 101, "max": 300, "price": 180},
            {"min": 301, "max": 99999, "price": 170},
        ],
        "collarOthers": [
            {"min": 10, "max": 30, "price": 300},
            {"min": 31, "max": 50, "price": 260},
            {"min": 51, "max": 100, "price": 240},
            {"min": 101, "max": 300, "price": 220},
            {"min": 301, "max": 99999, "price": 200},
        ]
    }
    
    ADDON_PRICES = {
        "longSleeve": 40,
        "pocket": 20,
        "numberName": 20,
        "slopeShoulder": 40,
        "collarTongue": 10,
        "shortSleeveAlt": 20,
        "oversizeSlopeShoulder": 60
    }

    results = []

    for item in payload.items:
        qty = sum(item.quantity_matrix.values())
        if qty == 0:
            continue

        # 1. Determine Unit Price
        neck_str = (item.neck_type or "").strip()
        is_round_v = "ปก" not in neck_str and any(k in neck_str for k in ["คอกลม", "คอวี"])
        
        # Default price
        unit_price = Decimal(240) if is_round_v else Decimal(300)
        
        # Step Pricing
        table = STEP_PRICING["roundVNeck"] if is_round_v else STEP_PRICING["collarOthers"]
        if qty >= 10:
            for step in table:
                if step["min"] <= qty <= step["max"]:
                    unit_price = Decimal(step["price"])
                    break

        # 2. Add-ons Calculation
        # Force logic similar to orders.py
        current_addons = set(item.selected_add_ons)
        
        # Check DB for slope price
        db_neck = db.query(NeckType).filter(NeckType.name == neck_str).first()
        slope_cost = Decimal(db_neck.additional_cost) if db_neck and db_neck.additional_cost else Decimal(40)

        if "(บังคับไหล่สโลป" in neck_str or "คอปกคางหมู" in neck_str:
            current_addons.add("slopeShoulder")
        
        if "มีลิ้น" in neck_str:
            current_addons.add("collarTongue")
            
        if item.is_oversize:
            current_addons.add("oversizeSlopeShoulder")

        addon_total = Decimal(0)
        for addon in current_addons:
            price = Decimal(ADDON_PRICES.get(addon, 0))
            if addon == "slopeShoulder":
                price = slope_cost
            addon_total += price

        line_total = (unit_price + addon_total) * qty
        total_price += line_total
        
        results.append({
            "neck": neck_str,
            "qty": qty,
            "unit_price": unit_price,
            "addons": list(current_addons),
            "line_total": line_total
        })

    return {"total_price": total_price, "details": results}
