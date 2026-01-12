from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.db.session import engine
from app.db.base import Base
from app.api import auth, orders, products
from app.models import User, Customer, Order, OrderItem, FabricType

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="B-Look API",
    openapi_url="/api/v1/openapi.json"
)

origins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
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
app.include_router(products.router, prefix="/api/v1/products", tags=["Products"])

@app.get("/")
def read_root():
    return {"status": "ok"}
