from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.order import Order
from app.models.customer import Customer
from app.schemas.order import OrderCreate, OrderResponse

router = APIRouter()

# --- 1. GET Orders (ดึงข้อมูลออเดอร์ทั้งหมด) ---
@router.get("/", response_model=List[OrderResponse])
def read_orders(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    orders = db.query(Order).order_by(Order.id.desc()).offset(skip).limit(limit).all()
    # ใช้ from_orm เพื่อแปลงข้อมูลจาก Database Model เป็น Pydantic Schema
    return [OrderResponse.from_orm(o) for o in orders]

# --- 2. Create Order (สร้างออเดอร์ + สร้างลูกค้าถ้าไม่มี) ---
@router.post("/", response_model=OrderResponse)
def create_order(order_in: OrderCreate, db: Session = Depends(get_db)):
    # 1. ค้นหาลูกค้าจากชื่อ ถ้าไม่มีให้สร้างใหม่
    customer = db.query(Customer).filter(Customer.name == order_in.customer_name).first()
    
    if not customer:
        customer = Customer(
            name=order_in.customer_name,
            # เช็คว่ามี contact_channel ส่งมาไหม ถ้าไม่มีให้ใส่ Unknown
            channel=getattr(order_in, "contact_channel", "Unknown") 
        )
        db.add(customer)
        db.commit()
        db.refresh(customer)
    
    # 2. คำนวณ Balance (ยอดคงเหลือ)
    # ถ้ามีการส่ง total_amount และ deposit มา ให้คำนวณ balance
    grand_total = order_in.total_amount or 0
    deposit = order_in.deposit or 0
    balance = grand_total - deposit

    # 3. สร้าง Order ลง Database
    db_order = Order(
        order_no=order_in.order_no,
        customer_id=customer.id,
        total_amount=grand_total,   # ยอดรวม
        grand_total=grand_total,    # สำรองเผื่อใช้ field นี้
        deposit=deposit,            # มัดจำ
        balance=balance,            # ยอดค้างชำระ
        status=order_in.status,
        deadline=order_in.deadline, # วันที่ส่งมอบ
        urgency_level="normal"      # Default urgency
    )
    
    db.add(db_order)
    db.commit()
    db.refresh(db_order)
    
    return OrderResponse.from_orm(db_order)

# --- 3. DELETE Order (ฟังก์ชันลบที่เพิ่มเข้ามา) ---
@router.delete("/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_order(order_id: int, db: Session = Depends(get_db)):
    # 1. ค้นหาออเดอร์ตาม ID
    order = db.query(Order).filter(Order.id == order_id).first()
    
    # 2. ถ้าหาไม่เจอ ให้แจ้ง Error 404
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail=f"Order with ID {order_id} not found"
        )
    
    # 3. ถ้าเจอ ให้สั่งลบ
    db.delete(order)
    db.commit()
    
    # 4. ส่งกลับ 204 No Content (ลบสำเร็จ ไม่ต้องส่ง Body)
    return None