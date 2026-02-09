from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.product import NeckType, FabricType, SleeveType
from app.models.company import Company

router = APIRouter()


# --- Backend pricing constants (mirror frontend STEP_PRICING) ---
STEP_PRICING = {
    "roundVNeck": [
        {"minQty": 10, "maxQty": 30, "price": 240},
        {"minQty": 31, "maxQty": 50, "price": 220},
        {"minQty": 51, "maxQty": 100, "price": 190},
        {"minQty": 101, "maxQty": 300, "price": 180},
        {"minQty": 301, "maxQty": 99999, "price": 170},
    ],
    "collarOthers": [
        {"minQty": 10, "maxQty": 30, "price": 300},
        {"minQty": 31, "maxQty": 50, "price": 260},
        {"minQty": 51, "maxQty": 100, "price": 240},
        {"minQty": 101, "maxQty": 300, "price": 220},
        {"minQty": 301, "maxQty": 99999, "price": 200},
    ],
    "sportsPants": 210,
    "fashionPants": 280,
}


DEFAULT_ADDONS = [
    {"id": "longSleeve", "name": "แขนยาว", "price": 40},
    {"id": "pocket", "name": "กระเป๋า", "price": 20},
    {"id": "numberName", "name": "รันเบอร์/ชื่อ", "price": 20},
    {"id": "slopeShoulder", "name": "ไหล่สโลป", "price": 40},
    {"id": "collarTongue", "name": "คอมีลิ้น", "price": 10},
    {"id": "shortSleeveAlt", "name": "แขนจิ้ม", "price": 20},
    {"id": "oversizeSlopeShoulder", "name": "ทรงโอเวอร์ไซส์ไหล่สโลป", "price": 60},
]


class PriceRequest(BaseModel):
    total_qty: int
    product_type: str = "shirt"  # 'shirt', 'sportsPants', 'fashionPants'
    quantity_matrix: Optional[dict] = None
    product_is_oversize: Optional[bool] = False
    fabric_name: Optional[str] = None
    neck_name: Optional[str] = None
    sleeve_name: Optional[str] = None
    addon_ids: Optional[List[str]] = []
    is_vat_included: Optional[bool] = True


class PriceResponse(BaseModel):
    price_per_unit: float
    subtotal: float
    item_addon_total: float
    sizing_surcharge: float
    vat_amount: float
    shipping_cost: float
    grand_total: float
    breakdown: dict


def _find_addon_price(addon_id: str, addons_list: List[dict]) -> float:
    for a in addons_list:
        if a.get("id") == addon_id or a.get("name") == addon_id:
            return float(a.get("price", 0))
    return 0.0


@router.post("/calc", response_model=PriceResponse)
def calculate_price(payload: PriceRequest, db: Session = Depends(get_db)) -> Any:
    qty = int(payload.total_qty or 0)
    if qty <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be > 0")

    # VAT config
    company = db.query(Company).first()
    vat_rate = float(company.vat_rate) if company else 0.07

    # Base price selection
    if payload.product_type == "sportsPants":
        base_unit = float(STEP_PRICING["sportsPants"])
    elif payload.product_type == "fashionPants":
        base_unit = float(STEP_PRICING["fashionPants"])
    else:
        # Determine if neck is round/v or collar
        neck_name = payload.neck_name or ""
        hasCollarWord = "ปก" in neck_name
        isRoundV = not hasCollarWord and any(
            k in neck_name for k in ["คอกลม", "คอวี", "คอวีตัด", "คอวีชน", "คอวีไขว้"]
        )
        pricingTable = (
            STEP_PRICING["roundVNeck"] if isRoundV else STEP_PRICING["collarOthers"]
        )

        if qty >= 10:
            matched = next(
                (t for t in pricingTable if qty >= t["minQty"] and qty <= t["maxQty"]),
                None,
            )
            base_unit = (
                float(matched["price"]) if matched else float(pricingTable[0]["price"])
            )
        else:
            base_unit = float(pricingTable[0]["price"])

    # Neck extra price from DB (if available)
    neck_extra = 0.0
    force_slope = False
    if payload.neck_name:
        n = db.query(NeckType).filter(NeckType.name == payload.neck_name).first()
        if n:
            neck_extra = (
                float(n.price_adjustment or 0)
                or float(n.additional_cost or 0)
                or float(n.cost_price or 0)
            )
            force_slope = bool(n.force_slope)

    # Special UI necks handling: keep same semantics as frontend
    special_necks = ["คอปกคางหมู", "คอหยดน้ำ", "คอห้าเหลี่ยมคางหมู"]
    is_special_340 = any(s in (payload.neck_name or "") for s in special_necks)
    if is_special_340:
        # base display 300 + slope add-on
        slope_price = _find_addon_price("slopeShoulder", DEFAULT_ADDONS)
        base_unit = 300 + slope_price

    # Add-on totals
    addons_list = DEFAULT_ADDONS
    item_addon_total = 0.0
    for aid in payload.addon_ids or []:
        price = _find_addon_price(aid, addons_list)
        # if slope is forced and not special UI, skip counting slope add-on
        if (
            force_slope
            and aid in ["slopeShoulder", "collarTongue"]
            and not is_special_340
        ):
            continue
        item_addon_total += price * qty

    # sizing surcharge
    sizing_surcharge = 0.0
    qmat = payload.quantity_matrix or {}
    oversize_qty = 0
    if payload.product_is_oversize:
        for sname, n in qmat.items():
            try:
                if (
                    sname.startswith("2XL")
                    or sname.startswith("3XL")
                    or sname.startswith("4XL")
                    or sname.startswith("5XL")
                ):
                    oversize_qty += int(n)
            except Exception:
                continue
    else:
        for sname, n in qmat.items():
            try:
                if sname.startswith("4XL") or sname.startswith("5XL"):
                    oversize_qty += int(n)
            except Exception:
                continue
    sizing_surcharge = oversize_qty * 100.0

    subtotal = base_unit * qty

    grand = subtotal + sizing_surcharge + item_addon_total

    vat_amount = 0.0
    if not payload.is_vat_included:
        vat_amount = grand * vat_rate
        grand += vat_amount
    else:
        vat_amount = grand * (vat_rate / (1 + vat_rate))

    # Shipping estimation: simple heuristic (mirror frontend)
    if qty < 10:
        shipping_cost = 0.0
    elif qty <= 15:
        shipping_cost = 60.0
    elif qty <= 20:
        shipping_cost = 80.0
    elif qty <= 30:
        shipping_cost = 100.0
    elif qty <= 40:
        shipping_cost = 120.0
    elif qty <= 50:
        shipping_cost = 180.0
    elif qty <= 70:
        shipping_cost = 200.0
    elif qty <= 100:
        shipping_cost = 230.0
    else:
        extra = qty - 100
        shipping_cost = 230.0 + (extra * 50.0)

    grand_total = grand + shipping_cost

    return {
        "price_per_unit": round(float(base_unit), 2),
        "subtotal": round(float(subtotal), 2),
        "item_addon_total": round(float(item_addon_total), 2),
        "sizing_surcharge": round(float(sizing_surcharge), 2),
        "vat_amount": round(float(vat_amount), 2),
        "shipping_cost": round(float(shipping_cost), 2),
        "grand_total": round(float(grand_total), 2),
        "breakdown": {
            "base_unit": round(float(base_unit), 2),
            "neck_extra": round(float(neck_extra), 2),
            "force_slope": force_slope,
            "is_special_340": is_special_340,
        },
    }
