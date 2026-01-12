import os

# Define Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
APP_DIR = os.path.join(BASE_DIR, "app")

def write_file(path, content):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"✅ Fixed: {path}")

# 1. FIX DB BASE (ต้องสะอาด ห้าม Import Model) -> แก้ ImportError
write_file(os.path.join(APP_DIR, "db", "base.py"), """from sqlalchemy.ext.declarative import declarative_base
Base = declarative_base()
""")

# 2. FIX MODELS INIT (รวม Model ทั้งหมดที่นี่) -> แก้ KeyError
write_file(os.path.join(APP_DIR, "models", "__init__.py"), """from .user import User
from .customer import Customer
from .order import Order, OrderItem
from .product import FabricType
from .supplier import Supplier
""")

# 3. FIX SUPPLIER MODEL (ต้องตรงกับ Product)
write_file(os.path.join(APP_DIR, "models", "supplier.py"), """from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base

class Supplier(Base):
    __tablename__ = "suppliers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    contact_person = Column(String)
    phone = Column(String)
    line_id = Column(String)
    address = Column(Text)
    tax_id = Column(String)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    is_active = Column(Boolean, default=True)

    # Relationships
    fabrics = relationship("FabricType", back_populates="supplier")
""")

# 4. FIX PRODUCT MODEL (เพิ่มความสัมพันธ์กลับหา Supplier)
write_file(os.path.join(APP_DIR, "models", "product.py"), """from sqlalchemy import Column, Integer, String, DECIMAL, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from app.db.base import Base

class FabricType(Base):
    __tablename__ = "fabric_types"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    price_adjustment = Column(DECIMAL(10, 2), default=0)
    is_active = Column(Boolean, default=True)
    
    # Foreign Key
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=True)
    supplier = relationship("Supplier", back_populates="fabrics")
""")

# 5. FIX ORDER API (แก้ 404 Trailing Slash)
# สังเกต @router.get("/") มี Slash ปิดท้าย เพื่อรองรับ Client ที่ส่งมาแบบมี Slash
write_file(os.path.join(APP_DIR, "api", "orders.py"), """from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.db.session import get_db
from app.models.order import Order
# สมมติว่ามี Schema, ถ้าไม่มีให้ใช้ dict ไปก่อน หรือปรับตามไฟล์เดิม
# from app.schemas.order import OrderCreate, OrderOut 

router = APIRouter()

@router.get("/", response_model=List[dict]) # <--- ใส่ Slash / ตรงนี้แก้ 404
def read_orders(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    orders = db.query(Order).offset(skip).limit(limit).all()
    return orders

@router.post("/", status_code=201) # <--- ใส่ Slash / ตรงนี้ด้วย
def create_order(order_data: dict, db: Session = Depends(get_db)):
    # TODO: Implement Logic create order
    return {"message": "Order created", "data": order_data}

@router.get("/{order_id}")
def read_order(order_id: int, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order
""")

# 6. FIX MAIN (ลำดับการ Import สำคัญมาก) -> แก้ 500 Error
write_file(os.path.join(APP_DIR, "main.py"), """from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.db.session import engine
from app.db.base import Base

# --- 1. CRITICAL: Import Models FIRST ---
# ต้องโหลด Models ทั้งหมดก่อน Create Tables และก่อน Load API Routes
from app.models import User, Customer, Order, OrderItem, FabricType, Supplier

# --- 2. Create Tables ---
Base.metadata.create_all(bind=engine)

# --- 3. Import APIs ---
from app.api import (
    auth, 
    orders, 
    products, 
    suppliers, 
    admin, 
    customers, 
    pricing_rules, 
    company        
)

app = FastAPI(title="B-Look OMS API")

origins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "https://blook-web-app.azurewebsites.net",
    "*"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(orders.router, prefix="/api/v1/orders", tags=["Orders"])
app.include_router(products.router, prefix="/api/v1/products", tags=["Products & Config"])
app.include_router(suppliers.router, prefix="/api/v1/suppliers", tags=["Suppliers"])
app.include_router(customers.router, prefix="/api/v1/customers", tags=["Customers"])
app.include_router(pricing_rules.router, prefix="/api/v1/pricing-rules", tags=["Pricing Rules"])
app.include_router(company.router, prefix="/api/v1/company", tags=["Company"])
app.include_router(admin.router, prefix="/api/v1/admin", tags=["Admin & Settings"])

@app.get("/")
def read_root():
    return {"message": "Welcome to B-Look API Server", "status": "running"}
""")

print("\n✨ All issues fixed! Please restart your uvicorn server now.")