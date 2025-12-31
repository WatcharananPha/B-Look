#
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.order import Order, OrderItem
from app.models.customer import Customer
from app.schemas.order import OrderCreate
import uuid
from decimal import Decimal

router = APIRouter()

@router.post("/", status_code=201)
def create_order(order_in: OrderCreate, db: Session = Depends(get_db)):
    # 1. จัดการลูกค้า (Customer)
    customer = db.query(Customer).filter(Customer.name == order_in.customer_name).first()
    if not customer:
        customer = Customer(
            name=order_in.customer_name,
            phone=order_in.phone,
            channel=order_in.channel,
            address=order_in.address
        )
        db.add(customer)
        db.flush()

    # 2. คำนวณยอดเงินและต้นทุน (Calculation Logic)
    items_total_price = 0
    items_total_cost = 0 # ตัวแปรเก็บต้นทุนรวม
    
    for item in order_in.items:
        qty = sum(item.quantity_matrix.values())
        items_total_price += qty * item.base_price
        items_total_cost += qty * item.cost_per_unit # รวมต้นทุนจากสินค้าทุกรายการ

    # คำนวณ Grand Total
    total_before_vat = items_total_price + order_in.add_on_cost + order_in.shipping_cost - order_in.discount_amount
    
    vat_amount = 0
    grand_total = 0
    
    if order_in.is_vat_included:
        grand_total = total_before_vat
        vat_amount = (total_before_vat * 7) / 107
    else:
        vat_amount = total_before_vat * 0.07
        grand_total = total_before_vat + vat_amount

    # --- ส่วนคำนวณกำไร (Profit Calculation) ---
    # รายรับสุทธิ (ไม่รวม VAT)
    revenue_ex_vat = grand_total - vat_amount
    # กำไร = รายรับสุทธิ - ต้นทุนรวมสินค้า
    estimated_profit = revenue_ex_vat - items_total_cost
    # ----------------------------------------

    balance = grand_total - order_in.deposit_amount

    # 3. บันทึก Order Header
    new_order = Order(
        order_no=f"PO-{uuid.uuid4().hex[:6].upper()}",
        customer_id=customer.id,
        deadline_date=order_in.deadline_date,
        urgency_level=order_in.urgency_level,
        
        is_vat_included=order_in.is_vat_included,
        shipping_cost=order_in.shipping_cost,
        add_on_cost=order_in.add_on_cost,
        discount_amount=order_in.discount_amount,
        vat_amount=vat_amount,
        grand_total=grand_total,
        deposit_amount=order_in.deposit_amount,
        balance_amount=balance,
        
        # บันทึกต้นทุนและกำไรลง DB
        total_cost=items_total_cost,
        estimated_profit=estimated_profit,
        
        status="production"
    )
    db.add(new_order)
    db.flush()

    # 4. บันทึก Order Items
    for item in order_in.items:
        qty = sum(item.quantity_matrix.values())
        total_line_price = qty * item.base_price
        total_line_cost = qty * item.cost_per_unit
        
        new_item = OrderItem(
            order_id=new_order.id,
            product_name=item.product_name,
            fabric_type=item.fabric_type,
            neck_type=item.neck_type,
            sleeve_type=item.sleeve_type,
            quantity_matrix=item.quantity_matrix,
            
            total_qty=qty,
            price_per_unit=item.base_price,
            total_price=total_line_price,
            
            # บันทึกต้นทุนรายรายการ
            cost_per_unit=item.cost_per_unit,
            total_cost=total_line_cost
        )
        db.add(new_item)
    
    db.commit()
    return {
        "order_no": new_order.order_no, 
        "total": new_order.grand_total,
        "profit": new_order.estimated_profit # ส่งค่ากำไรกลับไปให้ Frontend แสดงผล
    }