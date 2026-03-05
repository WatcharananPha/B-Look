from sqlalchemy import Column, Integer, String, DECIMAL, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from app.db.base_class import Base

class FabricType(Base):
    __tablename__ = "fabric_types"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    price_adjustment = Column(DECIMAL(10, 2), default=0)
    quantity = Column(Integer, default=0)
    cost_price = Column(DECIMAL(10, 2), default=0)
    cost_per_yard = Column(DECIMAL(10, 2), default=0)
    is_active = Column(Boolean, default=True)

    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=True)
    supplier = relationship("Supplier", back_populates="fabrics")

class NeckType(Base):
    __tablename__ = "neck_types"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    price_adjustment = Column(DECIMAL(10, 2), default=0)
    quantity = Column(Integer, default=0)
    cost_price = Column(DECIMAL(10, 2), default=0)

    additional_cost = Column(DECIMAL(10, 2), default=0)
    force_slope = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)

class SleeveType(Base):
    __tablename__ = "sleeve_types"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    price_adjustment = Column(DECIMAL(10, 2), default=0)

    quantity = Column(Integer, default=0)
    cost_price = Column(DECIMAL(10, 2), default=0)

    additional_cost = Column(DECIMAL(10, 2), default=0)
    is_active = Column(Boolean, default=True)
