from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.base_class import Base

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    
    action = Column(String, nullable=False)
    target_type = Column(String, index=True)
    target_id = Column(String, index=True)
    details = Column(Text, nullable=True)
    
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    user = relationship("User")
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())