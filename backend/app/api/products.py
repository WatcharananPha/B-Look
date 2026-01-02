from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.db.session import get_db
from app.models.product import FabricType, NeckType, SleeveType, ProductType, AddOnOption
from app.schemas.master import (
    FabricTypeResponse, FabricTypeCreate,
    NeckTypeResponse, NeckTypeCreate,
    SleeveTypeResponse, SleeveTypeCreate,
    ProductTypeResponse, ProductTypeCreate,
    AddOnResponse, AddOnCreate
)

router = APIRouter()

# --- Helper Function for CRUD ---
def create_master_item(db: Session, model, schema):
    db_item = model(**schema.dict())
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

def get_master_items(db: Session, model):
    return db.query(model).filter(model.is_active == True).all()

# [NEW] Helper for Update
def update_master_item(db: Session, model, item_id: int, schema):
    db_item = db.query(model).filter(model.id == item_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    # Update fields
    for key, value in schema.dict(exclude_unset=True).items():
        setattr(db_item, key, value)
    
    db.commit()
    db.refresh(db_item)
    return db_item

# [NEW] Helper for Delete (Soft Delete)
def delete_master_item(db: Session, model, item_id: int):
    db_item = db.query(model).filter(model.id == item_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    # Soft delete (set is_active = False)
    db_item.is_active = False
    db.commit()
    return {"message": "Item deleted successfully"}

# --- 1. Product Types (ทรงเสื้อ) ---
@router.post("/types", response_model=ProductTypeResponse)
def create_product_type(item: ProductTypeCreate, db: Session = Depends(get_db)):
    return create_master_item(db, ProductType, item)

@router.get("/types", response_model=List[ProductTypeResponse])
def get_product_types(db: Session = Depends(get_db)):
    return get_master_items(db, ProductType)

@router.put("/types/{item_id}", response_model=ProductTypeResponse)
def update_product_type(item_id: int, item: ProductTypeCreate, db: Session = Depends(get_db)):
    return update_master_item(db, ProductType, item_id, item)

@router.delete("/types/{item_id}")
def delete_product_type(item_id: int, db: Session = Depends(get_db)):
    return delete_master_item(db, ProductType, item_id)

# --- 2. Fabrics (ผ้า) ---
@router.post("/fabrics", response_model=FabricTypeResponse)
def create_fabric(item: FabricTypeCreate, db: Session = Depends(get_db)):
    return create_master_item(db, FabricType, item)

@router.get("/fabrics", response_model=List[FabricTypeResponse])
def get_fabrics(db: Session = Depends(get_db)):
    return get_master_items(db, FabricType)

@router.put("/fabrics/{item_id}", response_model=FabricTypeResponse)
def update_fabric(item_id: int, item: FabricTypeCreate, db: Session = Depends(get_db)):
    return update_master_item(db, FabricType, item_id, item)

@router.delete("/fabrics/{item_id}")
def delete_fabric(item_id: int, db: Session = Depends(get_db)):
    return delete_master_item(db, FabricType, item_id)

# --- 3. Necks (คอ) ---
@router.post("/necks", response_model=NeckTypeResponse)
def create_neck(item: NeckTypeCreate, db: Session = Depends(get_db)):
    return create_master_item(db, NeckType, item)

@router.get("/necks", response_model=List[NeckTypeResponse])
def get_necks(db: Session = Depends(get_db)):
    return get_master_items(db, NeckType)

@router.put("/necks/{item_id}", response_model=NeckTypeResponse)
def update_neck(item_id: int, item: NeckTypeCreate, db: Session = Depends(get_db)):
    return update_master_item(db, NeckType, item_id, item)

@router.delete("/necks/{item_id}")
def delete_neck(item_id: int, db: Session = Depends(get_db)):
    return delete_master_item(db, NeckType, item_id)

# --- 4. Sleeves (แขน) ---
@router.post("/sleeves", response_model=SleeveTypeResponse)
def create_sleeve(item: SleeveTypeCreate, db: Session = Depends(get_db)):
    return create_master_item(db, SleeveType, item)

@router.get("/sleeves", response_model=List[SleeveTypeResponse])
def get_sleeves(db: Session = Depends(get_db)):
    return get_master_items(db, SleeveType)

@router.put("/sleeves/{item_id}", response_model=SleeveTypeResponse)
def update_sleeve(item_id: int, item: SleeveTypeCreate, db: Session = Depends(get_db)):
    return update_master_item(db, SleeveType, item_id, item)

@router.delete("/sleeves/{item_id}")
def delete_sleeve(item_id: int, db: Session = Depends(get_db)):
    return delete_master_item(db, SleeveType, item_id)

# --- 5. Add-ons (Option เสริม) ---
@router.post("/addons", response_model=AddOnResponse)
def create_addon(item: AddOnCreate, db: Session = Depends(get_db)):
    return create_master_item(db, AddOnOption, item)

@router.get("/addons", response_model=List[AddOnResponse])
def get_addons(db: Session = Depends(get_db)):
    return get_master_items(db, AddOnOption)

@router.put("/addons/{item_id}", response_model=AddOnResponse)
def update_addon(item_id: int, item: AddOnCreate, db: Session = Depends(get_db)):
    return update_master_item(db, AddOnOption, item_id, item)

@router.delete("/addons/{item_id}")
def delete_addon(item_id: int, db: Session = Depends(get_db)):
    return delete_master_item(db, AddOnOption, item_id)