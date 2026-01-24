from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from decimal import Decimal
from datetime import datetime

# --- Order Item Schema ---
class OrderItemBase(BaseModel):
    product_name: str
    fabric_type: Optional[str] = None
    neck_type: Optional[str] = None
    sleeve_type: Optional[str] = None
    base_price: Decimal = 0
    cost_per_unit: Decimal = 0
    quantity_matrix: Dict[str, int] = {} 

class OrderItemCreate(OrderItemBase):
    pass

class OrderItem(OrderItemBase):
    id: int
    order_id: int
    total_qty: int = 0
    total_price: Decimal = 0
    total_cost: Decimal = 0

    class Config:
        from_attributes = True

# --- Order Schema ---
class OrderBase(BaseModel):
    customer_name: Optional[str] = "Unknown" 
    
    brand: Optional[str] = None
    
    contact_channel: Optional[str] = None 
    address: Optional[str] = None
    phone: Optional[str] = None

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
    
    deposit_1: Decimal = 0
    deposit_2: Decimal = 0
    
    note: Optional[str] = None

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
    
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    items: List[OrderItem] = []

    class Config:
        from_attributes = True