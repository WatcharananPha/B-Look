from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.db.session import get_db
from app.models.product import FabricType, NeckType, SleeveType
from app.schemas.master import FabricTypeResponse, NeckTypeResponse, SleeveTypeResponse
from pydantic import BaseModel

router = APIRouter()


class MasterCreate(BaseModel):
    name: str
    price_adjustment: float = 0
    quantity: int = 0
    cost_price: float = 0
    force_slope: bool = False


# --- FABRICS ---
@router.get("/fabrics", response_model=List[FabricTypeResponse])
def get_fabrics(db: Session = Depends(get_db)):
    return db.query(FabricType).filter(FabricType.is_active == True).all()


@router.post("/fabrics")
def create_fabric(item: MasterCreate, db: Session = Depends(get_db)):
    new_item = FabricType(
        name=item.name,
        price_adjustment=item.price_adjustment,
        quantity=item.quantity,
        cost_price=item.cost_price,
    )
    db.add(new_item)
    db.commit()
    return new_item


@router.put("/fabrics/{item_id}")
def update_fabric(item_id: int, item: MasterCreate, db: Session = Depends(get_db)):
    db_item = db.query(FabricType).filter(FabricType.id == item_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Not found")
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
@router.get("/necks", response_model=List[NeckTypeResponse])
def get_necks(db: Session = Depends(get_db)):
    rows = db.query(NeckType).filter(NeckType.is_active == True).all()

    # Compute force_slope flag server-side so frontend doesn't rely on string matching
    def compute_force(neck_name: str) -> bool:
        if not neck_name:
            return False
        n = neck_name.replace("นํ้า", "น้ำ")
        keys = ["คอปกคางหมู", "คอหยด", "คอห้าเหลี่ยมคางหมู"]
        return any(k in n for k in keys)

    result = []
    for r in rows:
        item = r.__dict__.copy()
        # remove sqlalchemy state
        item.pop("_sa_instance_state", None)
        # Prefer persisted `force_slope` column if available, otherwise compute
        item["force_slope"] = getattr(r, "force_slope", None)
        if item["force_slope"] is None:
            item["force_slope"] = compute_force(r.name)
        result.append(item)
    return result


@router.post("/necks")
def create_neck(item: MasterCreate, db: Session = Depends(get_db)):
    new_item = NeckType(
        name=item.name,
        price_adjustment=item.price_adjustment,
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

    db_item.name = item.name
    db_item.price_adjustment = item.price_adjustment
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


# SLEEVES
@router.get("/sleeves", response_model=List[SleeveTypeResponse])
def get_sleeves(db: Session = Depends(get_db)):
    return db.query(SleeveType).filter(SleeveType.is_active == True).all()


@router.post("/sleeves")
def create_sleeve(item: MasterCreate, db: Session = Depends(get_db)):
    new_item = SleeveType(
        name=item.name,
        price_adjustment=item.price_adjustment,
        quantity=item.quantity,
        cost_price=item.cost_price,
    )
    db.add(new_item)
    db.commit()
    return new_item


@router.put("/sleeves/{item_id}")
def update_sleeve(item_id: int, item: MasterCreate, db: Session = Depends(get_db)):
    db_item = db.query(SleeveType).filter(SleeveType.id == item_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Not found")
    db_item.name = item.name
    db_item.price_adjustment = item.price_adjustment
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
