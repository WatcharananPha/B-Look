from sqlalchemy import Column, Integer, String, Boolean, DECIMAL, Date, ForeignKey, Text, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import JSONB  # Key Feature!
from sqlalchemy.sql import func
from app.db.base import Base

class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    order_no = Column(String, unique=True, index=True)
    customer_name = Column(String) # Simplification for prototype
    
    # Status & Dates
    status = Column(String, default="draft")
    deadline_date = Column(Date, nullable=False)
    urgency_level = Column(String) # normal, warning, critical
    
    # Financials
    grand_total = Column(DECIMAL(10, 2))
    is_vat_included = Column(Boolean, default=False)
    deposit_amount = Column(DECIMAL(10, 2), default=0)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relation
    items = relationship("OrderItem", back_populates="order")

class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True)
    order_id = Column(Integer, ForeignKey("orders.id"))
    
    # JSONB เก็บ Size Matrix {"S": 10, "M": 5}
    quantity_matrix = Column(JSONB, nullable=False)
    total_qty = Column(Integer)
    selling_price_per_unit = Column(DECIMAL(10, 2))
    
    # Relation
    order = relationship("Order", back_populates="items")