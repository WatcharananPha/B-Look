from sqlalchemy import Column, Integer, Float, DateTime
from sqlalchemy.sql import func
from app.db.base_class import Base

class Company(Base):
    __tablename__ = "company_configs"

    id = Column(Integer, primary_key=True, index=True)
    vat_rate = Column(Float, default=0.07)
    default_shipping_cost = Column(Float, default=0.0)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())