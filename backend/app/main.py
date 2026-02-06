from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError
import logging

from app.db.session import engine
from app.db.base import Base
from app.core.config import settings

Base.metadata.create_all(bind=engine)

from app.api import (
    auth,
    orders,
    products,
    suppliers,
    admin,
    customers,
    pricing_rules,
    company,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="B-Look OMS API")


# Add validation error handler
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.error(f"Validation error on {request.method} {request.url}")
    logger.error(f"Request body: {await request.body()}")
    logger.error(f"Validation errors: {exc.errors()}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": exc.errors(), "body": exc.body},
    )


configured = getattr(settings, "BACKEND_CORS_ORIGINS", None)
if configured:
    origins = [str(o) for o in configured]
else:
    origins = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "https://blook-web-app.azurewebsites.net",
    ]

if "*" in origins:
    allow_origins = ["*"]
    allow_credentials = False
else:
    allow_origins = origins
    allow_credentials = True

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(orders.router, prefix="/api/v1/orders", tags=["Orders"])
app.include_router(
    products.router, prefix="/api/v1/products", tags=["Products & Config"]
)
app.include_router(suppliers.router, prefix="/api/v1/suppliers", tags=["Suppliers"])
app.include_router(customers.router, prefix="/api/v1/customers", tags=["Customers"])
app.include_router(
    pricing_rules.router, prefix="/api/v1/pricing-rules", tags=["Pricing Rules"]
)
app.include_router(company.router, prefix="/api/v1/company", tags=["Company"])
app.include_router(admin.router, prefix="/api/v1/admin", tags=["Admin & Settings"])


@app.get("/")
def read_root():
    return {"message": "Welcome to B-Look API Server", "status": "running"}
