from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import auth, orders, products
from app.db.session import engine
from app.db.base import Base

# Create Tables (Optional check)
Base.metadata.create_all(bind=engine)

app = FastAPI(title="B-Look OMS API")

# CORS
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

# Debug: Print Routes on Startup
@app.on_event("startup")
async def startup_event():
    print("\n🚀 Registered Routes:")
    for route in app.routes:
        if hasattr(route, "methods"):
            print(f"   - {route.path} {route.methods}")
    print("\n")
