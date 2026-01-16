from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from typing import List, Any
import uuid
from decimal import Decimal

from app.db.session import get_db
from app.models.order import Order as OrderModel, OrderItem as OrderItemModel
from app.models.customer import Customer
from app.schemas.order import OrderCreate, Order as OrderSchema

router = APIRouter()

# --- 1. GET ALL ORDERS ---
@router.get("/", response_model=List[OrderSchema])
def read_orders(
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db)
):
    """
    ดึงรายการออเดอร์ทั้งหมด พร้อมข้อมูลลูกค้าและสินค้า
    """
    orders = db.query(OrderModel)\
        .options(joinedload(OrderModel.customer), joinedload(OrderModel.items))\
        .order_by(OrderModel.id.desc())\
        .offset(skip)\
        .limit(limit)\
        .all()
    
    results = []
    for o in orders:
        # แปลง SQLAlchemy Model เป็น Dictionary เพื่อ Map ข้อมูล
        o_dict = o.__dict__.copy()
        if o.customer:
            o_dict['customer_name'] = o.customer.name
            o_dict['phone'] = o.customer.phone
            o_dict['contact_channel'] = o.customer.channel
        
        # Map fields manual
        o_dict['deposit'] = o.deposit_amount
        o_dict['deadline'] = o.deadline
        
        results.append(o_dict)

    return results

# --- 2. CREATE ORDER ---
@router.post("/", status_code=status.HTTP_201_CREATED)
def create_order(order_in: OrderCreate, db: Session = Depends(get_db)):
    """
    สร้างออเดอร์ใหม่ + คำนวณราคา/กำไรอัตโนมัติ
    """
    # 1. จัดการลูกค้า (Customer Handling)
    customer = db.query(Customer).filter(Customer.name == order_in.customer_name).first()
    if not customer:
        customer = Customer(
            name=order_in.customer_name,
            phone=order_in.phone,
            channel=order_in.contact_channel,
            address=order_in.address
        )
        db.add(customer)
        db.flush()

    # 2. คำนวณยอดเงินและต้นทุน (Calculation Logic)
    items_total_price = Decimal(0)
    items_total_cost = Decimal(0)
    order_items_data = []

    for item in order_in.items:
        qty = sum(item.quantity_matrix.values()) if item.quantity_matrix else 0
        base_price = Decimal(str(item.base_price))
        cost_per_unit = Decimal(str(item.cost_per_unit))
        
        line_price = base_price * qty
        line_cost = cost_per_unit * qty
        
        items_total_price += line_price
        items_total_cost += line_cost
        
        order_items_data.append({
            "data": item,
            "qty": qty,
            "total_price": line_price,
            "total_cost": line_cost
        })

    # Financials
    shipping = Decimal(str(order_in.shipping_cost))
    addon = Decimal(str(order_in.add_on_cost))
    discount = Decimal(str(order_in.discount_amount))
    deposit = Decimal(str(order_in.deposit_amount))

    total_before_vat = items_total_price + addon + shipping - discount
    
    vat_amount = Decimal(0)
    grand_total = Decimal(0)
    
    if order_in.is_vat_included:
        grand_total = total_before_vat
        # ถอด VAT: Price / 1.07 * 0.07
        vat_amount = (total_before_vat * 7) / 107
    else:
        vat_amount = total_before_vat * Decimal('0.07')
        grand_total = total_before_vat + vat_amount

    revenue_ex_vat = grand_total - vat_amount
    estimated_profit = revenue_ex_vat - items_total_cost
    balance = grand_total - deposit

    # 3. บันทึก Order Header
    new_order = OrderModel(
        order_no=f"PO-{uuid.uuid4().hex[:6].upper()}",
        customer_id=customer.id,
        deadline=order_in.deadline,
        urgency_level=order_in.urgency_level,
        status="production",
        
        is_vat_included=order_in.is_vat_included,
        shipping_cost=shipping,
        add_on_cost=addon,
        discount_amount=discount,
        vat_amount=vat_amount,
        grand_total=grand_total,
        deposit_amount=deposit,
        balance_amount=balance,
        
        total_cost=items_total_cost,
        estimated_profit=estimated_profit,
    )
    db.add(new_order)
    db.flush()

    # 4. บันทึก Order Items
    for item_data in order_items_data:
        src = item_data["data"]
        new_item = OrderItemModel(
            order_id=new_order.id,
            product_name=src.product_name,
            fabric_type=src.fabric_type,
            neck_type=src.neck_type,
            sleeve_type=src.sleeve_type,
            quantity_matrix=src.quantity_matrix,
            
            total_qty=item_data["qty"],
            price_per_unit=src.base_price,
            total_price=item_data["total_price"],
            
            cost_per_unit=src.cost_per_unit,
            total_cost=item_data["total_cost"]
        )
        db.add(new_item)
    
    db.commit()
    db.refresh(new_order)
    
    return {
        "message": "Order created successfully",
        "order_no": new_order.order_no,
        "id": new_order.id
    }

# --- 3. GET SINGLE ORDER ---
@router.get("/{order_id}", response_model=OrderSchema)
def read_order(order_id: int, db: Session = Depends(get_db)):
    order = db.query(OrderModel).filter(OrderModel.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    order_dict = order.__dict__.copy()
    if order.customer:
        order_dict['customer_name'] = order.customer.name
        order_dict['phone'] = order.customer.phone
        order_dict['contact_channel'] = order.customer.channel
        
    return order_dict

# --- 4. UPDATE ORDER (ส่วนที่เพิ่มใหม่เพื่อแก้ 405) ---
@router.put("/{order_id}", response_model=OrderSchema)
def update_order(order_id: int, order_in: OrderCreate, db: Session = Depends(get_db)):
    """
    แก้ไขออเดอร์: คำนวณยอดใหม่ และ Replace Items ทั้งหมด
    """
    # 1. หา Order เดิม
    order = db.query(OrderModel).filter(OrderModel.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # 2. จัดการลูกค้า (Find or Create)
    customer = db.query(Customer).filter(Customer.name == order_in.customer_name).first()
    if not customer:
        customer = Customer(
            name=order_in.customer_name,
            phone=order_in.phone,
            channel=order_in.contact_channel,
            address=order_in.address
        )
        db.add(customer)
        db.flush()

    # 3. คำนวณยอดเงินและต้นทุนใหม่ (Re-calculate Logic)
    items_total_price = Decimal(0)
    items_total_cost = Decimal(0)
    order_items_data = []

    for item in order_in.items:
        qty = sum(item.quantity_matrix.values()) if item.quantity_matrix else 0
        base_price = Decimal(str(item.base_price))
        cost_per_unit = Decimal(str(item.cost_per_unit))
        
        line_price = base_price * qty
        line_cost = cost_per_unit * qty
        
        items_total_price += line_price
        items_total_cost += line_cost
        
        order_items_data.append({
            "data": item,
            "qty": qty,
            "total_price": line_price,
            "total_cost": line_cost
        })

    # Financials Calculation
    shipping = Decimal(str(order_in.shipping_cost))
    addon = Decimal(str(order_in.add_on_cost))
    discount = Decimal(str(order_in.discount_amount))
    deposit = Decimal(str(order_in.deposit_amount))

    total_before_vat = items_total_price + addon + shipping - discount
    
    vat_amount = Decimal(0)
    grand_total = Decimal(0)
    
    if order_in.is_vat_included:
        grand_total = total_before_vat
        vat_amount = (total_before_vat * 7) / 107
    else:
        vat_amount = total_before_vat * Decimal('0.07')
        grand_total = total_before_vat + vat_amount

    revenue_ex_vat = grand_total - vat_amount
    estimated_profit = revenue_ex_vat - items_total_cost
    balance = grand_total - deposit

    # 4. อัปเดตข้อมูล Header (Update Order Object)
    order.customer_id = customer.id
    order.deadline = order_in.deadline
    order.urgency_level = order_in.urgency_level
    order.is_vat_included = order_in.is_vat_included
    order.shipping_cost = shipping
    order.add_on_cost = addon
    order.discount_amount = discount
    order.vat_amount = vat_amount
    order.grand_total = grand_total
    order.deposit_amount = deposit
    order.balance_amount = balance
    order.total_cost = items_total_cost
    order.estimated_profit = estimated_profit

    # 5. อัปเดต Items (ลบของเก่าทั้งหมดแล้วสร้างใหม่)
    db.query(OrderItemModel).filter(OrderItemModel.order_id == order.id).delete()
    
    for item_data in order_items_data:
        src = item_data["data"]
        new_item = OrderItemModel(
            order_id=order.id,
            product_name=src.product_name,
            fabric_type=src.fabric_type,
            neck_type=src.neck_type,
            sleeve_type=src.sleeve_type,
            quantity_matrix=src.quantity_matrix,
            total_qty=item_data["qty"],
            price_per_unit=src.base_price,
            total_price=item_data["total_price"],
            cost_per_unit=src.cost_per_unit,
            total_cost=item_data["total_cost"]
        )
        db.add(new_item)

    db.commit()
    db.refresh(order)

    # Map Response Manually
    order_dict = order.__dict__.copy()
    if order.customer:
        order_dict['customer_name'] = order.customer.name
        order_dict['phone'] = order.customer.phone
        order_dict['contact_channel'] = order.customer.channel
        
    return order_dict

# --- 5. DELETE ORDER ---
@router.delete("/{order_id}", status_code=204)
def delete_order(order_id: int, db: Session = Depends(get_db)):
    order = db.query(OrderModel).filter(OrderModel.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    db.delete(order)
    db.commit()
    return None