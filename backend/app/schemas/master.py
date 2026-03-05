from pydantic import BaseModel
from typing import Optional, List
from decimal import Decimal

class MasterBase(BaseModel):
    name: str
    is_active: bool = True

    quantity: int = 0
    cost_price: Decimal = 0

class ProductTypeCreate(MasterBase):
    base_price: Decimal = 0
    base_cost: Decimal = 0


class ProductTypeResponse(ProductTypeCreate):
    id: int

    class Config:
        from_attributes = True

class FabricTypeCreate(MasterBase):
    price_adjustment: Decimal = 0
    cost_per_yard: Decimal = 0
    supplier_id: Optional[int] = None


class FabricTypeResponse(FabricTypeCreate):
    id: int
    supplier_name: Optional[str] = None 

    class Config:
        from_attributes = True

class NeckTypeCreate(MasterBase):
    price_adjustment: Decimal = 0
    additional_cost: Decimal = 0
    force_slope: bool = False


class NeckTypeResponse(NeckTypeCreate):
    id: int
    force_slope: bool = False

    class Config:
        from_attributes = True

class SleeveTypeCreate(MasterBase):
    price_adjustment: Decimal = 0
    additional_cost: Decimal = 0


class SleeveTypeResponse(SleeveTypeCreate):
    id: int

    class Config:
        from_attributes = True

class AddOnCreate(MasterBase):
    price_per_unit: Decimal = 0
    cost_per_unit: Decimal = 0

class AddOnResponse(AddOnCreate):
    id: int

    class Config:
        from_attributes = True

class SupplierCreate(BaseModel):
    name: str
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    line_id: Optional[str] = None
    address: Optional[str] = None
    tax_id: Optional[str] = None
    is_active: bool = True

class SupplierResponse(SupplierCreate):
    id: int

    class Config:
        from_attributes = True
