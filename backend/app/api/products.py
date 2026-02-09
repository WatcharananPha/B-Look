from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Any
from app.db.session import get_db
from app.models.product import FabricType, NeckType, SleeveType
from app.schemas.master import FabricType as FabricSchema, NeckType as NeckSchema, SleeveType as SleeveSchema

router = APIRouter()

# ✅ FIX: ปรับ limit default เป็น 1000 เพื่อให้แสดงครบทุกรายการ (แก้ปัญหาข้อมูลมาไม่ครบ)
@router.get("/fabrics", response_model=List[FabricSchema])
def get_fabrics(skip: int = 0, limit: int = 1000, db: Session = Depends(get_db)):
    return db.query(FabricType).filter(FabricType.is_active == True).offset(skip).limit(limit).all()

@router.get("/necks", response_model=List[NeckSchema])
def get_necks(skip: int = 0, limit: int = 1000, db: Session = Depends(get_db)):
    # เรียงตาม ID เพื่อให้ลำดับคงที่
    return db.query(NeckType).filter(NeckType.is_active == True).order_by(NeckType.id.asc()).offset(skip).limit(limit).all()

@router.get("/sleeves", response_model=List[SleeveSchema])
def get_sleeves(skip: int = 0, limit: int = 1000, db: Session = Depends(get_db)):
    return db.query(SleeveType).filter(SleeveType.is_active == True).offset(skip).limit(limit).all()

# --- CRUD Operations (Simplified for brevity) ---
# (คง Logic เดิมไว้สำหรับการ update/create)
@router.put("/necks/{id}", response_model=NeckSchema)
def update_neck(id: int, item_in: NeckSchema, db: Session = Depends(get_db)):
    item = db.query(NeckType).filter(NeckType.id == id).first()
    if not item: raise HTTPException(status_code=404, detail="Not found")
    item.name = item_in.name
    item.price_adjustment = item_in.price_adjustment
    item.additional_cost = item_in.additional_cost
    item.force_slope = item_in.force_slope
    db.commit()
    db.refresh(item)
    return item
