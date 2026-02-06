from fastapi import FastAPI, Request, status, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError
import logging

from app.db.session import engine
from app.db.base import Base

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


# Global OPTIONS handler to ensure preflight requests receive CORS headers
@app.options("/{rest_of_path:path}")
def preflight_handler(rest_of_path: str, request: Request):
    headers = {
        "Access-Control-Allow-Origin": "https://blook8238663284.z23.web.core.windows.net",
        "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
        "Access-Control-Allow-Credentials": "true",
    }
    return Response(status_code=200, headers=headers)


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


# Hardcoded CORS origins to ensure deployed service always allows the frontend
origins = [
    "http://localhost",
    "http://localhost:8000",
    "http://localhost:5173",
    "https://blook8238663284.z23.web.core.windows.net",
    "https://blook8238663284.z23.web.core.windows.net/",
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
