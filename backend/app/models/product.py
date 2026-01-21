from sqlalchemy import Column, Integer, String, DECIMAL, Boolean, ForeignKey
from sqlalchemy.orm import relationship
# ต้องใช้ Base จากไฟล์เดียวกับที่ User/Order ใช้
from app.db.base_class import Base 

class FabricType(Base):
    __tablename__ = "fabric_types"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    price_adjustment = Column(DECIMAL(10, 2), default=0)
    
    # --- ต้องมี 2 บรรทัดนี้ ---
    quantity = Column(Integer, default=0)
    cost_price = Column(DECIMAL(10, 2), default=0)
    # -----------------------

    cost_per_yard = Column(DECIMAL(10, 2), default=0) 
    is_active = Column(Boolean, default=True)
    
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=True)
    supplier = relationship("Supplier", back_populates="fabrics")

# (คลาส NeckType และ SleeveType ก็ต้องเพิ่มเหมือนกันตามที่เคยให้โค้ดไป)
class NeckType(Base):
    __tablename__ = "neck_types"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    price_adjustment = Column(DECIMAL(10, 2), default=0)
    
    quantity = Column(Integer, default=0)       # <--- ต้องมี
    cost_price = Column(DECIMAL(10, 2), default=0) # <--- ต้องมี
    
    additional_cost = Column(DECIMAL(10, 2), default=0)
    is_active = Column(Boolean, default=True)

class SleeveType(Base):
    __tablename__ = "sleeve_types"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    price_adjustment = Column(DECIMAL(10, 2), default=0)
    
    quantity = Column(Integer, default=0)       # <--- ต้องมี
    cost_price = Column(DECIMAL(10, 2), default=0) # <--- ต้องมี
    
    additional_cost = Column(DECIMAL(10, 2), default=0)
    is_active = Column(Boolean, default=True)