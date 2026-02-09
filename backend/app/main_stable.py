from fastapi import FastAPI, Request, status, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text, inspect
from app.db.base_class import Base
from app.db.session import engine, SessionLocal
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
            logger.info("🧹 SEED: Clearing and Inserting Neck Types...")
            # 1. ล้างข้อมูลเก่าทิ้ง (ตามคำสั่ง)
            conn.execute(text("DELETE FROM fabric_types"))
            conn.execute(text("DELETE FROM sleeve_types"))
            conn.execute(text("DELETE FROM neck_types"))
            
            # 2. ใส่ข้อมูลคอใหม่ (ใช้ชื่อสั้น เพื่อไม่ให้ UI แสดงชื่อซ้ำซ้อน)
            # Backend จะรู้เองว่าเป็นคอพิเศษจากชื่อเหล่านี้
            neck_list = [
                "คอกลม", "คอวีชน", "คอวีไขว้", "คอวีตัด", "คอวีปก", "คอห้าเหลี่ยม",
                "คอปกคางหมู (มีลิ้น)", 
                "คอหยดนํ้า",
                "คอห้าเหลี่ยมคางหมู (มีลิ้น)",
                "คอห้าเหลี่ยมคางหมู (ไม่มีลื่น)",
                "คอจีน", "คอวีปก (มีลิ้น)", "คอโปโล", "คอวาย", "คอเชิ้ตฐานตั้ง"
            ]
            
            # คอที่ต้องราคา 340 (บังคับไหล่สโลป)
            special_necks = ["คอปกคางหมู", "คอหยด", "คอห้าเหลี่ยมคางหมู"]

            for name in neck_list:
                is_special = any(x in name for x in special_necks)
                # force_slope=1 เพื่อให้ Frontend รู้ว่าต้องติ๊กถูก
                force_slope_flag = 1 if is_special else 0
                # For special necks we set a 40 THB adjustment so sale/unit is 340 (base 300 + 40)
                price_adj = 40 if is_special else 0
                cost_price = 40 if is_special else 0
                conn.execute(text("""
                    INSERT INTO neck_types 
                    (name, price_adjustment, additional_cost, force_slope, is_active, quantity, cost_price)
                    VALUES (:n, :pa, 0, :fs, 1, 0, :cp)
                """), {"n": name, "fs": force_slope_flag, "pa": price_adj, "cp": cost_price})
            
            # Admin User
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
