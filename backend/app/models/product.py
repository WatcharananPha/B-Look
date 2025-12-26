from sqlalchemy import Column, Integer, String, DECIMAL, Boolean
from app.db.base import Base

class FabricType(Base):
    __tablename__ = "fabric_types"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    price_adjustment = Column(DECIMAL(10, 2), default=0)
    is_active = Column(Boolean, default=True)
