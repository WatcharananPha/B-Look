from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.order import Order
from app.models.customer import Customer
from app.schemas.order import OrderCreate, OrderResponse

router = APIRouter()

# --- 1. GET Orders (แก้ 405 Method Not Allowed) ---
@router.get("/", response_model=List[OrderResponse])
def read_orders(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    orders = db.query(Order).order_by(Order.id.desc()).offset(skip).limit(limit).all()
    # Map Relation to Schema manual hook or let Pydantic handle it via from_attributes
    return [OrderResponse.from_orm(o) for o in orders]

# --- 2. Create Order (แก้ 422 & Logic สร้างลูกค้าอัตโนมัติ) ---
@router.post("/", response_model=OrderResponse)
def create_order(order_in: OrderCreate, db: Session = Depends(get_db)):
    # Check Logic: ค้นหาลูกค้าจากชื่อ ถ้าไม่มีให้สร้างใหม่
    customer = db.query(Customer).filter(Customer.name == order_in.customer_name).first()
    if not customer:
        customer = Customer(
            name=order_in.customer_name,
            channel=order_in.contact_channel or "Unknown"
        )
        db.add(customer)
        db.commit()
        db.refresh(customer)
    
    # สร้าง Order
    db_order = Order(
        order_no=order_in.order_no,
        customer_id=customer.id,
        total_amount=order_in.total_amount,
        deposit=order_in.deposit,
        status=order_in.status,
        deadline=order_in.deadline,
        # items processing logic here (skipped for Module 2 scope)
    )
    db.add(db_order)
    db.commit()
    db.refresh(db_order)
    
    return OrderResponse.from_orm(db_order)