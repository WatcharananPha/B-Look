from sqlalchemy import Column, Integer, String, DECIMAL, Boolean
from app.db.base_class import Base

class PriceTier(Base):
    __tablename__ = "price_tiers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String) # เช่น Standard, Bulk, VIP
    
    min_qty = Column(Integer, nullable=False) # จำนวนขั้นต่ำ (เช่น 1)
    max_qty = Column(Integer, nullable=False) # จำนวนสูงสุด (เช่น 50)
    
    # Logic: จะลดเป็น % หรือ ลดเป็นบาท
    discount_percent = Column(DECIMAL(5, 2), default=0) 
    discount_amount = Column(DECIMAL(10, 2), default=0)
    
    is_active = Column(Boolean, default=True)

class ShippingRate(Base):
    __tablename__ = "shipping_rates"

    id = Column(Integer, primary_key=True, index=True)
    provider_name = Column(String, nullable=False) # Kerry, Flash, ไปรษณีย์ไทย
    
    min_weight_kg = Column(DECIMAL(10, 2), default=0)
    max_weight_kg = Column(DECIMAL(10, 2), default=0)
    base_price = Column(DECIMAL(10, 2), default=0)
    
    is_active = Column(Boolean, default=True)