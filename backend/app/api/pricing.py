from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Union
from decimal import Decimal
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.product import NeckType

router = APIRouter()


class PricingRequestItem(BaseModel):
    product_type: str = "shirt"
    neck_type: str
    quantity_matrix: Union[Dict[str, int], str, None] = {}
    selected_add_ons: List[str] = []
    is_oversize: bool = False


class PricingRequest(BaseModel):
    items: List[PricingRequestItem]


def calculate_shipping(total_qty: int) -> int:
    if total_qty < 10:
        return 0
    if total_qty <= 15:
        return 60
    if total_qty <= 20:
        return 80
    if total_qty <= 30:
        return 100
    if total_qty <= 40:
        return 120
    if total_qty <= 50:
        return 180
    if total_qty <= 70:
        return 200
    if total_qty <= 100:
        return 230
    return 230 + ((total_qty - 100) * 50)


def _normalize_name(s: str) -> str:
    if not s:
        return ""
    ns = str(s)
    ns = ns.replace("นํ้า", "น้ำ")
    # remove parenthetical annotations
    import re

    ns = re.sub(r"\(.*?\)", "", ns)
    ns = re.sub(r"\s+", " ", ns).strip()
    return ns


@router.post("/calc")
def calculate_price(payload: PricingRequest, db: Session = Depends(get_db)):
    if not payload or not payload.items:
        raise HTTPException(status_code=400, detail="No items provided")

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
        ],
    }

    ADDON_PRICES = {
        "longSleeve": 40,
        "pocket": 20,
        "numberName": 20,
        "slopeShoulder": 40,
        "collarTongue": 10,
        "shortSleeveAlt": 20,
        "oversizeSlopeShoulder": 60,
    }

    # Special necks that should show price as base(300) + slope add-on (40) in UI
    SPECIAL_NECKS_FORCE_340_UI = ["คอปกคางหมู", "คอหยดน้ำ", "คอห้าเหลี่ยมคางหมู"]

    total_qty_all = 0
    grand_total = Decimal(0)
    addon_total_acc = Decimal(0)
    details = []
    first_unit_price = Decimal(0)

    # preload neck rows for tolerant matching
    neck_rows = db.query(NeckType).all()

    for idx, it in enumerate(payload.items):
        # quantity matrix handling
        qmat = {}
        if isinstance(it.quantity_matrix, dict):
            qmat = it.quantity_matrix
        # sum quantities
        qty = sum(int(v) for v in qmat.values() if v)
        if qty <= 0:
            continue

        total_qty_all += qty

        neck_name_raw = (it.neck_type or "").strip()
        norm_need = _normalize_name(neck_name_raw)

        # find db neck with tolerant match
        db_neck = None
        # Build normalized candidates to allow smarter matching: prefer exact normalized match,
        # otherwise prefer the most specific (longest) candidate that is a substring match.
        norm_candidates = []
        for cand in neck_rows:
            if not cand or not cand.name:
                continue
            cand_norm = _normalize_name(cand.name)
            if not cand_norm:
                continue
            norm_candidates.append((cand, cand_norm))

        # 1) exact normalized match
        for cand, cand_norm in norm_candidates:
            if cand_norm == norm_need:
                db_neck = cand
                break

        # 2) prefer longest candidate name that is contained in the requested name
        if not db_neck:
            # candidates whose normalized form is contained in norm_need
            matches = [
                (cand, cand_norm)
                for cand, cand_norm in norm_candidates
                if cand_norm in norm_need
            ]
            if matches:
                # pick candidate with longest normalized string (most specific)
                db_neck = max(matches, key=lambda x: len(x[1]))[0]

        # 3) fallback: candidates where norm_need is contained in candidate name
        if not db_neck:
            matches = [
                (cand, cand_norm)
                for cand, cand_norm in norm_candidates
                if norm_need in cand_norm
            ]
            if matches:
                db_neck = max(matches, key=lambda x: len(x[1]))[0]

        # determine pricing table
        is_round_v = "ปก" not in neck_name_raw and any(
            k in neck_name_raw for k in ["คอกลม", "คอวี", "คอวีตัด", "คอวีชน", "คอวีไขว้"]
        )
        table = (
            STEP_PRICING["roundVNeck"] if is_round_v else STEP_PRICING["collarOthers"]
        )

        # base unit
        unit = Decimal(table[0]["price"]) if table else Decimal(0)
        if qty >= 10:
            matched = next(
                (t for t in table if qty >= t["min"] and qty <= t["max"]), None
            )
            unit = Decimal(matched["price"]) if matched else Decimal(table[-1]["price"])

        if idx == 0:
            first_unit_price = unit

        # determine whether this neck is one of the special shapes
        is_special_340 = any(s in neck_name_raw for s in SPECIAL_NECKS_FORCE_340_UI)

        # compute addons (do not add collarTongue for special forced-slope necks)
        addons = set(it.selected_add_ons or [])
        if "มีลิ้น" in neck_name_raw and not is_special_340:
            addons.add("collarTongue")
        if it.is_oversize:
            if "slopeShoulder" in addons:
                addons.discard("slopeShoulder")
            addons.add("oversizeSlopeShoulder")

        # slope cost comes from db_neck.additional_cost if present, otherwise default 40
        slope_cost = Decimal(40)
        if db_neck and getattr(db_neck, "additional_cost", None) is not None:
            try:
                slope_cost = Decimal(db_neck.additional_cost)
            except Exception:
                slope_cost = Decimal(40)

        # Do NOT embed slope into base unit for special necks — treat slope as an add-on
        # keep first_unit_price as the base unit (before addons)

        addon_unit = Decimal(0)
        # Ensure forced slope is present as addon when neck requires it (by name or DB flag)
        if "(บังคับไหล่สโลป" in neck_name_raw or (
            db_neck and getattr(db_neck, "force_slope", False)
        ):
            addons.add("slopeShoulder")

        for a in addons:
            price = Decimal(ADDON_PRICES.get(a, 0))
            if a == "slopeShoulder":
                price = slope_cost
            addon_unit += price

        addon_total = addon_unit * qty
        addon_total_acc += addon_total

        line_total = (unit * qty) + addon_total
        grand_total += line_total

        details.append(
            {
                "neck": neck_name_raw,
                "qty": qty,
                "unit_price": float(unit),
                "addon_unit_price": float(addon_unit),
                "addons": list(addons),
                "line_total": float(line_total),
            }
        )

    shipping = calculate_shipping(total_qty_all)

    return {
        "price_per_unit": float(first_unit_price),
        "item_addon_total": float(addon_total_acc),
        "shipping_cost": float(shipping),
        "total_qty": total_qty_all,
        "total_price": float(grand_total),
        "details": details,
    }
