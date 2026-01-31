from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    DateTime,
    ForeignKey,
    DECIMAL,
    Text,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base_class import Base


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    order_no = Column(String, unique=True, index=True, nullable=False)

    # Customer Info Snapshot
    customer_name = Column(String, index=True)
    brand = Column(String)

    # ✅ เพิ่มคอลัมน์ใหม่ตรงนี้
    contact_channel = Column(String, nullable=True)
    address = Column(Text, nullable=True)
    phone = Column(String, nullable=True)

    # ... (Code ส่วนที่เหลือเหมือนเดิม)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)
    customer = relationship("Customer", back_populates="orders")

    deadline = Column(DateTime(timezone=True), nullable=True)
    usage_date = Column(DateTime(timezone=True), nullable=True)
    urgency_level = Column(String, default="normal")  # normal, warning, critical
    status = Column(String, default="draft")  # draft, production, delivered

    # Financials
    is_vat_included = Column(Boolean, default=True)
    shipping_cost = Column(DECIMAL(10, 2), default=0)
    add_on_cost = Column(DECIMAL(10, 2), default=0)

    discount_type = Column(String, default="THB")  # THB or PERCENT
    discount_value = Column(DECIMAL(10, 2), default=0)
    discount_amount = Column(DECIMAL(10, 2), default=0)

    vat_amount = Column(DECIMAL(10, 2), default=0)
    grand_total = Column(DECIMAL(10, 2), default=0)

    deposit_amount = Column(DECIMAL(10, 2), default=0)  # Total Deposit
    deposit_1 = Column(DECIMAL(10, 2), default=0)
    deposit_2 = Column(DECIMAL(10, 2), default=0)

    balance_amount = Column(DECIMAL(10, 2), default=0)

    # Cost & Profit
    total_cost = Column(DECIMAL(10, 2), default=0)
    estimated_profit = Column(DECIMAL(10, 2), default=0)

    note = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_by = relationship("User", foreign_keys=[created_by_id])

    items = relationship(
        "OrderItem", back_populates="order", cascade="all, delete-orphan"
    )


class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)

    product_name = Column(String)
    fabric_type = Column(String, nullable=True)
    neck_type = Column(String, nullable=True)
    sleeve_type = Column(String, nullable=True)

    quantity_matrix = Column(Text)  # JSON string e.g. {"S": 10, "M": 5}

    total_qty = Column(Integer, default=0)
    price_per_unit = Column(DECIMAL(10, 2), default=0)
    total_price = Column(DECIMAL(10, 2), default=0)

    cost_per_unit = Column(DECIMAL(10, 2), default=0)
    total_cost = Column(DECIMAL(10, 2), default=0)

    order = relationship("Order", back_populates="items")
