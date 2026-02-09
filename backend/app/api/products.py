from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.db.session import get_db
from app.models.product import FabricType, NeckType, SleeveType
# ✅ FIX: Import ชื่อ Class ให้ถูกต้อง (มี Response ต่อท้าย)
from app.schemas.master import FabricTypeResponse as FabricSchema, NeckTypeResponse as NeckSchema, SleeveTypeResponse as SleeveSchema
from pydantic import BaseModel

router = APIRouter()

class MasterCreate(BaseModel):
    name: str
    price_adjustment: float = 0
    quantity: int = 0
    cost_price: float = 0
    force_slope: bool = False

# --- FABRICS ---
@router.get("/fabrics", response_model=List[FabricSchema])
def get_fabrics(skip: int = 0, limit: int = 1000, db: Session = Depends(get_db)):
    return db.query(FabricType).filter(FabricType.is_active == True).offset(skip).limit(limit).all()

@router.post("/fabrics")
def create_fabric(item: MasterCreate, db: Session = Depends(get_db)):
    new_item = FabricType(name=item.name, price_adjustment=item.price_adjustment, quantity=item.quantity, cost_price=item.cost_price)
    db.add(new_item)
    db.commit()
    return new_item

@router.put("/fabrics/{item_id}")
def update_fabric(item_id: int, item: MasterCreate, db: Session = Depends(get_db)):
    db_item = db.query(FabricType).filter(FabricType.id == item_id).first()
    if not db_item: raise HTTPException(status_code=404, detail="Not found")
    db_item.name = item.name
    db_item.price_adjustment = item.price_adjustment
    db_item.quantity = item.quantity
    db_item.cost_price = item.cost_price
    db.commit()
    return db_item

@router.delete("/fabrics/{item_id}")
def delete_fabric(item_id: int, db: Session = Depends(get_db)):
    db_item = db.query(FabricType).filter(FabricType.id == item_id).first()
    if db_item:
        db.delete(db_item)
        db.commit()
    return {"message": "Deleted"}

# --- NECKS ---
@router.get("/necks", response_model=List[NeckSchema])
def get_necks(skip: int = 0, limit: int = 1000, db: Session = Depends(get_db)):
    return db.query(NeckType).filter(NeckType.is_active == True).order_by(NeckType.id.asc()).offset(skip).limit(limit).all()

@router.post("/necks")
def create_neck(item: MasterCreate, db: Session = Depends(get_db)):
    new_item = NeckType(name=item.name, price_adjustment=item.price_adjustment, quantity=item.quantity, cost_price=item.cost_price, force_slope=item.force_slope)
    db.add(new_item)
    db.commit()
    return new_item

@router.put("/necks/{item_id}")
def update_neck(item_id: int, item: MasterCreate, db: Session = Depends(get_db)):
    db_item = db.query(NeckType).filter(NeckType.id == item_id).first()
    if not db_item: raise HTTPException(status_code=404, detail="Not found")
    db_item.name = item.name
    db_item.price_adjustment = item.price_adjustment
    db_item.additional_cost = item.price_adjustment # Sync
    db_item.quantity = item.quantity
    db_item.cost_price = item.cost_price
    db_item.force_slope = item.force_slope
    db.commit()
    return db_item

@router.delete("/necks/{item_id}")
def delete_neck(item_id: int, db: Session = Depends(get_db)):
    db_item = db.query(NeckType).filter(NeckType.id == item_id).first()
    if db_item:
        db.delete(db_item)
        db.commit()
    return {"message": "Deleted"}

# --- SLEEVES ---
@router.get("/sleeves", response_model=List[SleeveSchema])
def get_sleeves(skip: int = 0, limit: int = 1000, db: Session = Depends(get_db)):
    return db.query(SleeveType).filter(SleeveType.is_active == True).offset(skip).limit(limit).all()

@router.post("/sleeves")
def create_sleeve(item: MasterCreate, db: Session = Depends(get_db)):
    new_item = SleeveType(name=item.name, price_adjustment=item.price_adjustment, quantity=item.quantity, cost_price=item.cost_price)
    db.add(new_item)
    db.commit()
    return new_item

@router.put("/sleeves/{item_id}")
def update_sleeve(item_id: int, item: MasterCreate, db: Session = Depends(get_db)):
    db_item = db.query(SleeveType).filter(SleeveType.id == item_id).first()
    if not db_item: raise HTTPException(status_code=404, detail="Not found")
    db_item.name = item.name
    db_item.price_adjustment = item.price_adjustment
    db_item.additional_cost = item.price_adjustment # Sync
    db_item.quantity = item.quantity
    db_item.cost_price = item.cost_price
    db.commit()
    return db_item

@router.delete("/sleeves/{item_id}")
def delete_sleeve(item_id: int, db: Session = Depends(get_db)):
    db_item = db.query(SleeveType).filter(SleeveType.id == item_id).first()
    if db_item:
        db.delete(db_item)
        db.commit()
    return {"message": "Deleted"}
