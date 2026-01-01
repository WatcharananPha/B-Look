from sqlalchemy import Column, Integer, String, DECIMAL, Boolean, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.db.base_class import Base

# 1. Product Type (ประเภทสินค้าหลัก เช่น เสื้อโปโล, เสื้อยืด)
class ProductType(Base):
    __tablename__ = "product_types"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False) # Polo, T-Shirt
    base_price = Column(DECIMAL(10, 2), default=0) # ราคาตั้งต้น (ก่อนบวก Option)
    base_cost = Column(DECIMAL(10, 2), default=0)  # ต้นทุนตั้งต้น (ค่าแรงตัดเย็บพื้นฐาน)
    
    # [NEW] น้ำหนักเฉลี่ยต่อตัว (กรัม) สำหรับคำนวณค่าส่ง
    average_weight_g = Column(Integer, default=200) 
    
    is_active = Column(Boolean, default=True)


# 2. Fabric Type (ชนิดผ้า)
class FabricType(Base):
    __tablename__ = "fabric_types"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False) # จุติ, ไมโคร
    
    # Pricing & Cost
    price_adjustment = Column(DECIMAL(10, 2), default=0) # ราคาที่บวกเพิ่มจาก Base Price
    cost_per_yard = Column(DECIMAL(10, 2), default=0)    # ต้นทุนผ้าต่อหลา
    
    # Supplier Link (ผูกกับ Supplier เจ้าไหน)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=True)
    
    is_active = Column(Boolean, default=True)
    
    # Relationships
    supplier = relationship("Supplier", back_populates="fabrics")


# 3. Neck Type (ประเภทคอ เช่น คอกลม, คอปก)
class NeckType(Base):
    __tablename__ = "neck_types"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    
    price_adjustment = Column(DECIMAL(10, 2), default=0) # ราคาบวกเพิ่ม
    additional_cost = Column(DECIMAL(10, 2), default=0)  # ต้นทุนเพิ่ม (เช่น ค่าปกทอ)
    
    is_active = Column(Boolean, default=True)


# 4. Sleeve Type (ประเภทแขน เช่น แขนสั้น, แขนยาว, แขนจั๊ม)
class SleeveType(Base):
    __tablename__ = "sleeve_types"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    
    price_adjustment = Column(DECIMAL(10, 2), default=0) # ราคาบวกเพิ่ม
    additional_cost = Column(DECIMAL(10, 2), default=0)  # ต้นทุนเพิ่ม (เช่น แขนยาวใช้ผ้าเยอะกว่า)
    
    is_active = Column(Boolean, default=True)


# 5. Add-on Options (Option เสริมอื่นๆ เช่น ปักอก, สกรีน, กระเป๋า)
class AddOnOption(Base):
    __tablename__ = "addon_options"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    
    price_per_unit = Column(DECIMAL(10, 2), default=0) # ราคาคิดเพิ่มต่อตัว
    cost_per_unit = Column(DECIMAL(10, 2), default=0)  # ต้นทุนเพิ่มต่อตัว
    
    is_active = Column(Boolean, default=True)