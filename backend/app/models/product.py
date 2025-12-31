from sqlalchemy import Column, Integer, String, DECIMAL, Boolean, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.db.base_class import Base

# 1. ประเภทสินค้าหลัก (เช่น เสื้อโปโล, เสื้อยืด)
class ProductType(Base):
    __tablename__ = "product_types"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False) # Polo, T-Shirt
    base_price = Column(DECIMAL(10, 2), default=0) # ราคาตั้งต้น
    base_cost = Column(DECIMAL(10, 2), default=0)  # ต้นทุนตั้งต้น (ค่าตัดเย็บพื้นฐาน)
    is_active = Column(Boolean, default=True)

# 2. ประเภทผ้า (Update จากของเดิม เพิ่ม cost_per_yard)
class FabricType(Base):
    __tablename__ = "fabric_types"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False) # จุติ, ไมโคร
    
    # Pricing & Cost
    price_adjustment = Column(DECIMAL(10, 2), default=0) # บวกราคาเพิ่มจากฐาน
    cost_per_yard = Column(DECIMAL(10, 2), default=0)    # ต้นทุนผ้าต่อหลา
    
    # Supplier Link
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=True)
    
    is_active = Column(Boolean, default=True)
    supplier = relationship("Supplier", back_populates="fabrics")

# 3. ประเภทคอ (Round, V-Neck, Collar)
class NeckType(Base):
    __tablename__ = "neck_types"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    price_adjustment = Column(DECIMAL(10, 2), default=0)
    additional_cost = Column(DECIMAL(10, 2), default=0) # ต้นทุนเพิ่ม (เช่น ค่าปก)
    is_active = Column(Boolean, default=True)

# 4. ประเภทแขน (Short, Long)
class SleeveType(Base):
    __tablename__ = "sleeve_types"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    price_adjustment = Column(DECIMAL(10, 2), default=0)
    additional_cost = Column(DECIMAL(10, 2), default=0) # ต้นทุนเพิ่ม (เช่น แขนยาวใช้ผ้าเยอะขึ้น)
    is_active = Column(Boolean, default=True)

# 5. Add-on Options (เช่น ปักอก, สกรีนหลัง, กระเป๋า)
class AddOnOption(Base):
    __tablename__ = "addon_options"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    price_per_unit = Column(DECIMAL(10, 2), default=0)
    cost_per_unit = Column(DECIMAL(10, 2), default=0)
    is_active = Column(Boolean, default=True)