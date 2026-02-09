from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, selectinload
from typing import List, Any
import uuid
from decimal import Decimal, ROUND_UP
import json
import logging
from datetime import datetime, timezone

from app.db.session import get_db
from app.models.order import Order as OrderModel, OrderItem as OrderItemModel
from app.models.customer import Customer
from app.models.user import User
from app.models.audit_log import AuditLog
from app.api import deps
from app.schemas.order import OrderCreate, Order as OrderSchema

# --- Pricing Rules ---
STEP_PRICING = {
    "roundVNeck": [
        {"minQty": 10, "maxQty": 30, "price": Decimal(240)},
        {"minQty": 31, "maxQty": 50, "price": Decimal(220)},
        {"minQty": 51, "maxQty": 100, "price": Decimal(190)},
        {"minQty": 101, "maxQty": 300, "price": Decimal(180)},
        {"minQty": 301, "maxQty": 99999, "price": Decimal(170)},
    ],
    "collarOthers": [
        {"minQty": 10, "maxQty": 30, "price": Decimal(300)}, # ฐาน 300
        {"minQty": 31, "maxQty": 50, "price": Decimal(260)},
        {"minQty": 51, "maxQty": 100, "price": Decimal(240)},
        {"minQty": 101, "maxQty": 300, "price": Decimal(220)},
        {"minQty": 301, "maxQty": 99999, "price": Decimal(200)},
    ],
    "sportsPants": Decimal(210),
    "fashionPants": Decimal(280),
}

ADDON_PRICES = {
    "longSleeve": Decimal(40),
    "pocket": Decimal(20),
    "numberName": Decimal(20),
    "slopeShoulder": Decimal(40), # ค่าไหล่สโลป 40
    "collarTongue": Decimal(10),
    "shortSleeveAlt": Decimal(20),
    "oversizeSlopeShoulder": Decimal(60),
}

OVERSIZE_ALLOWED_NECKS = ["คอกลม", "คอวี", "คอวีตัด", "คอวีปก"]

# คอที่ต้องบังคับบวก 40 (slopeShoulder)
FORCE_SLOPE_NECKS = [
    "คอปกคางหมู", 
    "คอหยดนํ้า", "คอหยดน้ำ", 
    "คอห้าเหลี่ยมคางหมู"
]

router = APIRouter()
logger = logging.getLogger(__name__)

# --- 1. GET ALL ORDERS (แก้ปัญหาซ้ำซ้อน) ---
@router.get("/", response_model=List[OrderSchema])
def read_orders(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    # ✅ FIX: ใช้ selectinload แทน joinedload เพื่อแก้ปัญหา Cartesian Product (รายการซ้ำ)
    orders = (
        db.query(OrderModel)
        .options(
            selectinload(OrderModel.customer),
            selectinload(OrderModel.items)
        )
        .order_by(OrderModel.id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    results = []
    for o in orders:
        o_dict = o.__dict__.copy()

        if o.customer:
            if not o_dict.get("customer_name"): o_dict["customer_name"] = o.customer.name
            if not o_dict.get("phone"): o_dict["phone"] = o.customer.phone
            if not o_dict.get("contact_channel"): o_dict["contact_channel"] = o.customer.channel
            if not o_dict.get("address"): o_dict["address"] = o.customer.address

        if o.items:
            items_list = []
            for item in o.items:
                item_dict = item.__dict__.copy()
                # Parse JSON fields safely
                for k in ["quantity_matrix", "selected_add_ons"]:
                    val = item_dict.get(k)
                    if val and isinstance(val, str):
                        try:
                            item_dict[k] = json.loads(val)
                        except:
                            item_dict[k] = {} if k == "quantity_matrix" else []
                    elif not val:
                        item_dict[k] = {} if k == "quantity_matrix" else []
                
                item_dict["is_oversize"] = bool(item_dict.get("is_oversize", False))
                items_list.append(item_dict)
            o_dict["items"] = items_list

        results.append(o_dict)

    return results


# --- 2. CREATE ORDER ---
@router.post("/", status_code=status.HTTP_201_CREATED)
def create_order(
    order_in: OrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    logger.info(f"CREATE ORDER: {order_in.customer_name}")

    # Handle Customer
    incoming_channel = getattr(order_in, "channel", None)
    final_channel = incoming_channel if incoming_channel else order_in.contact_channel
    clean_name = order_in.customer_name.strip() if order_in.customer_name else "Unknown"

    customer = db.query(Customer).filter(Customer.name == clean_name).first()
    if not customer:
        customer = Customer(name=clean_name, phone=order_in.phone, channel=final_channel, address=order_in.address, customer_code=order_in.customer_code)
        db.add(customer)
        db.flush()
    else:
        # Update if changed
        if final_channel and customer.channel != final_channel: customer.channel = final_channel
        if order_in.phone and customer.phone != order_in.phone: customer.phone = order_in.phone
        if order_in.address and customer.address != order_in.address: customer.address = order_in.address
        if order_in.customer_code and customer.customer_code != order_in.customer_code: customer.customer_code = order_in.customer_code
        db.add(customer)
        db.flush()

    # Calculate Items
    items_total_price = Decimal(0)
    items_total_cost = Decimal(0)
    order_items_data = []

    for item in order_in.items:
        qty = sum(item.quantity_matrix.values()) if item.quantity_matrix else 0
        p_type = getattr(item, "product_type", None) or getattr(order_in, "product_type", "shirt")

        # Base Price Logic
        if p_type == "sportsPants": computed_unit = STEP_PRICING["sportsPants"]
        elif p_type == "fashionPants": computed_unit = STEP_PRICING["fashionPants"]
        else:
            neck_name = (item.neck_type or "").strip()
            is_round_v = "ปก" not in neck_name and any(k in neck_name for k in ["คอกลม", "คอวี"])
            pricing_table = STEP_PRICING["roundVNeck"] if is_round_v else STEP_PRICING["collarOthers"]
            
            if qty >= 10:
                matched = next((t for t in pricing_table if qty >= t["minQty"] and qty <= t["maxQty"]), None)
                computed_unit = matched["price"] if matched else pricing_table[0]["price"]
            else:
                computed_unit = Decimal(240) if is_round_v else Decimal(300)

        # ✅ FIX PRICE LOGIC: Force Add-ons based on Neck Name
        selected = getattr(item, "selected_add_ons", []) or []
        neck_str = item.neck_type or ""
        
        # 1. Force "มีลิ้น" -> collarTongue (+10)
        if "มีลิ้น" in neck_str and "collarTongue" not in selected:
            selected = list(selected) + ["collarTongue"]
            
        # 2. Force Special Necks -> slopeShoulder (+40)
        # นี่คือจุดสำคัญ: ราคาฐานจะยังคงเป็น 300 แต่เราบวก Addon 40 บาทเข้าไป
        if any(n in neck_str for n in FORCE_SLOPE_NECKS):
            if "slopeShoulder" not in selected:
                selected = list(selected) + ["slopeShoulder"]

        # 3. Force Oversize -> oversizeSlopeShoulder (+60)
        if getattr(item, "is_oversize", False):
            if "oversizeSlopeShoulder" not in selected:
                selected = list(selected) + ["oversizeSlopeShoulder"]

        # Calculate Addon Total
        item_addon_total = Decimal(0)
        for a in selected:
            price_a = ADDON_PRICES.get(a)
            if price_a: item_addon_total += price_a * qty

        # Sizing Surcharge
        oversize_qty = 0
        for size, n in (item.quantity_matrix or {}).items():
            if getattr(item, "is_oversize", False):
                if any(x in size for x in ["2XL","3XL","4XL","5XL"]): oversize_qty += int(n)
            else:
                if any(x in size for x in ["4XL","5XL"]): oversize_qty += int(n)
        
        sizing_surcharge_item = Decimal(oversize_qty) * Decimal(100)
        
        # Final Line Calculation
        computed_price_per_unit = Decimal(computed_unit)
        line_price = (computed_price_per_unit * qty) + item_addon_total + sizing_surcharge_item
        line_cost = Decimal(str(item.cost_per_unit or 0)) * qty

        items_total_price += line_price
        items_total_cost += line_cost
        
        # Update item object
        item.selected_add_ons = selected

        order_items_data.append({
            "data": item, 
            "qty": qty, 
            "base_price": computed_price_per_unit, # e.g., 300
            "total_price": line_price,             # e.g., 340 * qty
            "total_cost": line_cost,
            "item_addon_total": item_addon_total,
            "item_sizing_surcharge": sizing_surcharge_item
        })

    # Financials
    shipping = Decimal(str(order_in.shipping_cost))
    addon_manual = Decimal(str(order_in.add_on_cost))
    design_fee = Decimal(str(order_in.design_fee))
    
    computed_addon_total = sum(d["item_addon_total"] for d in order_items_data)
    computed_sizing_surcharge = sum(d["item_sizing_surcharge"] for d in order_items_data)
    
    add_on_options_total = computed_addon_total
    sizing_surcharge = computed_sizing_surcharge
    
    total_before_vat = items_total_price + addon_manual + shipping + sizing_surcharge + add_on_options_total - Decimal(str(order_in.discount_amount))
    
    if order_in.is_vat_included:
        grand_total = total_before_vat
        vat_amount = (total_before_vat * 7) / 107
    else:
        vat_amount = total_before_vat * Decimal("0.07")
        grand_total = total_before_vat + vat_amount

    # Deposit
    raw_dep1 = getattr(order_in, "deposit_1", None)
    raw_dep2 = getattr(order_in, "deposit_2", None)
    if (not raw_dep1 or Decimal(str(raw_dep1)) == 0) and (not raw_dep2 or Decimal(str(raw_dep2)) == 0):
        dep1 = (grand_total / 2).quantize(Decimal("1"), rounding=ROUND_UP)
        dep2 = max(grand_total - dep1 - design_fee, Decimal(0))
    else:
        dep1 = Decimal(str(raw_dep1 or 0))
        dep2 = Decimal(str(raw_dep2 or 0))
        if dep2 == 0 and not raw_dep2:
             dep2 = max(grand_total - dep1 - design_fee, Decimal(0))

    new_order = OrderModel(
        order_no=order_in.order_no.strip() if order_in.order_no else f"PO-{uuid.uuid4().hex[:6].upper()}",
        brand=order_in.brand,
        customer_id=customer.id,
        customer_name=clean_name,
        customer_code=order_in.customer_code,
        graphic_code=order_in.graphic_code,
        product_type=order_in.product_type,
        contact_channel=final_channel,
        address=order_in.address,
        phone=order_in.phone,
        deadline=order_in.deadline,
        usage_date=order_in.usage_date,
        urgency_level=order_in.urgency_level or "normal",
        status=order_in.status,
        is_vat_included=order_in.is_vat_included,
        shipping_cost=shipping,
        add_on_cost=addon_manual,
        sizing_surcharge=sizing_surcharge,
        add_on_options_total=add_on_options_total,
        design_fee=design_fee,
        discount_type=order_in.discount_type,
        discount_value=Decimal(str(order_in.discount_value)),
        discount_amount=Decimal(str(order_in.discount_amount)),
        vat_amount=vat_amount,
        grand_total=grand_total,
        deposit_amount=dep1 + dep2,
        deposit_1=dep1,
        deposit_2=dep2,
        balance_amount=grand_total - (dep1 + dep2),
        total_cost=items_total_cost,
        estimated_profit=(grand_total - vat_amount) - items_total_cost,
        note=order_in.note,
        created_by_id=current_user.id if current_user else None,
    )
    db.add(new_order)
    db.flush()

    for d in order_items_data:
        src = d["data"]
        q_matrix = json.dumps(src.quantity_matrix) if isinstance(src.quantity_matrix, dict) else src.quantity_matrix
        new_item = OrderItemModel(
            order_id=new_order.id,
            product_name=src.product_name,
            fabric_type=src.fabric_type,
            neck_type=src.neck_type,
            sleeve_type=src.sleeve_type,
            quantity_matrix=q_matrix,
            total_qty=d["qty"],
            price_per_unit=d["base_price"], # บันทึก Base (300)
            total_price=d["total_price"],   # บันทึกยอดรวม (340 * qty)
            cost_per_unit=src.cost_per_unit,
            total_cost=d["total_cost"],
            selected_add_ons=json.dumps(src.selected_add_ons),
            is_oversize=src.is_oversize,
            item_addon_total=d["item_addon_total"], # บันทึกยอด Addon แยก (40 * qty)
            item_sizing_surcharge=d["item_sizing_surcharge"]
        )
        db.add(new_item)

    db.add(AuditLog(action="CREATE", target_type="order", target_id=str(new_order.id), 
           details=f"Created {new_order.order_no}", user_id=current_user.id if current_user else None))
    db.commit()
    db.refresh(new_order)
    
    resp = new_order.__dict__.copy()
    if customer:
        resp["contact_channel"] = resp.get("contact_channel") or customer.channel
        resp["phone"] = resp.get("phone") or customer.phone
        resp["address"] = resp.get("address") or customer.address
    return resp

# --- 3. GET SINGLE ORDER ---
@router.get("/{order_id}", response_model=OrderSchema)
def read_order(order_id: int, db: Session = Depends(get_db)):
    order = db.query(OrderModel).filter(OrderModel.id == order_id).first()
    if not order: raise HTTPException(status_code=404, detail="Order not found")
    
    order_dict = order.__dict__.copy()
    if order.customer:
        order_dict["customer_name"] = order.customer.name
        order_dict["phone"] = order.customer.phone
        order_dict["contact_channel"] = order.customer.channel
        order_dict["address"] = order.customer.address

    if order.items:
        items_list = []
        for item in order.items:
            item_dict = item.__dict__.copy()
            for k in ["quantity_matrix", "selected_add_ons"]:
                val = item_dict.get(k)
                if val and isinstance(val, str):
                    try: item_dict[k] = json.loads(val)
                    except: item_dict[k] = {} if k == "quantity_matrix" else []
                elif not val: item_dict[k] = {} if k == "quantity_matrix" else []
            item_dict["is_oversize"] = bool(item_dict.get("is_oversize", False))
            items_list.append(item_dict)
        order_dict["items"] = items_list
    return order_dict

# --- 4. UPDATE ORDER (Logic เดียวกับ Create) ---
@router.put("/{order_id}", response_model=OrderSchema)
def update_order(
    order_id: int,
    order_in: OrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    order = db.query(OrderModel).filter(OrderModel.id == order_id).first()
    if not order: raise HTTPException(status_code=404, detail="Order not found")

    incoming_channel = getattr(order_in, "channel", None)
    final_channel = incoming_channel if incoming_channel else order_in.contact_channel
    clean_name = order_in.customer_name.strip() if order_in.customer_name else "Unknown"

    customer = db.query(Customer).filter(Customer.name == clean_name).first()
    if not customer:
        customer = Customer(name=clean_name, phone=order_in.phone, channel=final_channel, address=order_in.address, customer_code=order_in.customer_code)
        db.add(customer)
        db.flush()
    else:
        if final_channel: customer.channel = final_channel
        if order_in.address: customer.address = order_in.address
        if order_in.phone: customer.phone = order_in.phone
        db.add(customer)
        db.flush()

    # Recalc Logic
    items_total_price = Decimal(0)
    items_total_cost = Decimal(0)
    order_items_data = []

    for item in order_in.items:
        qty = sum(item.quantity_matrix.values()) if item.quantity_matrix else 0
        p_type = getattr(item, "product_type", None) or getattr(order_in, "product_type", "shirt")

        if p_type == "sportsPants": computed_unit = STEP_PRICING["sportsPants"]
        elif p_type == "fashionPants": computed_unit = STEP_PRICING["fashionPants"]
        else:
            neck_name = (item.neck_type or "").strip()
            is_round_v = "ปก" not in neck_name and any(k in neck_name for k in ["คอกลม", "คอวี"])
            pricing_table = STEP_PRICING["roundVNeck"] if is_round_v else STEP_PRICING["collarOthers"]
            
            if qty >= 10:
                matched = next((t for t in pricing_table if qty >= t["minQty"] and qty <= t["maxQty"]), None)
                computed_unit = matched["price"] if matched else pricing_table[0]["price"]
            else:
                computed_unit = Decimal(240) if is_round_v else Decimal(300)

        selected = getattr(item, "selected_add_ons", []) or []
        neck_str = item.neck_type or ""
        
        if "มีลิ้น" in neck_str and "collarTongue" not in selected: selected = list(selected) + ["collarTongue"]
        if any(n in neck_str for n in FORCE_SLOPE_NECKS):
            if "slopeShoulder" not in selected: selected = list(selected) + ["slopeShoulder"]
        if getattr(item, "is_oversize", False) and "oversizeSlopeShoulder" not in selected:
            selected = list(selected) + ["oversizeSlopeShoulder"]

        item_addon_total = Decimal(0)
        for a in selected:
            price_a = ADDON_PRICES.get(a)
            if price_a: item_addon_total += price_a * qty

        oversize_qty = 0
        for size, n in (item.quantity_matrix or {}).items():
            if getattr(item, "is_oversize", False):
                if any(x in size for x in ["2XL","3XL","4XL","5XL"]): oversize_qty += int(n)
            else:
                if any(x in size for x in ["4XL","5XL"]): oversize_qty += int(n)
        
        sizing_surcharge_item = Decimal(oversize_qty) * Decimal(100)
        
        computed_price_per_unit = Decimal(computed_unit)
        line_price = (computed_price_per_unit * qty) + item_addon_total + sizing_surcharge_item
        line_cost = Decimal(str(item.cost_per_unit or 0)) * qty

        items_total_price += line_price
        items_total_cost += line_cost
        item.selected_add_ons = selected

        order_items_data.append({
            "data": item, "qty": qty, "base_price": computed_price_per_unit,
            "total_price": line_price, "total_cost": line_cost,
            "item_addon_total": item_addon_total, "item_sizing_surcharge": sizing_surcharge_item
        })

    # Financials
    shipping = Decimal(str(order_in.shipping_cost))
    addon_manual = Decimal(str(order_in.add_on_cost))
    design_fee = Decimal(str(order_in.design_fee))
    computed_addon_total = sum(d["item_addon_total"] for d in order_items_data)
    computed_sizing_surcharge = sum(d["item_sizing_surcharge"] for d in order_items_data)
    
    total_before_vat = items_total_price + addon_manual + shipping + computed_sizing_surcharge + computed_addon_total - Decimal(str(order_in.discount_amount))
    
    if order_in.is_vat_included:
        grand_total = total_before_vat
        vat_amount = (total_before_vat * 7) / 107
    else:
        vat_amount = total_before_vat * Decimal("0.07")
        grand_total = total_before_vat + vat_amount

    # Update Fields
    order.customer_id = customer.id
    order.customer_name = clean_name
    order.contact_channel = final_channel
    order.address = order_in.address
    order.phone = order_in.phone
    order.customer_code = order_in.customer_code
    order.brand = order_in.brand
    order.product_type = order_in.product_type
    order.status = order_in.status
    order.is_vat_included = order_in.is_vat_included
    order.shipping_cost = shipping
    order.add_on_cost = addon_manual
    order.sizing_surcharge = computed_sizing_surcharge
    order.add_on_options_total = computed_addon_total
    order.design_fee = design_fee
    order.discount_amount = Decimal(str(order_in.discount_amount))
    order.vat_amount = vat_amount
    order.grand_total = grand_total
    order.total_cost = items_total_cost
    order.estimated_profit = (grand_total - vat_amount) - items_total_cost
    order.note = order_in.note

    db.query(OrderItemModel).filter(OrderItemModel.order_id == order.id).delete()
    for d in order_items_data:
        src = d["data"]
        q_matrix = json.dumps(src.quantity_matrix) if isinstance(src.quantity_matrix, dict) else src.quantity_matrix
        new_item = OrderItemModel(
            order_id=order.id,
            product_name=src.product_name,
            fabric_type=src.fabric_type,
            neck_type=src.neck_type,
            sleeve_type=src.sleeve_type,
            quantity_matrix=q_matrix,
            total_qty=d["qty"],
            price_per_unit=d["base_price"],
            total_price=d["total_price"],
            cost_per_unit=src.cost_per_unit,
            total_cost=d["total_cost"],
            selected_add_ons=json.dumps(src.selected_add_ons),
            is_oversize=src.is_oversize,
            item_addon_total=d["item_addon_total"],
            item_sizing_surcharge=d["item_sizing_surcharge"]
        )
        db.add(new_item)

    db.add(AuditLog(action="UPDATE", target_type="order", target_id=str(order.id), 
           details=f"Updated {order.order_no}", user_id=current_user.id if current_user else None))
    db.commit()
    db.refresh(order)
    
    return order.__dict__

@router.delete("/{order_id}", status_code=204)
def delete_order(order_id: int, db: Session = Depends(get_db), current_user: User = Depends(deps.get_current_user)):
    order = db.query(OrderModel).filter(OrderModel.id == order_id).first()
    if not order: raise HTTPException(status_code=404, detail="Order not found")
    db.add(AuditLog(action="DELETE", target_type="order", target_id=str(order.id), 
           details=f"Deleted {order.order_no}", user_id=current_user.id if current_user else None))
    db.delete(order)
    db.commit()
    return None

@router.get("/{order_id}/logs")
def get_order_logs(order_id: int, db: Session = Depends(get_db)):
    logs = db.query(AuditLog).filter(AuditLog.target_type == "order", AuditLog.target_id == str(order_id)).order_by(AuditLog.created_at.desc()).all()
    return [{"id": l.id, "action": l.action, "details": l.details, "created_at": l.created_at, "user": l.user.username if l.user else "Unknown"} for l in logs]
