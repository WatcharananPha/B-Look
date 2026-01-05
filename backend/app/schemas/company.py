from pydantic import BaseModel
from typing import Optional

class CompanyInfoBase(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    tax_id: Optional[str] = None
    phone: Optional[str] = None
    vat_rate: float = 0.07
    default_shipping_cost: float = 0.0

class CompanyInfoUpdate(CompanyInfoBase):
    pass

class CompanyInfoOut(CompanyInfoBase):
    id: int
    class Config:
        from_attributes = True