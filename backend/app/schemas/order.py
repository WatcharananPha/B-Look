from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, field_validator, model_validator
from decimal import Decimal
from datetime import datetime


# --- Order Item Schema ---
class OrderItemBase(BaseModel):
    product_name: str
    fabric_type: Optional[str] = None
    neck_type: Optional[str] = None
    sleeve_type: Optional[str] = None
    quantity_matrix: Dict[str, int] = {}

    base_price: float = 0
    price_per_unit: float = 0
    cost_per_unit: float = 0
    total_price: float = 0
    total_cost: float = 0
    total_qty: int = 0


class OrderItemCreate(OrderItemBase):
    pass


class OrderItem(OrderItemBase):
    id: int
    order_id: int

    class Config:
        from_attributes = True


# --- Order Schema ---
class OrderBase(BaseModel):
    customer_id: Optional[int] = None
    customer_name: Optional[str] = "Unknown"
    brand: Optional[str] = "BG"
    phone: Optional[str] = None

    # ✅ FIX 1: รับค่าตรงๆ ไม่ต้องมี alias
    contact_channel: Optional[str] = None
    channel: Optional[str] = None  # เผื่อไว้รับค่าเก่า

    address: Optional[str] = None
    deadline: Optional[datetime] = None
    usage_date: Optional[datetime] = None
    urgency_level: str = "normal"
    status: str = "draft"

    is_vat_included: bool = False
    shipping_cost: Decimal = 0
    add_on_cost: Decimal = 0

    discount_type: str = "THB"
    discount_value: Decimal = 0
    discount_amount: Decimal = 0

    deposit_amount: Decimal = 0
    deposit_1: Decimal = 0
    deposit_2: Decimal = 0

    note: Optional[str] = None

    # Validator รวมร่าง (ไม่ว่าจะส่งชื่อไหนมา ให้รวมไปที่ contact_channel)
    @model_validator(mode="before")
    def sync_channels_and_deposits(cls, values):
        # กรณีรับเป็น dict (ตอนรับ Request)
        if isinstance(values, dict):
            # Handle channel sync
            c_channel = values.get("contact_channel")
            channel = values.get("channel")

            # ถ้ามี channel แต่ไม่มี contact_channel -> ย้ายค่ามา
            if channel and not c_channel:
                values["contact_channel"] = channel
            # ถ้ามี contact_channel แต่ไม่มี channel -> copy ไปเผื่อ
            elif c_channel and not channel:
                values["channel"] = c_channel

            # Handle deposit sync (support both "deposit" and "deposit_amount")
            deposit = values.get("deposit")
            deposit_amount = values.get("deposit_amount", 0)
            deposit_1 = values.get("deposit_1", 0)
            deposit_2 = values.get("deposit_2", 0)

            # Convert to Decimal for comparison
            try:
                deposit_amount_val = (
                    Decimal(str(deposit_amount)) if deposit_amount else Decimal(0)
                )
                deposit_1_val = Decimal(str(deposit_1)) if deposit_1 else Decimal(0)
                deposit_2_val = Decimal(str(deposit_2)) if deposit_2 else Decimal(0)

                # If "deposit" is provided but not "deposit_amount", use it
                if deposit is not None and deposit_amount_val == 0:
                    values["deposit_amount"] = deposit
                # If deposit_amount is 0 but we have deposit_1 or deposit_2, calculate it
                elif deposit_amount_val == 0 and (
                    deposit_1_val > 0 or deposit_2_val > 0
                ):
                    values["deposit_amount"] = deposit_1_val + deposit_2_val
            except (ValueError, TypeError) as e:
                # If conversion fails, just use the values as-is
                pass

        return values


class OrderCreate(OrderBase):
    customer_name: str
    items: List[OrderItemCreate] = []


class OrderUpdate(OrderBase):
    pass


class Order(OrderBase):
    id: int
    order_no: str

    vat_amount: Decimal = 0
    grand_total: Decimal = 0
    deposit_amount: Decimal = 0
    balance_amount: Decimal = 0
    total_cost: Decimal = 0
    estimated_profit: Decimal = 0

    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    items: List[OrderItem] = []

    class Config:
        from_attributes = True
        populate_by_name = True
