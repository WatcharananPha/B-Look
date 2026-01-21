from pydantic import BaseModel
from typing import Optional

# Base Schema
class CompanyBase(BaseModel):
    vat_rate: float = 0.07
    default_shipping_cost: float = 0.0

# Schema สำหรับรับค่า Update (Put)
class CompanyUpdate(CompanyBase):
    pass

# Schema สำหรับแสดงผล (Response)
class CompanyConfig(CompanyBase):
    id: int

    class Config:
        from_attributes = True