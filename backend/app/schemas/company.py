from pydantic import BaseModel, ConfigDict
from typing import Optional


class CompanyBase(BaseModel):
    vat_rate: float = 0.07
    default_shipping_cost: float = 0.0


class CompanyUpdate(CompanyBase):
    pass


class CompanyConfig(CompanyBase):
    id: int

    model_config = ConfigDict(from_attributes=True)
