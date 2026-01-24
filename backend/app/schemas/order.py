from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime
from decimal import Decimal

# --- Order Item Schema ---
class OrderItemBase(BaseModel):
    product_name: str
    fabric_type: Optional[str] = None
    neck_type: Optional[str] = None
    sleeve_type: Optional[str] = None
    quantity_matrix: Dict[str, int] = {}
    
    # Prices & Costs
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
    brand: Optional[str] = None
    phone: Optional[str] = None
    
    contact_channel: Optional[str] = None 
    
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

class OrderCreate(OrderBase):
    items: List[OrderItemCreate] = []

class OrderUpdate(OrderBase):
    pass

class Order(OrderBase):
    id: int
    order_no: str
    
    grand_total: Decimal = 0
    vat_amount: Decimal = 0
    balance_amount: Decimal = 0
    
    total_cost: Decimal = 0
    estimated_profit: Decimal = 0
    
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    items: List[OrderItem] = []

    class Config:
        from_attributes = True
        populate_by_name = True