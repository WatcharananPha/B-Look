from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, selectinload
from typing import List, Optional, Literal
from pydantic import BaseModel
from decimal import Decimal
import uuid
import json
import logging

from app.db.session import get_db
from app.models.order import Order as OrderModel, OrderItem as OrderItemModel
from app.models.customer import Customer
from app.models.user import User
from app.models.product import NeckType  # Import เพื่อดึงราคาล่าสุด
from app.models.audit_log import AuditLog
from app.api import deps
from app.schemas.order import OrderCreate, Order as OrderSchema

# ราคาฐาน (Base Price)
STEP_PRICING = {
    "roundVNeck": [
        {"minQty": 10, "maxQty": 30, "price": Decimal(240)},
        {"minQty": 31, "maxQty": 50, "price": Decimal(220)},
        {"minQty": 51, "maxQty": 100, "price": Decimal(190)},
        {"minQty": 101, "maxQty": 300, "price": Decimal(180)},
        {"minQty": 301, "maxQty": 99999, "price": Decimal(170)},
    ],
    "collarOthers": [
        {"minQty": 10, "maxQty": 30, "price": Decimal(300)},  # ราคาฐาน 300
        {"minQty": 31, "maxQty": 50, "price": Decimal(260)},
        {"minQty": 51, "maxQty": 100, "price": Decimal(240)},
        {"minQty": 101, "maxQty": 300, "price": Decimal(220)},
        {"minQty": 301, "maxQty": 99999, "price": Decimal(200)},
    ],
    "sportsPants": Decimal(210),
    "fashionPants": Decimal(280),
}

# ราคา Add-on พื้นฐาน
DEFAULT_ADDON_PRICES = {
    "longSleeve": Decimal(40),
    "pocket": Decimal(20),
    "numberName": Decimal(20),
    "slopeShoulder": Decimal(40),
    "collarTongue": Decimal(10),
    "shortSleeveAlt": Decimal(20),
    "oversizeSlopeShoulder": Decimal(60),
}

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("", response_model=List[OrderSchema])
@router.get("/", response_model=List[OrderSchema])
def read_orders(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    # ✅ FIX: selectinload แก้ปัญหา Order ซ้ำ
    orders = (
        db.query(OrderModel)
        .options(selectinload(OrderModel.customer), selectinload(OrderModel.items))
        .order_by(OrderModel.id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    results = []
    for o in orders:
        o_dict = o.__dict__.copy()
        # Normalize decimal-like fields to Decimal to satisfy Pydantic serializers
        DECIMAL_FIELDS = [
            "advance_hold",
            "shipping_cost",
            "add_on_cost",
            "sizing_surcharge",
            "add_on_options_total",
            "design_fee",
            "discount_value",
            "discount_amount",
            "deposit_amount",
            "deposit_1",
            "deposit_2",
            "vat_amount",
            "grand_total",
            "balance_amount",
            "total_cost",
            "estimated_profit",
        ]
        for k in DECIMAL_FIELDS:
            if k in o_dict:
                v = o_dict.get(k)
                if v is None:
                    continue
                if not isinstance(v, Decimal):
                    try:
                        o_dict[k] = Decimal(str(v))
                    except Exception:
                        # leave as-is on failure
                        pass
        if o.customer:
            o_dict.update(
                {
                    "customer_name": o.customer.name,
                    "phone": o.customer.phone,
                    "contact_channel": o.customer.channel,
                    "address": o.customer.address,
                }
            )
        if o.items:
            items_list = []
            for i in o.items:
                i_dict = i.__dict__.copy()
                for k in ["quantity_matrix", "selected_add_ons"]:
                    val = i_dict.get(k)
                    if isinstance(val, str):
                        try:
                            i_dict[k] = json.loads(val)
                        except:
                            i_dict[k] = {} if k == "quantity_matrix" else []
                    elif val is None:
                        i_dict[k] = {} if k == "quantity_matrix" else []
                i_dict["is_oversize"] = bool(i_dict.get("is_oversize", False))
                # Normalize numeric fields in item to Decimal where appropriate
                ITEM_DECIMAL_FIELDS = [
                    "base_price",
                    "price_per_unit",
                    "cost_per_unit",
                    "total_price",
                    "total_cost",
                    "total_qty",
                    "item_addon_total",
                ]
                for fk in ITEM_DECIMAL_FIELDS:
                    if fk in i_dict:
                        vv = i_dict.get(fk)
                        if vv is None:
                            continue
                        if not isinstance(vv, Decimal):
                            try:
                                i_dict[fk] = Decimal(str(vv))
                            except Exception:
                                pass
                items_list.append(i_dict)
            o_dict["items"] = items_list
        results.append(o_dict)
    return results


def calculate_item_price(item, order_prod_type, db: Session):
    qty = sum(item.quantity_matrix.values()) if item.quantity_matrix else 0
    p_type = getattr(item, "product_type", None) or order_prod_type or "shirt"

    # 1. Base Price
    if p_type == "sportsPants":
        unit_price = STEP_PRICING["sportsPants"]
    elif p_type == "fashionPants":
        unit_price = STEP_PRICING["fashionPants"]
    else:
        neck_str = (item.neck_type or "").strip()
        is_round_v = "ปก" not in neck_str and any(
            k in neck_str for k in ["คอกลม", "คอวี"]
        )
        table = (
            STEP_PRICING["roundVNeck"] if is_round_v else STEP_PRICING["collarOthers"]
        )
        if qty >= 10:
            found = next(
                (t for t in table if qty >= t["minQty"] and qty <= t["maxQty"]), None
            )
            unit_price = found["price"] if found else table[0]["price"]
        else:
            unit_price = Decimal(240) if is_round_v else Decimal(300)

    # 2. Addon Price (DB Sync)
    neck_str = (item.neck_type or "").strip()
    selected = getattr(item, "selected_add_ons", []) or []

    # ดึงราคาจาก DB
    db_neck = db.query(NeckType).filter(NeckType.name == neck_str).first()
    slope_price_db = (
        Decimal(db_neck.additional_cost)
        if db_neck and db_neck.additional_cost is not None
        else Decimal(40)
    )

    # Force Options
    # If this neck is one of the special shapes we want to include slope cost in base unit
    SPECIAL_NECKS_FORCE_340_UI = ["คอปกคางหมู", "คอหยดน้ำ", "คอห้าเหลี่ยมคางหมู"]
    is_special_340 = any(k in neck_str for k in SPECIAL_NECKS_FORCE_340_UI)

    # Treat slope as an add-on: add slopeShoulder when neck requires it (by name or DB flag)
    if "(บังคับไหล่สโลป" in neck_str or (
        db_neck and getattr(db_neck, "force_slope", False)
    ):
        if "slopeShoulder" not in selected:
            selected = list(selected) + ["slopeShoulder"]

    # Do not auto-add collarTongue for the special forced-slope necks (tongue is shown but not charged)
    if "มีลิ้น" in neck_str and not is_special_340 and "collarTongue" not in selected:
        selected = list(selected) + ["collarTongue"]

    if getattr(item, "is_oversize", False) and "oversizeSlopeShoulder" not in selected:
        selected = list(selected) + ["oversizeSlopeShoulder"]

    # Calculate Addon Total
    addon_sum = Decimal(0)
    for code in selected:
        cost = DEFAULT_ADDON_PRICES.get(code, Decimal(0))
        if code == "slopeShoulder":
            cost = slope_price_db
        addon_sum += cost

    total_addon_line = addon_sum * qty
    line_total = (unit_price * qty) + total_addon_line
    line_cost = Decimal(str(item.cost_per_unit or 0)) * qty

    return {
        "unit_price": unit_price,
        "line_total": line_total,
        "line_cost": line_cost,
        "selected": selected,
        "addon_total": total_addon_line,
    }


@router.post("", status_code=status.HTTP_201_CREATED)
@router.post("/", status_code=status.HTTP_201_CREATED)
def create_order(
    order_in: OrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    clean_name = order_in.customer_name.strip() if order_in.customer_name else "Unknown"
    customer = db.query(Customer).filter(Customer.name == clean_name).first()
    if not customer:
        customer = Customer(
            name=clean_name,
            phone=order_in.phone,
            channel=order_in.contact_channel,
            address=order_in.address,
            customer_code=order_in.customer_code,
        )
        db.add(customer)
        db.flush()
    else:
        customer.phone = order_in.phone
        customer.address = order_in.address
        db.add(customer)
        db.flush()

    items_total_price = Decimal(0)
    items_total_cost = Decimal(0)
    order_items_data = []

    for item in order_in.items:
        qty = sum(item.quantity_matrix.values()) if item.quantity_matrix else 0
        calc = calculate_item_price(item, order_in.product_type, db)

        items_total_price += calc["line_total"]
        items_total_cost += calc["line_cost"]
        item.selected_add_ons = calc["selected"]

        order_items_data.append(
            {
                "data": item,
                "qty": qty,
                "base": calc["unit_price"],
                "total": calc["line_total"],
                "cost": calc["line_cost"],
                "addon_total": calc["addon_total"],
            }
        )

    shipping = Decimal(str(order_in.shipping_cost or 0))
    manual_addon = Decimal(str(order_in.add_on_cost or 0))
    discount = Decimal(str(order_in.discount_amount or 0))
    design_fee = Decimal(str(order_in.design_fee or 0))
    item_addons_grand = sum(x["addon_total"] for x in order_items_data)

    # Guard: if manual addon equals computed addons, treat manual as 0 to avoid double-charging
    try:
        if manual_addon == Decimal(item_addons_grand):
            manual_addon = Decimal(0)
    except Exception:
        pass

    final_pre_vat = items_total_price + manual_addon + shipping - discount
    # VAT handling: support both VAT-included and VAT-excluded consistently
    if order_in.is_vat_included:
        # final_pre_vat already includes VAT. Extract the VAT portion.
        vat = (final_pre_vat * Decimal("7")) / Decimal("107")
        vat = vat.quantize(Decimal("0.01"))
        grand_total = final_pre_vat.quantize(Decimal("0.01"))
    else:
        vat = (final_pre_vat * Decimal("0.07")).quantize(Decimal("0.01"))
        grand_total = (final_pre_vat + vat).quantize(Decimal("0.01"))

    # Determine a unique order_no. If client supplied one and it's taken,
    # auto-suffix with -1, -2, ... instead of returning a 500/400.
    final_order_no = None
    if order_in.order_no:
        base_no = order_in.order_no.strip()
        if not base_no:
            base_no = f"PO-{uuid.uuid4().hex[:6].upper()}"
        candidate = base_no
        suffix = 1
        # Try simple suffixing up to a reasonable limit to avoid infinite loops.
        while db.query(OrderModel).filter(OrderModel.order_no == candidate).first():
            candidate = f"{base_no}-{suffix}"
            suffix += 1
            if suffix > 1000:
                # Fallback to generated PO id if something strange happens
                candidate = f"PO-{uuid.uuid4().hex[:8].upper()}"
                break
        final_order_no = candidate
    else:
        final_order_no = f"PO-{uuid.uuid4().hex[:6].upper()}"

    new_order = OrderModel(
        order_no=final_order_no,
        # Public UUID used for customer payment link
        order_uuid=uuid.uuid4().hex,
        customer_id=customer.id,
        customer_name=clean_name,
        contact_channel=customer.channel,
        address=order_in.address,
        phone=order_in.phone,
        status=order_in.status or "WAITING_BOOKING",
        grand_total=grand_total,
        total_cost=items_total_cost,
        vat_amount=vat,
        shipping_cost=shipping,
        add_on_cost=manual_addon,
        add_on_options_total=item_addons_grand,
        design_fee=design_fee,
        discount_amount=discount,
        is_vat_included=order_in.is_vat_included,
        deadline=order_in.deadline,
        usage_date=order_in.usage_date,
        deposit_amount=order_in.deposit_amount,
        deposit_1=order_in.deposit_1,
        deposit_2=order_in.deposit_2,
        balance_amount=grand_total
        - (order_in.deposit_1 or 0)
        - (order_in.deposit_2 or 0),
        note=order_in.note,
        created_by_id=current_user.id if current_user else None,
    )
    db.add(new_order)
    db.flush()

    for d in order_items_data:
        src = d["data"]
        ni = OrderItemModel(
            order_id=new_order.id,
            product_name=src.product_name,
            fabric_type=src.fabric_type,
            neck_type=src.neck_type,
            sleeve_type=src.sleeve_type,
            quantity_matrix=json.dumps(src.quantity_matrix),
            total_qty=d["qty"],
            price_per_unit=d["base"],
            total_price=d["total"],
            total_cost=d["cost"],
            selected_add_ons=json.dumps(src.selected_add_ons),
            item_addon_total=d["addon_total"],
        )
        db.add(ni)

    db.commit()
    db.refresh(new_order)
    # Return serialized representation to match update_order/read_order output
    return read_order(new_order.id, db)


@router.put("/{order_id}", response_model=OrderSchema)
def update_order(
    order_id: int,
    order_in: OrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    existing = db.query(OrderModel).filter(OrderModel.id == order_id).first()
    if not existing:
        raise HTTPException(status_code=404)

    # Ensure public uuid exists (useful if older orders were created before this field)
    if not getattr(existing, "order_uuid", None):
        existing.order_uuid = uuid.uuid4().hex
        db.add(existing)
        db.commit()
        db.refresh(existing)

    # Sync / find customer (same logic as create_order)
    clean_name = order_in.customer_name.strip() if order_in.customer_name else "Unknown"
    customer = db.query(Customer).filter(Customer.name == clean_name).first()
    if not customer:
        customer = Customer(
            name=clean_name,
            phone=order_in.phone,
            channel=order_in.contact_channel,
            address=order_in.address,
            customer_code=order_in.customer_code,
        )
        db.add(customer)
        db.flush()
    else:
        # update contact fields from payload
        customer.phone = order_in.phone
        customer.channel = order_in.contact_channel
        customer.address = order_in.address
        db.add(customer)

    # Decide whether items actually changed. If incoming items are identical to
    # existing saved items (by product attributes + quantities + add-ons),
    # preserve stored per-item pricing and totals to avoid accidental
    # recalculation when editing non-pricing metadata (status, note, etc.).
    def _normalize_item_for_compare(src_item):
        # Build a canonical tuple representing the item identity (not pricing)
        qm = (
            src_item.quantity_matrix
            if getattr(src_item, "quantity_matrix", None)
            else {}
        )
        # selected_add_ons may be list or None
        sa = src_item.selected_add_ons or []
        return (
            (src_item.product_name or "").strip(),
            (src_item.fabric_type or "").strip(),
            (src_item.neck_type or "").strip(),
            (src_item.sleeve_type or "").strip(),
            json.dumps(qm, sort_keys=True),
            json.dumps(sa, sort_keys=True),
            bool(getattr(src_item, "is_oversize", False)),
        )

    existing_items = []
    for ei in existing.items:
        try:
            qm = json.loads(ei.quantity_matrix) if ei.quantity_matrix else {}
        except Exception:
            qm = {}
        try:
            sa = json.loads(ei.selected_add_ons) if ei.selected_add_ons else []
        except Exception:
            sa = []
        existing_items.append(
            {
                "key": (
                    (ei.product_name or "").strip(),
                    (ei.fabric_type or "").strip(),
                    (ei.neck_type or "").strip(),
                    (ei.sleeve_type or "").strip(),
                    json.dumps(qm, sort_keys=True),
                    json.dumps(sa, sort_keys=True),
                    bool(ei.is_oversize),
                ),
                "price_per_unit": Decimal(str(ei.price_per_unit or 0)),
                "total_price": Decimal(str(ei.total_price or 0)),
                "total_cost": Decimal(str(ei.total_cost or 0)),
                "item_addon_total": Decimal(str(ei.item_addon_total or 0)),
                "total_qty": int(ei.total_qty or 0),
            }
        )

    incoming_keys = [_normalize_item_for_compare(it) for it in order_in.items]
    existing_keys = [ei["key"] for ei in existing_items]

    items_total_price = Decimal(0)
    items_total_cost = Decimal(0)
    order_items_data = []

    # If lengths match and all incoming keys match existing keys in order, preserve pricing
    preserve_pricing = False
    if len(incoming_keys) == len(existing_keys) and all(
        k1 == k2 for k1, k2 in zip(incoming_keys, existing_keys)
    ):
        preserve_pricing = True

    if preserve_pricing:
        # Build order_items_data from existing items (preserve stored prices)
        for idx, it in enumerate(order_in.items):
            qty = sum(it.quantity_matrix.values()) if it.quantity_matrix else 0
            ei = existing_items[idx]
            # synchronize selected_add_ons back to payload object
            it.selected_add_ons = json.loads(ei["key"][5]) if ei["key"][5] else []
            order_items_data.append(
                {
                    "data": it,
                    "qty": qty,
                    "base": ei["price_per_unit"],
                    "total": ei["total_price"],
                    "cost": ei["total_cost"],
                    "addon_total": ei["item_addon_total"],
                }
            )
            items_total_price += ei["total_price"]
            items_total_cost += ei["total_cost"]
    else:
        # In-place update strategy:
        # - Match incoming items to existing OrderItem rows by identity (product attrs + qty matrix + add-ons + oversize)
        # - For matched items: update quantity_matrix/total_qty but preserve persisted pricing fields
        # - For unmatched incoming items: create new OrderItem rows (use provided pricing if present, else recalc)
        # - For existing items not present in incoming payload: delete them
        existing_map = {}
        for ei in list(existing.items or []):
            try:
                qm = json.loads(ei.quantity_matrix) if ei.quantity_matrix else {}
            except Exception:
                qm = {}
            try:
                sa = json.loads(ei.selected_add_ons) if ei.selected_add_ons else []
            except Exception:
                sa = []
            key = (
                (ei.product_name or "").strip(),
                (ei.fabric_type or "").strip(),
                (ei.neck_type or "").strip(),
                (ei.sleeve_type or "").strip(),
                json.dumps(qm, sort_keys=True),
                json.dumps(sa, sort_keys=True),
                bool(ei.is_oversize),
            )
            existing_map[key] = ei

        used_keys = set()

        # Process incoming items: update existing rows when possible, else create
        for item in order_in.items:
            qty = sum(item.quantity_matrix.values()) if item.quantity_matrix else 0
            # normalize selected_add_ons for comparison
            sel = item.selected_add_ons or []
            key = (
                (item.product_name or "").strip(),
                (item.fabric_type or "").strip(),
                (item.neck_type or "").strip(),
                (item.sleeve_type or "").strip(),
                json.dumps(item.quantity_matrix or {}, sort_keys=True),
                json.dumps(sel, sort_keys=True),
                bool(getattr(item, "is_oversize", False)),
            )

            if key in existing_map:
                # Update the existing OrderItem in-place and preserve pricing
                ei = existing_map[key]
                used_keys.add(key)
                try:
                    ei.quantity_matrix = json.dumps(item.quantity_matrix or {})
                except Exception:
                    ei.quantity_matrix = json.dumps({})
                ei.total_qty = int(qty)
                # Keep persisted pricing fields intact
                base_price = Decimal(str(ei.price_per_unit or 0))
                total_price = Decimal(str(ei.total_price or 0))
                total_cost = Decimal(str(ei.total_cost or 0))
                addon_total = Decimal(str(ei.item_addon_total or 0))

                items_total_price += total_price
                items_total_cost += total_cost

                # ensure selected_add_ons on payload matches stored selection
                try:
                    item.selected_add_ons = (
                        json.loads(ei.selected_add_ons) if ei.selected_add_ons else []
                    )
                except Exception:
                    item.selected_add_ons = sel

                db.add(ei)
                order_items_data.append(
                    {
                        "data": item,
                        "qty": qty,
                        "base": base_price,
                        "total": total_price,
                        "cost": total_cost,
                        "addon_total": addon_total,
                    }
                )
            else:
                # New or changed item: either use client-provided pricing or recalc
                try:
                    provided_price = (
                        Decimal(str(item.price_per_unit))
                        if getattr(item, "price_per_unit", None) is not None
                        else None
                    )
                    provided_total = (
                        Decimal(str(item.total_price))
                        if getattr(item, "total_price", None) is not None
                        else None
                    )
                except Exception:
                    provided_price = None
                    provided_total = None

                if provided_price is not None and provided_total is not None:
                    unit_price = provided_price
                    line_total = provided_total
                    line_cost = Decimal(str(getattr(item, "total_cost", 0) or 0))
                    selected = getattr(item, "selected_add_ons", []) or []
                    addon_total = Decimal(
                        str(getattr(item, "item_addon_total", 0) or 0)
                    )
                else:
                    calc = calculate_item_price(item, order_in.product_type, db)
                    unit_price = calc["unit_price"]
                    line_total = calc["line_total"]
                    line_cost = calc["line_cost"]
                    selected = calc["selected"]
                    addon_total = calc["addon_total"]

                items_total_price += line_total
                items_total_cost += line_cost
                # synchronize selected_add_ons back to payload object
                item.selected_add_ons = selected

                ni = OrderItemModel(
                    order_id=existing.id,
                    product_name=item.product_name,
                    fabric_type=item.fabric_type,
                    neck_type=item.neck_type,
                    sleeve_type=item.sleeve_type,
                    quantity_matrix=json.dumps(item.quantity_matrix or {}),
                    total_qty=qty,
                    price_per_unit=unit_price,
                    total_price=line_total,
                    total_cost=line_cost,
                    selected_add_ons=json.dumps(item.selected_add_ons or []),
                    item_addon_total=addon_total,
                )
                db.add(ni)
                order_items_data.append(
                    {
                        "data": item,
                        "qty": qty,
                        "base": unit_price,
                        "total": line_total,
                        "cost": line_cost,
                        "addon_total": addon_total,
                    }
                )

        # Delete any existing items that were not present in incoming payload
        for k, ei in list(existing_map.items()):
            if k not in used_keys:
                try:
                    # Remove from the parent relationship first to avoid SQLAlchemy
                    # attempting to cascade-save a deleted/transient instance.
                    if getattr(existing, "items", None) and ei in existing.items:
                        try:
                            existing.items.remove(ei)
                        except ValueError:
                            pass

                    db.delete(ei)
                except Exception:
                    # best-effort: ignore delete failures here and continue
                    logger.exception("Failed to delete OrderItem during update: %s", ei)

        # Flush to persist new/deleted items before continuing
        try:
            db.flush()
        except Exception:
            pass

    shipping = Decimal(str(order_in.shipping_cost or 0))
    manual_addon = Decimal(str(order_in.add_on_cost or 0))
    discount = Decimal(str(order_in.discount_amount or 0))
    design_fee = Decimal(str(order_in.design_fee or 0))
    item_addons_grand = sum(x["addon_total"] for x in order_items_data)

    # Guard: if manual addon equals computed addons, treat manual as 0 to avoid double-charging
    try:
        if manual_addon == Decimal(item_addons_grand):
            manual_addon = Decimal(0)
    except Exception:
        pass

    final_pre_vat = items_total_price + manual_addon + shipping - discount
    # VAT handling must match create_order logic
    if order_in.is_vat_included:
        vat = (final_pre_vat * Decimal("7")) / Decimal("107")
        vat = vat.quantize(Decimal("0.01"))
        grand_total = final_pre_vat.quantize(Decimal("0.01"))
    else:
        vat = (final_pre_vat * Decimal("0.07")).quantize(Decimal("0.01"))
        grand_total = (final_pre_vat + vat).quantize(Decimal("0.01"))

    # Update existing order fields (preserve order_no)
    existing.customer_id = customer.id
    existing.customer_name = clean_name
    existing.contact_channel = customer.channel
    existing.address = order_in.address
    existing.phone = order_in.phone
    existing.status = order_in.status
    existing.grand_total = grand_total
    existing.total_cost = items_total_cost
    existing.vat_amount = vat
    existing.shipping_cost = shipping
    existing.add_on_cost = manual_addon
    existing.add_on_options_total = item_addons_grand
    existing.design_fee = design_fee
    existing.discount_amount = discount
    existing.is_vat_included = order_in.is_vat_included
    existing.deadline = order_in.deadline
    existing.usage_date = order_in.usage_date
    existing.deposit_amount = order_in.deposit_amount
    existing.deposit_1 = order_in.deposit_1
    existing.deposit_2 = order_in.deposit_2
    existing.balance_amount = (
        grand_total - (order_in.deposit_1 or 0) - (order_in.deposit_2 or 0)
    )
    existing.note = order_in.note
    existing.created_by_id = current_user.id if current_user else existing.created_by_id

    db.add(existing)
    db.flush()

    # Items have been updated/created above in-place; order_items_data contains
    # the canonical per-item totals used to compute order-level totals.

    db.commit()
    db.refresh(existing)
    # Return serialized dict similar to read_order to satisfy response_model types
    return read_order(order_id, db)


@router.delete("/{order_id}", status_code=204)
def delete_order(order_id: int, db: Session = Depends(get_db)):
    o = db.query(OrderModel).filter(OrderModel.id == order_id).first()
    if o:
        db.delete(o)
        db.commit()
    return


@router.get("/{order_id}/logs")
def get_logs(order_id: int):
    return []


@router.get("/{order_id}")
def read_order(order_id: int, db: Session = Depends(get_db)):
    o = (
        db.query(OrderModel)
        .options(selectinload(OrderModel.customer), selectinload(OrderModel.items))
        .filter(OrderModel.id == order_id)
        .first()
    )
    if not o:
        raise HTTPException(status_code=404, detail="Order not found")

    o_dict = o.__dict__.copy()
    if o.customer:
        o_dict.update(
            {
                "customer_name": o.customer.name,
                "phone": o.customer.phone,
                "contact_channel": o.customer.channel,
                "address": o.customer.address,
            }
        )
    if o.items:
        items_list = []
        for i in o.items:
            i_dict = i.__dict__.copy()
            for k in ["quantity_matrix", "selected_add_ons"]:
                val = i_dict.get(k)
                if isinstance(val, str):
                    try:
                        i_dict[k] = json.loads(val)
                    except:
                        i_dict[k] = {} if k == "quantity_matrix" else []
                elif val is None:
                    i_dict[k] = {} if k == "quantity_matrix" else []
            i_dict["is_oversize"] = bool(i_dict.get("is_oversize", False))
            # Normalize numeric fields in item to Decimal where appropriate
            ITEM_DECIMAL_FIELDS = [
                "base_price",
                "price_per_unit",
                "cost_per_unit",
                "total_price",
                "total_cost",
                "total_qty",
                "item_addon_total",
            ]
            for fk in ITEM_DECIMAL_FIELDS:
                if fk in i_dict:
                    vv = i_dict.get(fk)
                    if vv is None:
                        continue
                    if not isinstance(vv, Decimal):
                        try:
                            i_dict[fk] = Decimal(str(vv))
                        except Exception:
                            pass
            items_list.append(i_dict)
        o_dict["items"] = items_list
    # Normalize decimal-like fields to Decimal to satisfy Pydantic serializers
    DECIMAL_FIELDS = [
        "advance_hold",
        "shipping_cost",
        "add_on_cost",
        "sizing_surcharge",
        "add_on_options_total",
        "design_fee",
        "discount_value",
        "discount_amount",
        "deposit_amount",
        "deposit_1",
        "deposit_2",
        "vat_amount",
        "grand_total",
        "balance_amount",
        "total_cost",
        "estimated_profit",
    ]
    for k in DECIMAL_FIELDS:
        if k in o_dict:
            v = o_dict.get(k)
            if v is None:
                continue
            if not isinstance(v, Decimal):
                try:
                    o_dict[k] = Decimal(str(v))
                except Exception:
                    pass
    return o_dict


# --- Patch: Dedicated endpoint to update only order status (avoids touching items) ---
class UpdateOrderStatus(BaseModel):
    status: str


@router.patch("/{order_id}/status", response_model=OrderSchema)
def update_order_status(
    order_id: int,
    payload: UpdateOrderStatus,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    existing = db.query(OrderModel).filter(OrderModel.id == order_id).first()
    if not existing:
        raise HTTPException(status_code=404, detail="Order not found")

    old_status = getattr(existing, "status", None)
    existing.status = payload.status
    db.add(existing)

    # Create an audit log entry for traceability
    details = {
        "changed_from": old_status,
        "changed_to": payload.status,
        "admin": getattr(current_user, "username", "Unknown"),
        "note": "Quick status update via PATCH /status",
    }
    try:
        audit = AuditLog(
            action="UPDATE_STATUS",
            target_type="order",
            target_id=str(existing.id),
            details=json.dumps(details),
        )
        db.add(audit)
    except Exception:
        # Non-fatal: don't block status change if audit log fails
        logger.exception("Failed to create audit log for status update")

    db.commit()
    db.refresh(existing)
    return read_order(order_id, db)


# --- Admin: Approve / Reject Slip Endpoint ---


class ApproveSlipRequest(BaseModel):
    installment: Literal["booking", "deposit", "balance"]
    approved: bool
    note: Optional[str] = None


def _send_notification(target: str, subject: str, message: str) -> None:
    """Placeholder notification sender — extend to send LINE/email/team messages."""
    logger.info("Notify %s: %s - %s", target, subject, message)


@router.patch("/{order_id}/approve-slip")
def approve_slip(
    order_id: int,
    payload: ApproveSlipRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    # Find order
    order = db.query(OrderModel).filter(OrderModel.id == order_id).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Order not found"
        )

    # Expected status mapping for installments -> next status
    expected_waiting = {
        "booking": "WAITING_BOOKING",
        "deposit": "WAITING_DEPOSIT",
        "balance": "WAITING_BALANCE",
    }
    next_status = {
        "booking": "BOOKING_VERIFIED",
        "deposit": "PRODUCTION",
        "balance": "COMPLETED",
    }

    old_status = getattr(order, "status", None)

    if payload.approved:
        # Move order forward according to the mapping. This is idempotent.
        new_status = next_status.get(payload.installment)
        order.status = new_status
    else:
        # On reject, set a rejection status to make it visible in admin.
        order.status = "SLIP_REJECTED"

    db.add(order)

    # Create audit log
    details = {
        "installment": payload.installment,
        "approved": payload.approved,
        "note": payload.note,
        "changed_from": old_status,
        "changed_to": order.status,
        "admin": getattr(current_user, "username", None),
    }
    audit = AuditLog(
        action=("APPROVE_SLIP" if payload.approved else "REJECT_SLIP"),
        target_type="order",
        target_id=str(order.id),
        details=json.dumps(details),
    )
    db.add(audit)

    db.commit()

    # Send notification (placeholder)
    try:
        target = order.customer_name or "customer"
        subject = f"Slip {'approved' if payload.approved else 'rejected'} for order {order.order_no}"
        message = f"Installment: {payload.installment}. Note: {payload.note or '-'}"
        _send_notification(target, subject, message)
    except Exception:
        logger.exception("Failed to send notification after slip approval")

    return {"ok": True, "order_id": order.id, "status": order.status}
