from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# --- 1. Load Database & Models FIRST (Critical Order) ---
from app.db.session import engine
# Import Base from 'app.db.base' which acts as a Central Registry
# (It already imports User, Customer, Order, Products, Suppliers, etc.)
from app.db.base import Base

# --- 2. Create Tables ---
# This will create all tables defined in app.db.base imports
Base.metadata.create_all(bind=engine)

# --- 3. Import APIs AFTER Models are loaded ---
from app.api import auth, orders, products, suppliers

app = FastAPI(title="B-Look OMS API")

# --- 4. CORS Setup ---
origins = [
    "http://localhost:5173", 
    "http://localhost:3000"
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