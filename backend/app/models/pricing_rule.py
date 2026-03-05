from sqlalchemy import Column, Integer, String, Float
from app.db.base_class import Base

class PricingRule(Base):
    __tablename__ = "pricing_rules"

    id = Column(Integer, primary_key=True, index=True)
    min_qty = Column(Integer, nullable=False)
    max_qty = Column(Integer, nullable=False)
    fabric_type = Column(String, nullable=False, index=True)
    unit_price = Column(Float, nullable=False)

class ShippingRate(Base):
    __tablename__ = "shipping_rates"

    id = Column(Integer, primary_key=True, index=True)
    provider_name = Column(String, nullable=False)
    min_weight_kg = Column(Float, default=0)
    max_weight_kg = Column(Float, default=0)
    base_price = Column(Float, default=0)
    is_active = Column(Integer, default=1)