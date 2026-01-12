from sqlalchemy import Column, Integer, String, Boolean, DECIMAL, Date, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from app.db.base_class import Base

class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    order_no = Column(String, unique=True, index=True, nullable=False)
    
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    status = Column(String, default="draft")

    deadline = Column(Date)
    # --------------------------------------------------

    urgency_level = Column(String, default="normal")

    # --- Financials ---
    total_amount = Column(DECIMAL(10, 2), default=0) 
    grand_total = Column(DECIMAL(10, 2), default=0)
    
    deposit = Column(DECIMAL(10, 2), default=0)        
    deposit_amount = Column(DECIMAL(10, 2), default=0) 
    
    balance = Column(DECIMAL(10, 2), default=0)        
    balance_amount = Column(DECIMAL(10, 2), default=0) 

    is_vat_included = Column(Boolean, default=False)
    vat_amount = Column(DECIMAL(10, 2), default=0)
    discount_amount = Column(DECIMAL(10, 2), default=0)
    shipping_cost = Column(DECIMAL(10, 2), default=0)
    add_on_cost = Column(DECIMAL(10, 2), default=0)
    
    # --- Cost & Profit ---
    total_cost = Column(DECIMAL(10, 2), default=0)       
    estimated_profit = Column(DECIMAL(10, 2), default=0) 
    # ---------------------

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    customer = relationship("Customer", back_populates="orders")
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")


class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"))

    product_name = Column(String)
    fabric_type = Column(String)
    neck_type = Column(String)
    sleeve_type = Column(String)

    quantity_matrix = Column(JSONB, nullable=False)
    total_qty = Column(Integer, default=0)

    price_per_unit = Column(DECIMAL(10, 2))
    total_price = Column(DECIMAL(10, 2))
    
    # Cost per item
    cost_per_unit = Column(DECIMAL(10, 2), default=0)
    total_cost = Column(DECIMAL(10, 2), default=0)

    order = relationship("Order", back_populates="items")