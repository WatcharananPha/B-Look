import os
import shutil

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
APP_DIR = os.path.join(BASE_DIR, "app")

def write_file(path, content):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Fixed: {path}")

def clean_pycache():
    for root, dirs, files in os.walk(BASE_DIR):
        if "__pycache__" in dirs:
            shutil.rmtree(os.path.join(root, "__pycache__"))
            print(f"Deleted cache: {os.path.join(root, '__pycache__')}")

clean_pycache()

# 1. FIX DB BASE (Must be clean)
write_file(os.path.join(APP_DIR, "db", "base.py"), """from sqlalchemy.ext.declarative import declarative_base
Base = declarative_base()
""")

# 2. FIX MODELS INIT (Register all models)
write_file(os.path.join(APP_DIR, "models", "__init__.py"), """from .user import User
from .customer import Customer
from .order import Order, OrderItem
from .product import FabricType
""")

# 3. FIX PRODUCT MODEL
write_file(os.path.join(APP_DIR, "models", "product.py"), """from sqlalchemy import Column, Integer, String, DECIMAL, Boolean
from app.db.base import Base

class FabricType(Base):
    __tablename__ = "fabric_types"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    price_adjustment = Column(DECIMAL(10, 2), default=0)
    is_active = Column(Boolean, default=True)
""")

# 4. FIX API PRODUCTS
write_file(os.path.join(APP_DIR, "api", "products.py"), """from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel
from app.db.session import get_db
from app.models.product import FabricType

router = APIRouter()

class FabricResponse(BaseModel):
    id: int
    name: str
    price_adjustment: float
    class Config:
        from_attributes = True

@router.get("/fabrics", response_model=List[FabricResponse])
def get_fabrics(db: Session = Depends(get_db)):
    return db.query(FabricType).filter(FabricType.is_active == True).all()
""")

# 5. FIX API INIT
write_file(os.path.join(APP_DIR, "api", "__init__.py"), """from . import auth, orders, products
""")

# 6. FIX MAIN (Critical Import Order)
write_file(os.path.join(APP_DIR, "main.py"), """from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.db.session import engine
from app.db.base import Base

# 1. Import Models first (Register with SQLAlchemy)
from app.models import User, Customer, Order, OrderItem, FabricType

# 2. Create Tables
Base.metadata.create_all(bind=engine)

# 3. Import APIs
from app.api import auth, orders, products

app = FastAPI(title="B-Look OMS API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(orders.router, prefix="/api/v1/orders", tags=["Orders"])
app.include_router(products.router, prefix="/api/v1/products", tags=["Products"])

@app.get("/")
def read_root():
    return {"status": "ok"}
""")

print("\nDONE. Please restart uvicorn now.")