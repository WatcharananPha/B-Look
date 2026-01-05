from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.company import CompanyInfo
from app.schemas.company import CompanyInfoUpdate, CompanyInfoOut
from app.api.deps import get_current_user

router = APIRouter()

@router.get("/config", response_model=CompanyInfoOut)
def get_company_config(
    db: Session = Depends(get_db),
    # ลบ current_user ออกเพื่อให้ Frontend ดึงค่าไปคำนวณราคาได้โดยไม่ต้อง Login
):
    # ดึงแถวแรกเสมอ ถ้าไม่มีให้สร้างใหม่ (Singleton Pattern)
    company = db.query(CompanyInfo).first()
    if not company:
        company = CompanyInfo(vat_rate=0.07, default_shipping_cost=0.0)
        db.add(company)
        db.commit()
        db.refresh(company)
    return company

@router.put("/config", response_model=CompanyInfoOut)
def update_company_config(
    config_in: CompanyInfoUpdate,
    db: Session = Depends(get_db),
    # current_user = Depends(get_current_user) # การแก้ไขข้อมูลยังต้อง Login
):
    company = db.query(CompanyInfo).first()
    if not company:
        company = CompanyInfo()
        db.add(company)
    
    data = config_in.dict(exclude_unset=True)
    for key, value in data.items():
        setattr(company, key, value)
        
    db.commit()
    db.refresh(company)
    return company