from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, selectinload
from typing import List
from decimal import Decimal
import uuid
import json
import logging

from app.db.session import get_db
from app.models.order import Order as OrderModel, OrderItem as OrderItemModel
from app.models.customer import Customer
from app.models.user import User
from app.models.product import NeckType # ✅ ต้อง Import เพื่อดึงราคา
from app.models.audit_log import AuditLog
from app.api import deps
from app.schemas.order import OrderCreate, Order as OrderSchema

# ราคาฐาน (Step Price) ยังคงที่
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

# ค่า Default เผื่อหาใน DB ไม่เจอ
DEFAULT_ADDONS = {
    "collarTongue": Decimal(10),
    "slopeShoulder": Decimal(40),
    "longSleeve": Decimal(40),
    "oversizeSlopeShoulder": Decimal(60)
}

router = APIRouter()
logger = logging.getLogger(__name__)

# ✅ 1. แก้ Order ซ้ำด้วย selectinload
@router.get("/", response_model=List[OrderSchema])
def read_orders(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
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
        if o.customer:
            o_dict.update({
                "customer_name": o.customer.name,
                "phone": o.customer.phone,
                "contact_channel": o.customer.channel,
                "address": o.customer.address
            })
        if o.items:
            items_list = []
            for i in o.items:
                i_dict = i.__dict__.copy()
                # Parse JSON
                for k in ["quantity_matrix", "selected_add_ons"]:
                    val = i_dict.get(k)
                    if isinstance(val, str):
                        try: i_dict[k] = json.loads(val)
                        except: i_dict[k] = {} if k == "quantity_matrix" else []
                    elif val is None: i_dict[k] = {} if k == "quantity_matrix" else []
                i_dict["is_oversize"] = bool(i_dict.get("is_oversize", False))
                items_list.append(i_dict)
            o_dict["items"] = items_list
        results.append(o_dict)
    return results

# ✅ 2. ฟังก์ชันคำนวณราคาที่ดึงจาก DB จริงๆ
def calculate_item_price(item, order_prod_type, db: Session):
    qty = sum(item.quantity_matrix.values()) if item.quantity_matrix else 0
    p_type = getattr(item, "product_type", None) or order_prod_type or "shirt"
    
    # 2.1 Base Price
    if p_type == "sportsPants": unit_price = STEP_PRICING["sportsPants"]
    elif p_type == "fashionPants": unit_price = STEP_PRICING["fashionPants"]
    else:
        neck_str = (item.neck_type or "").strip()
        is_round_v = "ปก" not in neck_str and any(k in neck_str for k in ["คอกลม", "คอวี"])
        table = STEP_PRICING["roundVNeck"] if is_round_v else STEP_PRICING["collarOthers"]
        if qty >= 10:
            found = next((t for t in table if qty >= t["minQty"] and qty <= t["maxQty"]), None)
            unit_price = found["price"] if found else table[0]["price"]
        else:
            unit_price = Decimal(240) if is_round_v else Decimal(300)

    # 2.2 Addon Price (ดึงจาก DB)
    neck_str = (item.neck_type or "").strip()
    selected = getattr(item, "selected_add_ons", []) or []

    # ดึงราคาคอจาก DB (additional_cost)
    # ใช้ชื่อคอในการค้นหา (Exact Match)
    db_neck = db.query(NeckType).filter(NeckType.name == neck_str).first()
    
    # ราคา slope จาก DB (ถ้ามี) ถ้าไม่มีใช้ Default 40
    slope_cost_db = Decimal(40)
    if db_neck and db_neck.additional_cost is not None:
        slope_cost_db = Decimal(db_neck.additional_cost)

    # กฎบังคับ: ถ้าชื่อมี "บังคับไหล่สโลป" ต้องเลือก slopeShoulder
    if "(บังคับไหล่สโลป" in neck_str:
        if "slopeShoulder" not in selected:
            selected = list(selected) + ["slopeShoulder"]

    # กฎบังคับ: ถ้าชื่อมี "มีลิ้น" ต้องเลือก collarTongue
    if "มีลิ้น" in neck_str and "collarTongue" not in selected:
        selected = list(selected) + ["collarTongue"]

    # รวมราคา Addon
    addon_sum = Decimal(0)
    for code in selected:
        cost = DEFAULT_ADDONS.get(code, Decimal(0))
        
        # 🔥 Override ราคาด้วยค่าจาก DB
        if code == "slopeShoulder":
            cost = slope_cost_db
            
        addon_sum += cost

    total_addon_line = addon_sum * qty
    line_total = (unit_price * qty) + total_addon_line
    line_cost = Decimal(str(item.cost_per_unit or 0)) * qty
    
    return {
        "unit_price": unit_price,
        "line_total": line_total,
        "line_cost": line_cost,
        "selected": selected,
        "addon_total": total_addon_line
    }

@router.post("/", status_code=status.HTTP_201_CREATED)
def create_order(order_in: OrderCreate, db: Session = Depends(get_db), current_user: User = Depends(deps.get_current_user)):
    clean_name = order_in.customer_name.strip() if order_in.customer_name else "Unknown"
    customer = db.query(Customer).filter(Customer.name == clean_name).first()
    if not customer:
        customer = Customer(name=clean_name, phone=order_in.phone, channel=order_in.contact_channel, address=order_in.address, customer_code=order_in.customer_code)
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
        # ส่ง db เพื่อดึงราคา
        calc = calculate_item_price(item, order_in.product_type, db)
        
        items_total_price += calc["line_total"]
        items_total_cost += calc["line_cost"]
        item.selected_add_ons = calc["selected"]

        order_items_data.append({
            "data": item, "qty": qty, "base": calc["unit_price"], "total": calc["line_total"],
            "cost": calc["line_cost"], "addon_total": calc["addon_total"]
        })

    # Financials
    shipping = Decimal(str(order_in.shipping_cost or 0))
    manual_addon = Decimal(str(order_in.add_on_cost or 0))
    discount = Decimal(str(order_in.discount_amount or 0))
    design_fee = Decimal(str(order_in.design_fee or 0))
    item_addons_grand = sum(x["addon_total"] for x in order_items_data)
    
    final_pre_vat = items_total_price + manual_addon + shipping - discount
    if order_in.is_vat_included:
        grand_total = final_pre_vat
        vat = (final_pre_vat * 7) / 107
    else:
        vat = final_pre_vat * Decimal("0.07")
        grand_total = final_pre_vat + vat

    new_order = OrderModel(
        order_no=order_in.order_no or f"PO-{uuid.uuid4().hex[:6].upper()}",
        customer_id=customer.id, customer_name=clean_name, contact_channel=customer.channel,
        address=order_in.address, phone=order_in.phone, status=order_in.status,
        grand_total=grand_total, total_cost=items_total_cost, vat_amount=vat,
        shipping_cost=shipping, add_on_cost=manual_addon, add_on_options_total=item_addons_grand,
        design_fee=design_fee, discount_amount=discount, is_vat_included=order_in.is_vat_included,
        deadline=order_in.deadline, usage_date=order_in.usage_date,
        deposit_amount=order_in.deposit_amount, deposit_1=order_in.deposit_1, deposit_2=order_in.deposit_2,
        balance_amount=grand_total - (order_in.deposit_1 or 0) - (order_in.deposit_2 or 0),
        note=order_in.note, created_by_id=current_user.id if current_user else None
    )
    db.add(new_order)
    db.flush()

    for d in order_items_data:
        src = d["data"]
        ni = OrderItemModel(
            order_id=new_order.id, product_name=src.product_name, fabric_type=src.fabric_type,
            neck_type=src.neck_type, sleeve_type=src.sleeve_type,
            quantity_matrix=json.dumps(src.quantity_matrix), total_qty=d["qty"],
            price_per_unit=d["base"], total_price=d["total"], total_cost=d["cost"],
            selected_add_ons=json.dumps(src.selected_add_ons), item_addon_total=d["addon_total"]
        )
        db.add(ni)

    db.commit()
    db.refresh(new_order)
    return new_order

@router.put("/{order_id}", response_model=OrderSchema)
def update_order(order_id: int, order_in: OrderCreate, db: Session = Depends(get_db)):
    existing = db.query(OrderModel).filter(OrderModel.id == order_id).first()
    if not existing: raise HTTPException(status_code=404)
    db.query(OrderItemModel).filter(OrderItemModel.order_id == order_id).delete()
    return create_order(order_in, db, None) 

@router.delete("/{order_id}", status_code=204)
def delete_order(order_id: int, db: Session = Depends(get_db)):
    o = db.query(OrderModel).filter(OrderModel.id==order_id).first()
    if o:
        db.delete(o)
        db.commit()
    return

@router.get("/{order_id}/logs")
def get_logs(order_id: int): return []
