#
from pydantic import BaseModel
from typing import Dict, List, Optional
from datetime import date

class OrderItemCreate(BaseModel):
    product_name: str
    fabric_type: str
    neck_type: str
    sleeve_type: str
    quantity_matrix: Dict[str, int]
    base_price: float
    cost_per_unit: float = 0  # <--- เพิ่มบรรทัดนี้ (รับค่าต้นทุน)

class OrderCreate(BaseModel):
    customer_name: str
    phone: Optional[str] = None
    channel: str = "LINE OA"
    address: Optional[str] = None
    deadline_date: date
    urgency_level: str = "normal"
    
    items: List[OrderItemCreate]
    
    is_vat_included: bool = False
    shipping_cost: float = 0
    add_on_cost: float = 0
    discount_amount: float = 0
    deposit_amount: float = 0