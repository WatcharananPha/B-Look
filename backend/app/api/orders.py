from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.order import Order
from app.models.customer import Customer
from app.schemas.order import OrderCreate, OrderResponse

router = APIRouter()

# --- GET Orders ---
@router.get("/", response_model=List[OrderResponse])
def read_orders(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    orders = db.query(Order).order_by(Order.id.desc()).offset(skip).limit(limit).all()
    return [OrderResponse.from_orm(o) for o in orders]

# --- CREATE Order ---
@router.post("/", response_model=OrderResponse)
async def create_order(request: Request, db: Session = Depends(get_db)):
    data = await request.json()
    
    # 1. จัดการลูกค้า (Auto-create)
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
    
    # 2. คำนวณยอด
    total_amount = data.get("total_amount", 0)
    deposit = data.get("deposit", 0)
    balance = total_amount - deposit

    # 3. สร้าง Order
    db_order = Order(
        order_no=data.get("order_no"),
        customer_id=customer.id,
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
    
    return OrderResponse.from_orm(db_order)

# --- UPDATE Order (เพิ่มใหม่) ---
@router.put("/{order_id}", response_model=OrderResponse)
async def update_order(order_id: int, request: Request, db: Session = Depends(get_db)):
    data = await request.json()
    
    # 1. หาออเดอร์เดิม
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # 2. อัปเดตลูกค้า (ถ้ามีการเปลี่ยนชื่อ)
    if "customer_name" in data:
        customer_name = data["customer_name"]
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
        order.customer_id = customer.id

    # 3. อัปเดตข้อมูลอื่นๆ
    if "total_amount" in data:
        order.total_amount = data["total_amount"]
        order.grand_total = data["total_amount"]
        
    if "deposit" in data:
        order.deposit = data["deposit"]
        
    # Recalculate balance
    order.balance = (order.grand_total or 0) - (order.deposit or 0)

    # Update optional fields
    for field in ["status", "deadline", "usage_date", "proof_date", "rush_fee"]:
        if field in data:
            setattr(order, field, data[field])

    db.commit()
    db.refresh(order)
    return OrderResponse.from_orm(order)

# --- DELETE Order ---
@router.delete("/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_order(order_id: int, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    db.delete(order)
    db.commit()
    return None