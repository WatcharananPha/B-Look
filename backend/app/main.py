from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
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
    company        
)

app = FastAPI(title="B-Look OMS API")

origins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "https://blook-web-app.azurewebsites.net"
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

@app.on_event("startup")
async def startup_event():
    print("\n🚀 Registered Routes:")
    for route in app.routes:
        if hasattr(route, "path"):
            methods = ", ".join(route.methods) if hasattr(route, "methods") else ""
            print(f"   - {route.path} [{methods}]")
    print("\n")