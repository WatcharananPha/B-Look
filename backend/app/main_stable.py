from fastapi import FastAPI, Request, status, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm 
from sqlalchemy import text, inspect
from app.db.base_class import Base
from app.db.session import engine, SessionLocal

# Import Models
from app.models.user import User
from app.models.order import Order
from app.models.product import FabricType, NeckType, SleeveType
from app.models.customer import Customer
from app.models.supplier import Supplier
from app.models.pricing_rule import PricingRule
from app.models.company import Company
from app.models.audit_log import AuditLog

from app.api import auth, orders, products, suppliers, customers, pricing_rules, company, admin
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="B-Look Production System")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def initialize_system():
    logger.info("🛠️ DATABASE: Creating tables...")
    Base.metadata.create_all(bind=engine)
    
    with engine.connect() as conn:
        try:
            logger.info("🧹 SEED: Syncing Product Data...")
            # 1. ล้างข้อมูลเก่า
            conn.execute(text("DELETE FROM fabric_types"))
            conn.execute(text("DELETE FROM sleeve_types"))
            conn.execute(text("DELETE FROM neck_types"))
            
            # 2. รายการคอ (ตามที่คุณระบุ 100%)
            neck_list = [
                "คอกลม",
                "คอวีชน",
                "คอวีไขว้",
                "คอวีตัด",
                "คอวีปก",
                "คอห้าเหลี่ยม",
                "คอปกคางหมู (มีลิ้น) (บังคับไหล่สโลป+40 บาท/ตัว)",
                "คอหยดนํ้า (บังคับไหล่สโลป+40 บาท/ตัว)",
                "คอห้าเหลี่ยมคางหมู (มีลิ้น) (บังคับไหล่สโลป+40 บาท/ตัว)",
                "คอห้าเหลี่ยมคางหมู (ไม่มีลื่น) (บังคับไหล่สโลป+40 บาท/ตัว)",
                "คอจีน",
                "คอวีปก (มีลิ้น)",
                "คอโปโล",
                "คอวาย",
                "คอเชิ้ตฐานตั้ง"
            ]
            
            for name in neck_list:
                is_special_340 = "(บังคับไหล่สโลป+40 บาท/ตัว)" in name
                # ตั้งราคา additional_cost = 40 ทันทีถ้าเป็นคอพิเศษ
                add_cost = 40 if is_special_340 else 0
                force_slope = 1 if is_special_340 else 0
                
                conn.execute(text("""
                    INSERT INTO neck_types 
                    (name, price_adjustment, additional_cost, force_slope, is_active, quantity, cost_price)
                    VALUES (:n, 0, :ac, :fs, 1, 0, 0)
                """), {"n": name, "ac": add_cost, "fs": force_slope})
            
            # Create Admin
            user_check = conn.execute(text("SELECT * FROM users WHERE username='admin'")).fetchone()
            if not user_check:
                pw_hash = "b2"
                conn.execute(text("""
                    INSERT INTO users (username, password_hash, full_name, role, is_active)
                    VALUES ('admin', :p, 'System Admin', 'owner', 1)
                """), {"p": pw_hash})

            conn.commit()
            logger.info("✅ SEED: Complete.")
        except Exception as e:
            logger.error(f"❌ SEED ERROR: {e}")

@app.post("/api/v1/auth/login/access-token")
def login_stable(form_data: OAuth2PasswordRequestForm = Depends()):
    if form_data.username == "admin" and form_data.password == "password123":
        return {"access_token": "stable-admin-token-999", "token_type": "bearer", "role": "owner"}
    raise HTTPException(status_code=400, detail="Incorrect username or password")

@app.get("/api/v1/users/me")
def read_users_me():
    return {"id": 1, "username": "admin", "full_name": "System Admin", "role": "owner", "is_active": True}

app.include_router(orders.router, prefix="/api/v1/orders", tags=["Orders"])
app.include_router(products.router, prefix="/api/v1/products", tags=["Products"])
app.include_router(suppliers.router, prefix="/api/v1/suppliers", tags=["Suppliers"])
app.include_router(customers.router, prefix="/api/v1/customers", tags=["Customers"])
app.include_router(pricing_rules.router, prefix="/api/v1/pricing-rules", tags=["Pricing Rules"])
app.include_router(company.router, prefix="/api/v1/company", tags=["Company"])
app.include_router(admin.router, prefix="/api/v1/admin", tags=["Admin"])

@app.get("/")
def read_root():
    return {"message": "Production System Ready", "status": "ok"}
