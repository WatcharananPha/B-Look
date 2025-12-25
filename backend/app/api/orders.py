from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.order import Order, OrderItem
from app.schemas.order import OrderCreate
from app.services.pricing import PricingService
import uuid

router = APIRouter()

@router.post("/", status_code=201)
def create_order(order_in: OrderCreate, db: Session = Depends(get_db)):
    # 1. Calculate Price Logic
    pricing_result = PricingService.calculate_order_total(
        order_in.items, order_in.is_vat_included
    )
    
    # 2. Create Order Header
    new_order = Order(
        order_no=f"PO-{uuid.uuid4().hex[:6].upper()}", # Auto Gen
        customer_name=order_in.customer_name,
        deadline_date=order_in.deadline_date,
        grand_total=pricing_result["grand_total"],
        is_vat_included=order_in.is_vat_included,
        deposit_amount=order_in.deposit_amount
    )
    db.add(new_order)
    db.commit()
    db.refresh(new_order)
    
    # 3. Create Order Items (Support JSONB)
    for item_in in order_in.items:
        qty = sum(item_in.quantity_matrix.values())
        new_item = OrderItem(
            order_id=new_order.id,
            quantity_matrix=item_in.quantity_matrix, # Save Dict to JSONB directly
            total_qty=qty,
            selling_price_per_unit=item_in.base_price
        )
        db.add(new_item)
    
    db.commit()
    return {"order_no": new_order.order_no, "total": new_order.grand_total}