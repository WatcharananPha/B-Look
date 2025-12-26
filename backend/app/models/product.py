from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel
from app.db.session import get_db
from app.models.product import FabricType

router = APIRouter()

# --- Schemas ---
class FabricResponse(BaseModel):
    id: int
    name: str
    price_adjustment: float

    class Config:
        from_attributes = True # รองรับ SQLAlchemy Model

# --- Endpoints ---
@router.get("/fabrics", response_model=List[FabricResponse])
def get_fabrics(db: Session = Depends(get_db)):
    """ดึงข้อมูลชนิดผ้าทั้งหมด"""
    # ดึงข้อมูลทั้งหมดจากตาราง FabricType (ที่เรา Seed ไว้)
    fabrics = db.query(FabricType).all()
    return fabrics