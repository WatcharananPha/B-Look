from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from sqlalchemy import text
from passlib.context import CryptContext
import logging
import os

from app.db.session import engine, SessionLocal
from app.db.base import Base

# Import Router ทั้งหมด
from app.api import (
    auth,
    orders,
    products,
    suppliers,
    customers,
    pricing_rules,
    company,
    pricing,
    admin,
)

# สร้าง Tables (ถ้ายังไม่มี)
Base.metadata.create_all(bind=engine)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="B-Look OMS API (Production)")

# --- CORS CONFIG (เปิดกว้างเพื่อให้แน่ใจว่า Frontend เข้าถึงได้) ---
origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- SYSTEM AUTO-REPAIR: Reset Admin on Startup ---
@app.on_event("startup")
def startup_repair():
    try:
        db = SessionLocal()
        # 1. เช็คว่ามี admin ไหม
        result = db.execute(
            text("SELECT id FROM users WHERE username = 'admin'")
        ).first()

        pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        hashed_pw = pwd_context.hash("password123")

        if not result:
            logger.warning("⚠️ Admin not found. Creating new admin...")
            sql = text(
                """
                INSERT INTO users (username, password_hash, full_name, role, is_active)
                VALUES ('admin', :h, 'System Admin', 'owner', true)
            """
            )
            db.execute(sql, {"h": hashed_pw})
        else:
            logger.info("♻️ Admin exists. Resetting password to 'password123'...")
            # บังคับแก้รหัสผ่านให้เป็นค่าที่เรารู้แน่นอน
            sql = text(
                "UPDATE users SET password_hash = :h, is_active = true WHERE username = 'admin'"
            )
            db.execute(sql, {"h": hashed_pw})

        db.commit()
        logger.info("✅ SYSTEM READY: Login with 'admin' / 'password123'")
        # --- DEDUPE: Clean duplicate neck_types entries that may contain UI annotations
        try:
            from app.models.product import NeckType

            rows = db.query(NeckType).all()
            # normalize and group
            import re

            groups = {}
            for r in rows:
                raw_name = r.name or ""
                n = raw_name.replace("นํ้า", "น้ำ")
                n = re.sub(r"\(.*?\)", "", n).strip()
                if not n:
                    continue
                if n not in groups:
                    groups[n] = []
                groups[n].append(r)

            for name_norm, group in groups.items():
                if len(group) <= 1:
                    # ensure stored name is normalized
                    g0 = group[0]
                    if g0.name != name_norm:
                        g0.name = name_norm
                        db.add(g0)
                    continue
                # pick keeper: prefer one with force_slope True, then higher cost_price
                keeper = sorted(
                    group,
                    key=lambda x: (
                        not bool(x.force_slope),
                        -(float(x.cost_price or 0)),
                    ),
                )[0]
                keeper.name = name_norm
                db.add(keeper)
                # delete others
                for rdel in group:
                    if rdel.id == keeper.id:
                        continue
                    try:
                        db.delete(rdel)
                    except Exception:
                        logger.exception("Failed deleting duplicate neck row")
        except Exception:
            logger.exception("Neck dedupe step failed")

        db.commit()
        db.close()
    except Exception as e:
        logger.error(f"❌ Startup Repair Failed: {e}")


# --- ROUTERS ---
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(orders.router, prefix="/api/v1/orders", tags=["Orders"])
app.include_router(products.router, prefix="/api/v1/products", tags=["Products"])
app.include_router(suppliers.router, prefix="/api/v1/suppliers", tags=["Suppliers"])
app.include_router(customers.router, prefix="/api/v1/customers", tags=["Customers"])
app.include_router(
    pricing_rules.router, prefix="/api/v1/pricing-rules", tags=["Pricing Rules"]
)
app.include_router(pricing.router, prefix="/api/v1/pricing", tags=["Pricing"])
app.include_router(company.router, prefix="/api/v1/company", tags=["Company"])
app.include_router(admin.router, prefix="/api/v1/admin", tags=["Admin"])


# --- ROOT ENDPOINT (กัน Error Not Found หน้าแรก) ---
@app.get("/")
def read_root():
    return {
        "status": "online",
        "message": "B-Look API is running correctly.",
        "version": "2026.02.08.Fix",
    }
