from pydantic import BaseModel
from typing import Optional, List
from decimal import Decimal

# --- Company Info ---
class CompanyInfoBase(BaseModel):
    name_th: str
    name_en: Optional[str] = None
    address: Optional[str] = None
    tax_id: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    logo_url: Optional[str] = None

class CompanyInfoCreate(CompanyInfoBase):
    pass

class CompanyInfoResponse(CompanyInfoBase):
    id: int
    class Config:
        from_attributes = True

# --- Shipping Rate ---
class ShippingRateBase(BaseModel):
    provider_name: str
    min_weight_kg: Decimal
    max_weight_kg: Decimal
    base_price: Decimal
    is_active: bool = True

class ShippingRateCreate(ShippingRateBase):
    pass

class ShippingRateResponse(ShippingRateBase):
    id: int
    class Config:
        from_attributes = True