from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# --- 1. Load Database & Models FIRST (Critical Order) ---
from app.db.session import engine
from app.db.base import Base
# Import all models to register them with SQLAlchemy Base
from app.models import User, Customer, Order, OrderItem, FabricType

# --- 2. Create Tables ---
Base.metadata.create_all(bind=engine)

# --- 3. Import APIs AFTER Models are loaded ---
from app.api import auth, orders, products

app = FastAPI(title="B-Look OMS API")

# CORS Setup
origins = ["http://localhost:5173", "http://localhost:3000"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register Routers
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(orders.router, prefix="/api/v1/orders", tags=["Orders"])
app.include_router(products.router, prefix="/api/v1/products", tags=["Products"])

@app.get("/")
def read_root():
    return {"message": "Welcome to B-Look API Server", "status": "running"}

@app.on_event("startup")
async def startup_event():
    print("\n🚀 Registered Routes:")
    for route in app.routes:
        if hasattr(route, "methods"):
            print(f"   - {route.path} {route.methods}")
    print("\n")
