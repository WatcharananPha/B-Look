from sqlalchemy import Column, Integer, String, Boolean, DECIMAL
from app.db.base import Base

class FabricType(Base):
    __tablename__ = "fabric_types"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    price_adjustment = Column(DECIMAL(10, 2), default=0)
    is_active = Column(Boolean, default=True)

# (สร้าง NeckType, SleeveType ในลักษณะเดียวกันได้เลยครับ)