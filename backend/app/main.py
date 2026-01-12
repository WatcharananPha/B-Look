from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.db.session import engine
from app.db.base import Base

# 1. Import Models first (Register with SQLAlchemy)
from app.models import User, Customer, Order, OrderItem, FabricType

# 2. Create Tables
Base.metadata.create_all(bind=engine)

# 3. Import APIs
from app.api import auth, orders, products

app = FastAPI(title="B-Look OMS API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(orders.router, prefix="/api/v1/orders", tags=["Orders"])
app.include_router(products.router, prefix="/api/v1/products", tags=["Products"])

@app.get("/")
def read_root():
    return {"status": "ok"}
