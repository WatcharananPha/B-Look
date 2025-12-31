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

# --- 1. Product Types (ทรงเสื้อ) ---
@router.post("/types", response_model=ProductTypeResponse)
def create_product_type(item: ProductTypeCreate, db: Session = Depends(get_db)):
    return create_master_item(db, ProductType, item)

@router.get("/types", response_model=List[ProductTypeResponse])
def get_product_types(db: Session = Depends(get_db)):
    return get_master_items(db, ProductType)

# --- 2. Fabrics (ผ้า) ---
@router.post("/fabrics", response_model=FabricTypeResponse)
def create_fabric(item: FabricTypeCreate, db: Session = Depends(get_db)):
    return create_master_item(db, FabricType, item)

@router.get("/fabrics", response_model=List[FabricTypeResponse])
def get_fabrics(db: Session = Depends(get_db)):
    # Custom query to include supplier name if needed (optional)
    return get_master_items(db, FabricType)

# --- 3. Necks (คอ) ---
@router.post("/necks", response_model=NeckTypeResponse)
def create_neck(item: NeckTypeCreate, db: Session = Depends(get_db)):
    return create_master_item(db, NeckType, item)

@router.get("/necks", response_model=List[NeckTypeResponse])
def get_necks(db: Session = Depends(get_db)):
    return get_master_items(db, NeckType)

# --- 4. Sleeves (แขน) ---
@router.post("/sleeves", response_model=SleeveTypeResponse)
def create_sleeve(item: SleeveTypeCreate, db: Session = Depends(get_db)):
    return create_master_item(db, SleeveType, item)

@router.get("/sleeves", response_model=List[SleeveTypeResponse])
def get_sleeves(db: Session = Depends(get_db)):
    return get_master_items(db, SleeveType)

# --- 5. Add-ons (Option เสริม) ---
@router.post("/addons", response_model=AddOnResponse)
def create_addon(item: AddOnCreate, db: Session = Depends(get_db)):
    return create_master_item(db, AddOnOption, item)

@router.get("/addons", response_model=List[AddOnResponse])
def get_addons(db: Session = Depends(get_db)):
    return get_master_items(db, AddOnOption)