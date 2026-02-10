from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.db.session import get_db
from app.models.product import FabricType, NeckType, SleeveType
from app.schemas.master import FabricTypeResponse, NeckTypeResponse, SleeveTypeResponse
from pydantic import BaseModel
import re

router = APIRouter()


class MasterCreate(BaseModel):
    name: str
    price_adjustment: float = 0
    additional_cost: float = 0
    quantity: int = 0
    cost_price: float = 0
    force_slope: bool = False


# ✅ FIX: ปรับ Limit เป็น 1000 เพื่อให้แสดงข้อมูลครบทุกรายการ
@router.get("/fabrics", response_model=List[FabricTypeResponse])
def get_fabrics(skip: int = 0, limit: int = 1000, db: Session = Depends(get_db)):
    return (
        db.query(FabricType)
        .filter(FabricType.is_active == True)
        .offset(skip)
        .limit(limit)
        .all()
    )


@router.get("/necks", response_model=List[NeckTypeResponse])
def get_necks(skip: int = 0, limit: int = 1000, db: Session = Depends(get_db)):
    return (
        db.query(NeckType)
        .filter(NeckType.is_active == True)
        .order_by(NeckType.id.asc())
        .offset(skip)
        .limit(limit)
        .all()
    )


@router.get("/sleeves", response_model=List[SleeveTypeResponse])
def get_sleeves(skip: int = 0, limit: int = 1000, db: Session = Depends(get_db)):
    return (
        db.query(SleeveType)
        .filter(SleeveType.is_active == True)
        .offset(skip)
        .limit(limit)
        .all()
    )


@router.post("/necks")
def create_neck(item: MasterCreate, db: Session = Depends(get_db)):
    # sanitize name: normalize common misspelling and collapse duplicate forced-slope annotation
    name = (item.name or "").replace("นํ้า", "น้ำ").strip()
    # collapse repeated annotation occurrences like "(...)(...)" -> single
    anno = "(บังคับไหล่สโลป+40 บาท/ตัว)"
    name = re.sub(rf"(?:{re.escape(anno)})(?:\s*{re.escape(anno)})+", anno, name)

    new_item = NeckType(
        name=name,
        price_adjustment=item.price_adjustment,
        additional_cost=item.additional_cost,
        quantity=item.quantity,
        cost_price=item.cost_price,
        force_slope=item.force_slope,
    )
    db.add(new_item)
    db.commit()
    return new_item


@router.put("/necks/{item_id}")
def update_neck(item_id: int, item: MasterCreate, db: Session = Depends(get_db)):
    db_item = db.query(NeckType).filter(NeckType.id == item_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Not found")

    # อัปเดตข้อมูลลง DB (เพื่อให้หน้า Order ดึงไปใช้)
    # sanitize name similar to create
    name = (item.name or "").replace("นํ้า", "น้ำ").strip()
    anno = "(บังคับไหล่สโลป+40 บาท/ตัว)"
    name = re.sub(rf"(?:{re.escape(anno)})(?:\s*{re.escape(anno)})+", anno, name)
    db_item.name = name
    db_item.price_adjustment = item.price_adjustment
    db_item.additional_cost = item.additional_cost
    db_item.quantity = item.quantity
    db_item.cost_price = item.cost_price
    db_item.force_slope = item.force_slope
    db.commit()
    db.refresh(db_item)
    return db_item
