from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from typing import List, Any
import uuid
from decimal import Decimal
import json

from app.db.session import get_db
from app.models.order import Order as OrderModel, OrderItem as OrderItemModel
from app.models.customer import Customer
from app.models.user import User
from app.models.audit_log import AuditLog
from app.api import deps
from app.schemas.order import OrderCreate, Order as OrderSchema

router = APIRouter()


# --- 1. GET ALL ORDERS ---
@router.get("/", response_model=List[OrderSchema])
def read_orders(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    # Eager load customer and items to prevent N+1 queries
    orders = (
        db.query(OrderModel)
        .options(joinedload(OrderModel.customer), joinedload(OrderModel.items))
        .order_by(OrderModel.id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    results = []
    for o in orders:
        o_dict = o.__dict__.copy()

        # Populate customer details if missing in order snapshot but available in customer relation
        if o.customer:
            if not o_dict.get("customer_name"):
                o_dict["customer_name"] = o.customer.name
            if not o_dict.get("phone"):
                o_dict["phone"] = o.customer.phone
            if not o_dict.get("contact_channel"):
                o_dict["contact_channel"] = o.customer.channel
            if not o_dict.get("address"):
                o_dict["address"] = o.customer.address
        
        # Parse quantity_matrix from JSON string to dict for each item
        if o.items:
            items_list = []
            for item in o.items:
                item_dict = item.__dict__.copy()
                if item_dict.get('quantity_matrix'):
                    try:
                        item_dict['quantity_matrix'] = json.loads(item_dict['quantity_matrix'])
                    except (json.JSONDecodeError, TypeError):
                        item_dict['quantity_matrix'] = {}
                items_list.append(item_dict)
            o_dict['items'] = items_list

        results.append(o_dict)

    return results


# --- 2. CREATE ORDER ---
@router.post("/", status_code=status.HTTP_201_CREATED)
def create_order(
    order_in: OrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    import logging

    logger = logging.getLogger(__name__)
    logger.info(f"Received order creation request: {order_in.model_dump()}")

    # ✅ Robust Logic: Support both contact_channel and channel fields
    incoming_channel = getattr(order_in, "channel", None)
    final_channel = incoming_channel if incoming_channel else order_in.contact_channel

    # 1. Customer Handling (Sync Logic)
    # ✅ FIX: Strip whitespace to prevent duplicate customers (e.g. "John" vs "John ")
    clean_name = order_in.customer_name.strip() if order_in.customer_name else "Unknown"

    customer = db.query(Customer).filter(Customer.name == clean_name).first()

    if not customer:
        # Case: New Customer -> Create
        customer = Customer(
            name=clean_name,
            phone=order_in.phone.strip() if order_in.phone else None,
            channel=final_channel,
            address=order_in.address,
        )
        db.add(customer)
        db.flush()  # Flush to get customer.id
    else:
        # Case: Existing Customer -> UPDATE info if changed (The Fix)
        is_changed = False

        # 1. Check Phone
        new_phone = order_in.phone.strip() if order_in.phone else None
        if new_phone and customer.phone != new_phone:
            customer.phone = new_phone
            is_changed = True

        # 2. Check Channel
        if final_channel and customer.channel != final_channel:
            customer.channel = final_channel
            is_changed = True

        # 3. Check Address
        if order_in.address and customer.address != order_in.address:
            customer.address = order_in.address
            is_changed = True

        if is_changed:
            db.add(customer)
            db.flush()

    # 2. Calculation Logic
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

        order_items_data.append(
            {
                "data": item,
                "qty": qty,
                "total_price": line_price,
                "total_cost": line_cost,
            }
        )

    # Financials
    shipping = Decimal(str(order_in.shipping_cost))
    addon = Decimal(str(order_in.add_on_cost))

    discount_val = Decimal(str(order_in.discount_value))
    discount_amt = Decimal(str(order_in.discount_amount))

    dep1 = Decimal(str(order_in.deposit_1))
    dep2 = Decimal(str(order_in.deposit_2))
    total_deposit = dep1 + dep2

    total_before_vat = items_total_price + addon + shipping - discount_amt

    vat_amount = Decimal(0)
    grand_total = Decimal(0)

    if order_in.is_vat_included:
        grand_total = total_before_vat
        vat_amount = (total_before_vat * 7) / 107
    else:
        vat_amount = total_before_vat * Decimal("0.07")
        grand_total = total_before_vat + vat_amount

    revenue_ex_vat = grand_total - vat_amount
    estimated_profit = revenue_ex_vat - items_total_cost
    balance = grand_total - total_deposit

    # 3. Save Order Header
    new_order = OrderModel(
        order_no=f"PO-{uuid.uuid4().hex[:6].upper()}",
        brand=order_in.brand,
        customer_id=customer.id,
        # ✅ FIX: Save customer_name snapshot
        customer_name=clean_name,
        # Snapshot Data (Save current state to order)
        contact_channel=final_channel,
        address=order_in.address,
        phone=order_in.phone,
        deadline=order_in.deadline,
        usage_date=order_in.usage_date,
        urgency_level=order_in.urgency_level,
        status=order_in.status,
        is_vat_included=order_in.is_vat_included,
        shipping_cost=shipping,
        add_on_cost=addon,
        discount_type=order_in.discount_type,
        discount_value=discount_val,
        discount_amount=discount_amt,
        vat_amount=vat_amount,
        grand_total=grand_total,
        deposit_amount=total_deposit,
        deposit_1=dep1,
        deposit_2=dep2,
        balance_amount=balance,
        total_cost=items_total_cost,
        estimated_profit=estimated_profit,
        note=order_in.note,
        created_by_id=current_user.id if current_user else None,
    )
    db.add(new_order)
    db.flush()

    # 4. Save Order Items
    for item_data in order_items_data:
        src = item_data["data"]

        # Convert quantity_matrix dict to JSON string
        quantity_matrix_json = (
            json.dumps(src.quantity_matrix)
            if isinstance(src.quantity_matrix, dict)
            else src.quantity_matrix
        )

        new_item = OrderItemModel(
            order_id=new_order.id,
            product_name=src.product_name,
            fabric_type=src.fabric_type,
            neck_type=src.neck_type,
            sleeve_type=src.sleeve_type,
            quantity_matrix=quantity_matrix_json,
            total_qty=item_data["qty"],
            price_per_unit=src.base_price,
            total_price=item_data["total_price"],
            cost_per_unit=src.cost_per_unit,
            total_cost=item_data["total_cost"],
        )
        db.add(new_item)

    # Audit Log
    log = AuditLog(
        action="CREATE",
        target_type="order",
        target_id=str(new_order.id),
        details=f"Created order {new_order.order_no} by {current_user.username}",
        user_id=current_user.id if current_user else None,
    )
    db.add(log)

    db.commit()
    db.refresh(new_order)

    # Return response with mapped fields
    response_dict = new_order.__dict__.copy()
    if customer:
        if not response_dict.get("contact_channel"):
            response_dict["contact_channel"] = customer.channel
        if not response_dict.get("phone"):
            response_dict["phone"] = customer.phone
        if not response_dict.get("address"):
            response_dict["address"] = customer.address

    return response_dict


# --- 3. GET SINGLE ORDER ---
@router.get("/{order_id}", response_model=OrderSchema)
def read_order(order_id: int, db: Session = Depends(get_db)):
    order = db.query(OrderModel).filter(OrderModel.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    order_dict = order.__dict__.copy()
    if order.customer:
        order_dict["customer_name"] = order.customer.name
        # Fallback to customer info if order specific info is missing
        if not order_dict.get("phone"):
            order_dict["phone"] = order.customer.phone
        if not order_dict.get("contact_channel"):
            order_dict["contact_channel"] = order.customer.channel
        if not order_dict.get("address"):
            order_dict["address"] = order.customer.address

    return order_dict


# --- 4. UPDATE ORDER ---
@router.put("/{order_id}", response_model=OrderSchema)
def update_order(
    order_id: int,
    order_in: OrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    order = db.query(OrderModel).filter(OrderModel.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    incoming_channel = getattr(order_in, "channel", None)
    final_channel = incoming_channel if incoming_channel else order_in.contact_channel

    clean_name = order_in.customer_name.strip() if order_in.customer_name else "Unknown"

    # Update Customer Info (Sync Logic)
    customer = db.query(Customer).filter(Customer.name == clean_name).first()
    if not customer:
        customer = Customer(
            name=clean_name,
            phone=order_in.phone.strip() if order_in.phone else None,
            channel=final_channel,
            address=order_in.address,
        )
        db.add(customer)
        db.flush()
    else:
        is_changed = False

        new_phone = order_in.phone.strip() if order_in.phone else None
        if new_phone and customer.phone != new_phone:
            customer.phone = new_phone
            is_changed = True

        if final_channel and customer.channel != final_channel:
            customer.channel = final_channel
            is_changed = True

        if order_in.address and customer.address != order_in.address:
            customer.address = order_in.address
            is_changed = True

        if is_changed:
            db.add(customer)
            db.flush()

    # Recalculate Logic
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

        order_items_data.append(
            {
                "data": item,
                "qty": qty,
                "total_price": line_price,
                "total_cost": line_cost,
            }
        )

    # Financials
    shipping = Decimal(str(order_in.shipping_cost))
    addon = Decimal(str(order_in.add_on_cost))
    discount_val = Decimal(str(order_in.discount_value))
    discount_amt = Decimal(str(order_in.discount_amount))

    dep1 = Decimal(str(order_in.deposit_1))
    dep2 = Decimal(str(order_in.deposit_2))
    total_deposit = dep1 + dep2

    total_before_vat = items_total_price + addon + shipping - discount_amt

    vat_amount = Decimal(0)
    grand_total = Decimal(0)

    if order_in.is_vat_included:
        grand_total = total_before_vat
        vat_amount = (total_before_vat * 7) / 107
    else:
        vat_amount = total_before_vat * Decimal("0.07")
        grand_total = total_before_vat + vat_amount

    revenue_ex_vat = grand_total - vat_amount
    estimated_profit = revenue_ex_vat - items_total_cost
    balance = grand_total - total_deposit

    # Update Order Fields
    order.customer_id = customer.id
    order.customer_name = clean_name
    order.contact_channel = final_channel
    order.address = order_in.address
    order.phone = order_in.phone

    order.brand = order_in.brand
    order.deadline = order_in.deadline
    order.usage_date = order_in.usage_date
    order.urgency_level = order_in.urgency_level
    order.status = order_in.status

    order.is_vat_included = order_in.is_vat_included
    order.shipping_cost = shipping
    order.add_on_cost = addon

    order.discount_type = order_in.discount_type
    order.discount_value = discount_val
    order.discount_amount = discount_amt

    order.vat_amount = vat_amount
    order.grand_total = grand_total

    order.deposit_amount = total_deposit
    order.deposit_1 = dep1
    order.deposit_2 = dep2

    order.balance_amount = balance
    order.total_cost = items_total_cost
    order.estimated_profit = estimated_profit
    order.note = order_in.note

    # Update Items (Delete old, Add new)
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
            total_cost=item_data["total_cost"],
        )
        db.add(new_item)

    # Audit Log
    log = AuditLog(
        action="UPDATE",
        target_type="order",
        target_id=str(order.id),
        details=f"Updated order {order.order_no} (Status: {order.status}) by {current_user.username}",
        user_id=current_user.id if current_user else None,
    )
    db.add(log)

    db.commit()
    db.refresh(order)

    # Construct Response
    order_dict = order.__dict__.copy()
    if order.customer:
        order_dict["customer_name"] = order.customer.name
        if not order_dict.get("phone"):
            order_dict["phone"] = order.customer.phone
        if not order_dict.get("contact_channel"):
            order_dict["contact_channel"] = order.customer.channel
        if not order_dict.get("address"):
            order_dict["address"] = order.customer.address

    return order_dict


# --- 5. DELETE ORDER ---
@router.delete("/{order_id}", status_code=204)
def delete_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    order = db.query(OrderModel).filter(OrderModel.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Audit Log
    log = AuditLog(
        action="DELETE",
        target_type="order",
        target_id=str(order.id),
        details=f"Deleted order {order.order_no} by {current_user.username}",
        user_id=current_user.id if current_user else None,
    )
    db.add(log)

    db.delete(order)
    db.commit()
    return None


# --- 6. GET ORDER LOGS (NEW) ---
@router.get("/{order_id}/logs")
def get_order_logs(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    logs = (
        db.query(AuditLog)
        .filter(AuditLog.target_type == "order", AuditLog.target_id == str(order_id))
        .order_by(AuditLog.created_at.desc())
        .all()
    )

    return [
        {
            "id": log.id,
            "action": log.action,
            "details": log.details,
            "created_at": log.created_at,
            "user": log.user.username if log.user else "Unknown",
        }
        for log in logs
    ]
