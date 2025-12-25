from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import auth, orders, products
from app.db.base import Base
from app.db.session import engine

# Create DB Tables (For dev/prototype only - use Alembic for production)
Base.metadata.create_all(bind=engine)

app = FastAPI(title="B-Look Order Management System")

# CORS Setup (Allow Frontend connection)
origins = ["http://localhost:5173", "http://localhost:3000"] # React/Vite ports
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
app.include_router(orders.router, prefix="/api/v1/orders", tags=["Orders"])
# app.include_router(auth.router, prefix="/api/v1/auth", tags=["Auth"])

@app.get("/")
def read_root():
    return {"message": "Welcome to B-Look API Server"}