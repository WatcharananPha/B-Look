from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from contextlib import asynccontextmanager
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
    notifications,
    albums,
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


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting %s", settings.PROJECT_NAME)
    # Ensure static directories exist at startup regardless of environment
    for subdir in ("slips", "mockups", "artworks", "print_files", "albums"):
        os.makedirs(os.path.join(settings.STATIC_DIR, subdir), exist_ok=True)

    # Start the background scheduler for smart alerts
    try:
        from app.core.scheduler import start_scheduler

        start_scheduler()
    except Exception:
        logger.exception("Failed to start background scheduler")

    yield
    logger.info("Shutting down %s", settings.PROJECT_NAME)


app = FastAPI(title="B-Look OMS API (Production)", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Health check — required by container orchestrators and load balancers
# ---------------------------------------------------------------------------
@app.get("/health", tags=["Health"], include_in_schema=False)
def health_check():
    """Lightweight liveness probe. Returns 200 when the app is running."""
    return {"status": "ok"}


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
app.include_router(
    notifications.router, prefix="/api/v1/notifications", tags=["Notifications"]
)
app.include_router(albums.router, prefix="/api/v1/orders", tags=["Albums"])

app.mount("/static", StaticFiles(directory=settings.STATIC_DIR), name="static")


@app.get("/")
def read_root():
    return {
        "status": "online",
        "message": "B-Look API is running correctly.",
        "version": "2026.02.08.Fix",
    }
