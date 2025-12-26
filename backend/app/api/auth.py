from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.order import Order, OrderItem
from app.models.customer import Customer
from pydantic import BaseModel
from typing import Dict, List, Optional
from datetime import date
import uuid

router = APIRouter()

# --- Pydantic Schemas (Validation) ---
class OrderItemSchema(BaseModel):
    product_name: str
    fabric_type: str
    neck_type: str
    sleeve_type: str
    quantity_matrix: Dict[str, int] # รับ JSON {"S": 10}
    price_per_unit: float

class OrderCreateSchema(BaseModel):
    customer_name: str
    phone: Optional[str] = None
    channel: str
    address: Optional[str] = None
    deadline_date: date
    urgency_level: str
    
    items: List[OrderItemSchema]
    
    is_vat_included: bool
    shipping_cost: float
    add_on_cost: float
    discount_amount: float
    deposit_amount: float

# --- API Endpoint ---
@router.post("/", status_code=201)
def create_order(order_data: OrderCreateSchema, db: Session = Depends(get_db)):
    # 1. Handle Customer (Find or Create)
    # ในระบบจริงอาจจะ Search ก่อน แต่ตัวอย่างนี้ Create ใหม่/อัพเดท
    customer = db.query(Customer).filter(Customer.name == order_data.customer_name).first()
    if not customer:
        customer = Customer(
            name=order_data.customer_name,
            phone=order_data.phone,
            channel=order_data.channel,
            address=order_data.address
        )
        db.add(customer)
        db.flush() # เพื่อให้ได้ customer.id

    # 2. Calculate Totals (Double check logic from backend)
    items_total = 0
    for item in order_data.items:
        qty = sum(item.quantity_matrix.values())
        items_total += qty * item.price_per_unit

    total_before_vat = items_total + order_data.shipping_cost + order_data.add_on_cost - order_data.discount_amount
    
    vat_amount = 0
    grand_total = 0
    
    if order_data.is_vat_included:
        grand_total = total_before_vat
        vat_amount = (total_before_vat * 7) / 107
    else:
        vat_amount = total_before_vat * 0.07
        grand_total = total_before_vat + vat_amount

    balance = grand_total - order_data.deposit_amount

    # 3. Create Order Header
    new_order = Order(
        order_no=f"PO-{uuid.uuid4().hex[:6].upper()}", # Auto-gen PO Number
        customer_id=customer.id,
        deadline_date=order_data.deadline_date,
        urgency_level=order_data.urgency_level,
        is_vat_included=order_data.is_vat_included,
        shipping_cost=order_data.shipping_cost,
        add_on_cost=order_data.add_on_cost,
        discount_amount=order_data.discount_amount,
        vat_amount=vat_amount,
        grand_total=grand_total,
        deposit_amount=order_data.deposit_amount,
        balance_amount=balance,
        status="production" # เริ่มต้นเข้าสู่กระบวนการผลิตทันที
    )
    db.add(new_order)
    db.flush() # Get Order ID

    # 4. Create Order Items
    for item in order_data.items:
        qty = sum(item.quantity_matrix.values())
        total_line = qty * item.price_per_unit
        
        new_item = OrderItem(
            order_id=new_order.id,
            product_name=item.product_name,
            fabric_type=item.fabric_type,
            neck_type=item.neck_type,
            sleeve_type=item.sleeve_type,
            quantity_matrix=item.quantity_matrix, # Save as JSONB
            total_qty=qty,
            price_per_unit=item.price_per_unit,
            total_price=total_line
        )
        db.add(new_item)

    db.commit()
    return {"message": "Order created successfully", "order_no": new_order.order_no}