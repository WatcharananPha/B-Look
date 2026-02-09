from typing import Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
# แก้ไข Import ให้ตรงกับ Model ที่มี
from app.models.company import Company 
from app.schemas.company import CompanyConfig, CompanyUpdate
from decimal import Decimal

router = APIRouter()

@router.get("/addons")
def get_addons():
    # คืนค่าราคาของ Add-on เป็นรายการที่ frontend สามารถใช้ได้
    addons = [
        {"id": "longSleeve", "name": "แขนยาว", "price": float(40)},
        {"id": "pocket", "name": "กระเป๋า", "price": float(20)},
        {"id": "numberName", "name": "รันเบอร์/ชื่อ", "price": float(20)},
        {"id": "slopeShoulder", "name": "ไหล่สโลป", "price": float(40)},
        {"id": "collarTongue", "name": "คอมีลิ้น", "price": float(10)},
        {"id": "shortSleeveAlt", "name": "แขนจิ้ม", "price": float(20)},
        {"id": "oversizeSlopeShoulder", "name": "ทรงโอเวอร์ไซส์ไหล่สโลป", "price": float(60)},
    ]
    return addons

@router.get("/config", response_model=CompanyConfig)
def get_company_config(
    db: Session = Depends(get_db)
) -> Any:

    company = db.query(Company).first()
    if not company:
        # ถ้ายังไม่มี ให้สร้างค่า Default
        company = Company(vat_rate=0.07, default_shipping_cost=0.0)
        db.add(company)
        db.commit()
        db.refresh(company)
    return company

@router.put("/config", response_model=CompanyConfig)
def update_company_config(
    config_in: CompanyUpdate,
    db: Session = Depends(get_db)
) -> Any:
    company = db.query(Company).first()
    if not company:
        company = Company()
        db.add(company)
    
    # Update fields
    company.vat_rate = config_in.vat_rate
    company.default_shipping_cost = config_in.default_shipping_cost
    
    db.commit()
    db.refresh(company)
    return company