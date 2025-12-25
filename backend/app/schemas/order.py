from pydantic import BaseModel
from typing import Dict, List, Optional
from datetime import date

class OrderItemCreate(BaseModel):
    quantity_matrix: Dict[str, int]  # {"S": 10, "M": 5}
    base_price: float

class OrderCreate(BaseModel):
    customer_name: str
    deadline_date: date
    is_vat_included: bool = False
    deposit_amount: float = 0
    items: List[OrderItemCreate]