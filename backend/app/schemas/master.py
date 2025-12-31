from pydantic import BaseModel
from typing import Optional, List
from decimal import Decimal

# --- Base Schema (Shared) ---
class MasterBase(BaseModel):
    name: str
    is_active: bool = True

# --- Product Type (ทรงเสื้อ) ---
class ProductTypeCreate(MasterBase):
    base_price: Decimal = 0
    base_cost: Decimal = 0

class ProductTypeResponse(ProductTypeCreate):
    id: int
    class Config:
        from_attributes = True

# --- Fabric Type (ชนิดผ้า) ---
class FabricTypeCreate(MasterBase):
    price_adjustment: Decimal = 0
    cost_per_yard: Decimal = 0
    supplier_id: Optional[int] = None

class FabricTypeResponse(FabricTypeCreate):
    id: int
    supplier_name: Optional[str] = None # Helper field
    class Config:
        from_attributes = True

# --- Neck Type (คอปก) ---
class NeckTypeCreate(MasterBase):
    price_adjustment: Decimal = 0
    additional_cost: Decimal = 0

class NeckTypeResponse(NeckTypeCreate):
    id: int
    class Config:
        from_attributes = True

# --- Sleeve Type (แขน) ---
class SleeveTypeCreate(MasterBase):
    price_adjustment: Decimal = 0
    additional_cost: Decimal = 0

class SleeveTypeResponse(SleeveTypeCreate):
    id: int
    class Config:
        from_attributes = True

# --- AddOn (Option เสริม) ---
class AddOnCreate(MasterBase):
    price_per_unit: Decimal = 0
    cost_per_unit: Decimal = 0

class AddOnResponse(AddOnCreate):
    id: int
    class Config:
        from_attributes = True

# --- Supplier ---
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