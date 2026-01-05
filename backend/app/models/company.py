from sqlalchemy import Column, Integer, String, Float, Text
from app.db.base_class import Base

class CompanyInfo(Base):
    __tablename__ = "company_info"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, default="B-Look Garment")
    address = Column(Text, nullable=True)
    tax_id = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    
    # Global Config Fields
    vat_rate = Column(Float, default=0.07) # เก็บเป็นทศนิยม เช่น 0.07
    default_shipping_cost = Column(Float, default=0.0)