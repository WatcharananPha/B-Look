from typing import List, Optional, Dict, Any
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from decimal import Decimal
from datetime import datetime


# Order Item Schema
class OrderItemBase(BaseModel):
    product_name: str
    fabric_type: Optional[str] = None
    neck_type: Optional[str] = None
    sleeve_type: Optional[str] = None
    quantity_matrix: Dict[str, int] = {}

    product_type: Optional[str] = "shirt"

    # Flags and add-ons per-item
    selected_add_ons: List[str] = []
    is_oversize: bool = False

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

    model_config = ConfigDict(from_attributes=True)


# Order Schema
class OrderBase(BaseModel):
    order_no: Optional[str] = None
    customer_id: Optional[int] = None
    customer_name: Optional[str] = None
    advance_hold: Decimal = Decimal("0")
    brand: Optional[str] = "BG"
    phone: Optional[str] = None
    customer_code: Optional[str] = None
    graphic_code: Optional[str] = None
    product_type: Optional[str] = "shirt"
    contact_channel: Optional[str] = None
    channel: Optional[str] = None
    address: Optional[str] = None
    deadline: Optional[datetime] = None
    usage_date: Optional[datetime] = None
    urgency_level: str = "normal"
    status: str = "WAITING_BOOKING"
    is_vat_included: bool = False
    shipping_cost: Decimal = Decimal("0")
    add_on_cost: Decimal = Decimal("0")
    sizing_surcharge: Decimal = Decimal("0")
    add_on_options_total: Decimal = Decimal("0")
    design_fee: Decimal = Decimal("0")
    discount_type: str = "THB"
    discount_value: Decimal = Decimal("0")
    discount_amount: Decimal = Decimal("0")
    deposit_amount: Decimal = Decimal("0")
    deposit_1: Decimal = Decimal("0")
    deposit_2: Decimal = Decimal("0")

    note: Optional[str] = None
    # Mockup image URLs (relative to /static)
    mockup_front_url: Optional[str] = None
    mockup_back_url: Optional[str] = None

    @model_validator(mode="before")
    def sync_channels_and_deposits(cls, values):
        if isinstance(values, dict):
            # Handle channel sync
            c_channel = values.get("contact_channel")
            channel = values.get("channel")
            if channel and not c_channel:
                values["contact_channel"] = channel
            elif c_channel and not channel:
                values["channel"] = c_channel

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
                if deposit is not None and deposit_amount_val == 0:
                    values["deposit_amount"] = deposit
                elif deposit_amount_val == 0 and (
                    deposit_1_val > 0 or deposit_2_val > 0
                ):
                    values["deposit_amount"] = deposit_1_val + deposit_2_val
            except (ValueError, TypeError) as e:
                pass
            # Normalize status values (coerce legacy 'draft' -> canonical WAITING_BOOKING)
            status_val = values.get("status")
            if isinstance(status_val, str):
                st = status_val.strip()
                if st.lower() in ("draft", "sp-draft", "sp_draft"):
                    values["status"] = "WAITING_BOOKING"
                else:
                    values["status"] = st.upper()
            elif not status_val:
                values["status"] = "WAITING_BOOKING"

            # Basic numeric sanity checks: ensure non-negative financial fields
            numeric_fields = [
                "shipping_cost",
                "add_on_cost",
                "sizing_surcharge",
                "design_fee",
                "discount_value",
                "discount_amount",
                "deposit_amount",
                "deposit_1",
                "deposit_2",
                "advance_hold",
            ]
            from decimal import Decimal as _D

            for nf in numeric_fields:
                try:
                    val = values.get(nf)
                    if val is None:
                        continue
                    vdec = _D(str(val))
                    if vdec < 0:
                        raise ValueError(f"{nf} must be non-negative")
                    # store normalized Decimal for downstream consistency
                    values[nf] = vdec
                except (TypeError, ValueError):
                    # Let pydantic type validators handle type errors; raise for negatives
                    if isinstance(val, (int, float)) and val < 0:
                        raise ValueError(f"{nf} must be non-negative")
                    pass

            # Phone sanity: strip and ensure reasonable length
            phone_val = values.get("phone")
            if phone_val:
                pstr = str(phone_val).strip()
                digits = "".join([c for c in pstr if c.isdigit()])
                if len(digits) < 6 or len(digits) > 20:
                    raise ValueError("phone number length invalid")
                values["phone"] = pstr
        return values


class OrderCreate(OrderBase):
    customer_name: Optional[str] = None
    items: List[OrderItemCreate] = []


class OrderUpdate(OrderBase):
    pass


class Order(OrderBase):
    id: int
    order_no: Optional[str] = None

    vat_amount: Decimal = Decimal("0")
    grand_total: Decimal = Decimal("0")
    deposit_amount: Decimal = Decimal("0")
    balance_amount: Decimal = Decimal("0")
    total_cost: Decimal = Decimal("0")
    estimated_profit: Decimal = Decimal("0")

    # Payment link & slip URLs — exposed to admin endpoints
    order_uuid: Optional[str] = None
    slip_booking_url: Optional[str] = None
    slip_deposit_url: Optional[str] = None
    slip_balance_url: Optional[str] = None

    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    items: List[OrderItem] = []

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
