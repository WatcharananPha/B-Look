from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base_class import Base


class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    customer_code = Column(String, nullable=True)
    phone = Column(String)
    channel = Column(String)  # LINE OA, Facebook, Phone
    address = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationship: 1 Customer has Many Orders
    orders = relationship("Order", back_populates="customer")
