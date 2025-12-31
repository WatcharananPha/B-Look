from sqlalchemy import Column, Integer, String, Text
from app.db.base_class import Base

class CompanyInfo(Base):
    __tablename__ = "company_info"

    id = Column(Integer, primary_key=True, index=True)
    name_th = Column(String, nullable=False)
    name_en = Column(String)
    address = Column(Text)
    tax_id = Column(String)
    phone = Column(String)
    email = Column(String)
    website = Column(String)
    logo_url = Column(String)