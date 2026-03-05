from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
import logging
import os
from app.db.session import engine, SessionLocal
from app.db.base import Base
from app.core.config import settings
from fastapi.staticfiles import StaticFiles
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
    public,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

try:
    is_sqlite = (
        getattr(settings, "DATABASE_URL", "").startswith("sqlite")
        or getattr(engine, "dialect", None)
        and getattr(engine.dialect, "name", "") == "sqlite"
    )
except Exception:
    is_sqlite = False

if is_sqlite:
    logger.info(
        "create_all(): detected sqlite - running metadata.create_all() for dev environment"
    )
    Base.metadata.create_all(bind=engine)
else:
    logger.info("Skipping create_all(): not running in sqlite dev environment")

app = FastAPI(title="B-Look OMS API (Production)")

origins = settings.CORS_ORIGINS

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


os.makedirs(os.path.join(settings.STATIC_DIR, "slips"), exist_ok=True)
os.makedirs(os.path.join(settings.STATIC_DIR, "mockups"), exist_ok=True)

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
app.include_router(public.router, prefix="/api/v1/public", tags=["Public"])

app.mount("/static", StaticFiles(directory=settings.STATIC_DIR), name="static")


app.include_router(emergency.router, prefix="/api/v1/emergency", tags=["Emergency"])


@app.get("/")
def read_root():
    return {
        "status": "online",
        "message": "B-Look API is running correctly.",
        "version": "2026.02.08.Fix",
    }
