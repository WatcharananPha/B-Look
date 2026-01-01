from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.db.session import get_db
from app.models.company import CompanyInfo
from app.models.pricing_rule import ShippingRate
from app.schemas.admin import (
    CompanyInfoResponse, CompanyInfoCreate,
    ShippingRateResponse, ShippingRateCreate
)

router = APIRouter()

# --- Company Info ---
@router.post("/company", response_model=CompanyInfoResponse)
def create_or_update_company(item: CompanyInfoCreate, db: Session = Depends(get_db)):
    # มีได้แค่ 1 บริษัท -> เช็คก่อนว่ามีไหม
    company = db.query(CompanyInfo).first()
    if company:
        for key, value in item.dict().items():
            setattr(company, key, value)
    else:
        company = CompanyInfo(**item.dict())
        db.add(company)
    
    db.commit()
    db.refresh(company)
    return company

@router.get("/company", response_model=CompanyInfoResponse)
def get_company(db: Session = Depends(get_db)):
    company = db.query(CompanyInfo).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company info not set")
    return company

# --- Shipping Rates ---
@router.post("/shipping-rates", response_model=ShippingRateResponse)
def create_shipping_rate(item: ShippingRateCreate, db: Session = Depends(get_db)):
    rate = ShippingRate(**item.dict())
    db.add(rate)
    db.commit()
    db.refresh(rate)
    return rate

@router.get("/shipping-rates", response_model=List[ShippingRateResponse])
def get_shipping_rates(db: Session = Depends(get_db)):
    return db.query(ShippingRate).filter(ShippingRate.is_active == True).all()

@router.delete("/shipping-rates/{rate_id}")
def delete_shipping_rate(rate_id: int, db: Session = Depends(get_db)):
    rate = db.query(ShippingRate).filter(ShippingRate.id == rate_id).first()
    if not rate:
        raise HTTPException(status_code=404, detail="Rate not found")
    db.delete(rate)
    db.commit()
    return {"status": "deleted"}