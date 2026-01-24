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
    customer_name: Optional[str] = "Unknown"
    brand: Optional[str] = "BG"
    phone: Optional[str] = None
    
    # ✅ FIX 1: รับค่าตรงๆ ไม่ต้องมี alias
    contact_channel: Optional[str] = None
    channel: Optional[str] = None # เผื่อไว้รับค่าเก่า
    
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
    
    deposit_amount: Decimal = Field(0, alias="deposit") 
    deposit_1: Decimal = 0
    deposit_2: Decimal = 0
    
    note: Optional[str] = None

    # ✅ FIX 2: Validator รวมร่าง (ไม่ว่าจะส่งชื่อไหนมา ให้รวมไปที่ contact_channel)
    @model_validator(mode='before')
    def sync_channels(cls, values):
        # กรณีรับเป็น dict (ตอนรับ Request)
        if isinstance(values, dict):
            c_channel = values.get('contact_channel')
            channel = values.get('channel')
            
            # ถ้ามี channel แต่ไม่มี contact_channel -> ย้ายค่ามา
            if channel and not c_channel:
                values['contact_channel'] = channel
            # ถ้ามี contact_channel แต่ไม่มี channel -> copy ไปเผื่อ
            elif c_channel and not channel:
                values['channel'] = c_channel
                
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