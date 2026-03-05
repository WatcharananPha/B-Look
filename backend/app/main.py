from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from passlib.context import CryptContext
import logging
import os

from app.db.session import engine, SessionLocal
from app.db.base import Base
from app.core.config import settings
from fastapi.staticfiles import StaticFiles

# Import Router
from app.api import (
    auth, orders, products, suppliers, customers,
    pricing_rules, company, pricing, admin, public
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- SYSTEM AUTO-REPAIR: Reset Admin on Startup ---
@app.on_event("startup")
def startup_repair():
    try:
        # Create tables first if SQLite
        if "sqlite" in settings.DATABASE_URL:
            Base.metadata.create_all(bind=engine)
            
        db = SessionLocal()
        
        pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        # สร้าง Hash ของคำว่า password123
        hashed_pw = pwd_context.hash("password123")

        # เช็คว่ามี admin อยู่หรือยัง
        result = db.execute(text("SELECT id FROM users WHERE username = 'admin'")).first()

        if not result:
            logger.warning("⚠️ Admin not found. Creating new admin...")
            sql = text(
                "INSERT INTO users (username, password_hash, full_name, role, is_active) "
                "VALUES ('admin', :h, 'System Admin', 'owner', true)"
            )
            db.execute(sql, {"h": hashed_pw})
        else:
            logger.info("♻️ Admin exists. Resetting password to 'password123'...")
            sql = text(
                "UPDATE users SET password_hash = :h, is_active = true WHERE username = 'admin'"
            )
            db.execute(sql, {"h": hashed_pw})

        db.commit()
        db.close()
        logger.info("✅ SYSTEM READY: Login with 'admin' / 'password123'")
    except Exception as e:
        logger.error(f"❌ Startup Repair Failed: {e}")

app = FastAPI(title="B-Look OMS API")

origins = [str(origin).strip().rstrip("/") for origin in settings.CORS_ORIGINS] if settings.CORS_ORIGINS else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs(settings.STATIC_DIR + "/slips", exist_ok=True)
os.makedirs(settings.STATIC_DIR + "/mockups", exist_ok=True)

app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(orders.router, prefix="/api/v1/orders", tags=["Orders"])
app.include_router(products.router, prefix="/api/v1/products", tags=["Products"])
app.include_router(suppliers.router, prefix="/api/v1/suppliers", tags=["Suppliers"])
app.include_router(customers.router, prefix="/api/v1/customers", tags=["Customers"])
app.include_router(pricing_rules.router, prefix="/api/v1/pricing-rules", tags=["Pricing Rules"])
app.include_router(pricing.router, prefix="/api/v1/pricing", tags=["Pricing"])
app.include_router(company.router, prefix="/api/v1/company", tags=["Company"])
app.include_router(admin.router, prefix="/api/v1/admin", tags=["Admin"])
app.include_router(public.router, prefix="/api/v1/public", tags=["Public"])

app.mount("/static", StaticFiles(directory=settings.STATIC_DIR), name="static")

@app.get("/")
def read_root():
    return {"status": "online", "message": "B-Look API is running correctly."}
