from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
from decimal import Decimal

# Shared properties
class OrderBase(BaseModel):
    order_no: str
    status: str = "draft"
    total_amount: Decimal = 0
    deposit: Decimal = 0
    deadline: Optional[datetime] = None
    contact_channel: Optional[str] = None

# Properties to receive via API on creation
class OrderCreate(OrderBase):
    customer_name: str  # Frontend ส่งชื่อลูกค้ามา
    items: List[dict] = [] # รับเป็น list ว่างๆ ไปก่อนในเฟสนี้

# Properties to return to client
class OrderResponse(OrderBase):
    id: int
    customer_name: Optional[str] = None # ส่งชื่อลูกค้ากลับไปแสดงผล
    grand_total: Optional[Decimal] = None # Alias for total_amount handling

    class Config:
        from_attributes = True
        
    # Helper to map database model to schema if needed
    @staticmethod
    def from_orm(obj):
        model = OrderResponse.model_validate(obj)
        if obj.customer:
            model.customer_name = obj.customer.name
        model.grand_total = obj.total_amount
        return model