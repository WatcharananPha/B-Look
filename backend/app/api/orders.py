from typing import List, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from datetime import date, datetime

from app.db.session import get_db
from app.models.order import Order
from app.models.customer import Customer
from app.models.user import User
# ต้องแน่ใจว่าได้สร้างไฟล์ app/models/audit_log.py ตามแผนแล้ว
from app.models.audit_log import AuditLog 
from app.schemas.order import OrderCreate, OrderResponse
from app.api.deps import get_current_user

router = APIRouter()

# Helper function สำหรับแปลงค่าเป็น String เพื่อเก็บลง Log
def to_str(value: Any) -> str:
    if value is None:
        return "None"
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    return str(value)

# --- GET Orders ---
@router.get("/", response_model=List[OrderResponse])
def read_orders(
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user) # บังคับ Login
):
    # TODO: ในอนาคตสามารถเพิ่ม Logic กรองตาม Role ได้ที่นี่ (เช่น Sales เห็นเฉพาะของตัวเอง)
    orders = db.query(Order).order_by(Order.id.desc()).offset(skip).limit(limit).all()
    return [OrderResponse.from_orm(o) for o in orders]

# --- CREATE Order ---
@router.post("/", response_model=OrderResponse)
async def create_order(
    request: Request, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    data = await request.json()
    
    # 1. จัดการลูกค้า (Auto-create logic)
    customer_name = data.get("customer_name")
    customer = db.query(Customer).filter(Customer.name == customer_name).first()
    if not customer:
        customer = Customer(
            name=customer_name,
            channel=data.get("contact_channel", "Unknown"),
            phone=data.get("phone"),
            address=data.get("address")
        )
        db.add(customer)
        db.commit()
        db.refresh(customer)
    
    # 2. เตรียมข้อมูล Financials
    total_amount = data.get("total_amount", 0)
    deposit = data.get("deposit", 0)
    balance = float(total_amount) - float(deposit)

    # 3. สร้าง Order
    db_order = Order(
        order_no=data.get("order_no"),
        customer_id=customer.id,
        created_by_id=current_user.id, # บันทึกว่าใครสร้าง
        total_amount=total_amount,
        grand_total=total_amount,
        deposit=deposit,
        balance=balance,
        status=data.get("status", "draft"),
        deadline=data.get("deadline"),
        usage_date=data.get("usage_date"),
        proof_date=data.get("proof_date"),
        rush_fee=data.get("rush_fee", 0),
        urgency_level="normal"
    )
    
    db.add(db_order)
    db.commit()
    db.refresh(db_order)

    # 4. (Optional) บันทึก Log การสร้าง (Action: create)
    log = AuditLog(
        order_id=db_order.id,
        user_id=current_user.id,
        action="create",
        field_name="order",
        new_value=f"Created Order {db_order.order_no}"
    )
    db.add(log)
    db.commit()
    
    return OrderResponse.from_orm(db_order)

# --- UPDATE Order (With History Log) ---
@router.put("/{order_id}", response_model=OrderResponse)
async def update_order(
    order_id: int, 
    request: Request, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    data = await request.json()
    
    # 1. หาออเดอร์เดิม
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    log_entries = [] # เก็บรายการที่จะบันทึก Log

    # Helper function สำหรับเช็คความเปลี่ยนแปลง
    def check_and_set(field: str, new_val: Any):
        old_val = getattr(order, field)
        # แปลงเป็น String เพื่อเปรียบเทียบ (ป้องกัน Error เรื่อง Type ต่างกัน)
        if to_str(old_val) != to_str(new_val) and new_val is not None:
            log_entries.append({
                "field": field,
                "old": to_str(old_val),
                "new": to_str(new_val)
            })
            setattr(order, field, new_val)

    # 2. อัปเดตลูกค้า (Special Logic)
    if "customer_name" in data:
        new_name = data["customer_name"]
        if order.customer.name != new_name:
            # หาหรือสร้างลูกค้าใหม่
            customer = db.query(Customer).filter(Customer.name == new_name).first()
            if not customer:
                customer = Customer(
                    name=new_name, 
                    channel=data.get("contact_channel", "Unknown"),
                    phone=data.get("phone"),
                    address=data.get("address")
                )
                db.add(customer)
                db.commit()
                db.refresh(customer)
            
            # บันทึก Log
            log_entries.append({
                "field": "customer",
                "old": order.customer.name,
                "new": customer.name
            })
            order.customer_id = customer.id

    # 3. อัปเดตข้อมูลทั่วไป
    simple_fields = ["status", "deadline", "usage_date", "proof_date", "rush_fee", "total_amount", "deposit"]
    for field in simple_fields:
        if field in data:
            check_and_set(field, data[field])

    # 4. คำนวณ Balance ใหม่ถ้ามีการเปลี่ยนยอดเงิน
    if "total_amount" in data or "deposit" in data:
        order.grand_total = order.total_amount # ใน Phase นี้ให้ grand_total = total_amount ไปก่อน
        order.balance = (float(order.grand_total or 0) - float(order.deposit or 0))

    # 5. บันทึก Changes ลง Database และ Audit Log
    try:
        # บันทึก Audit Logs
        for entry in log_entries:
            audit_log = AuditLog(
                order_id=order.id,
                user_id=current_user.id,
                action="update",
                field_name=entry["field"],
                old_value=entry["old"],
                new_value=entry["new"]
            )
            db.add(audit_log)
        
        db.commit()
        db.refresh(order)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

    return OrderResponse.from_orm(order)

# --- DELETE Order ---
@router.delete("/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_order(
    order_id: int, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Optional: บันทึก Log ก่อนลบ (แต่ต้องระวัง FK ถ้าลบ Order แล้ว Log จะหายไหม -> ควรตั้ง FK เป็น SET NULL หรือเก็บแค่ Text)
    # ในที่นี้เราจะลบ Order ไปเลย
    
    db.delete(order)
    db.commit()
    return None