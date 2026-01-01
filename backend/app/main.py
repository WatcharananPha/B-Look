from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# --- 1. Load Database & Models FIRST (Critical Order) ---
from app.db.session import engine
# Import Base from 'app.db.base' which acts as a Central Registry
# (It already imports User, Customer, Order, Products, Suppliers, Admin Models, etc.)
from app.db.base import Base

# --- 2. Create Tables ---
# This will create all tables defined in app.db.base imports
Base.metadata.create_all(bind=engine)

# --- 3. Import APIs AFTER Models are loaded ---
# Ensure you have created 'app/api/admin.py' as per previous instructions
from app.api import auth, orders, products, suppliers, admin

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

# --- 5. Register Routers ---
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(orders.router, prefix="/api/v1/orders", tags=["Orders"])
app.include_router(products.router, prefix="/api/v1/products", tags=["Products & Config"])
app.include_router(suppliers.router, prefix="/api/v1/suppliers", tags=["Suppliers"])
app.include_router(admin.router, prefix="/api/v1/admin", tags=["Admin & Settings"])

@app.get("/")
def read_root():
    return {"message": "Welcome to B-Look API Server", "status": "running"}

# --- Debug: Print Routes on Startup ---
@app.on_event("startup")
async def startup_event():
    print("\n🚀 Registered Routes:")
    for route in app.routes:
        if hasattr(route, "methods"):
            print(f"   - {route.path} {route.methods}")
    print("\n")