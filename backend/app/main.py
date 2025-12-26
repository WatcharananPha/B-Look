from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import auth, orders, products # <--- Import ตรงนี้ต้องมีไฟล์ครบ
from app.db.base import Base
from app.db.session import engine

app = FastAPI(title="B-Look OMS API")

# CORS Setup (เพื่อให้ Frontend เชื่อมต่อได้)
origins = ["http://localhost:5173", "http://localhost:3000"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Register Routes ---
# เชื่อมต่อ API แต่ละไฟล์เข้ากับระบบหลัก
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(orders.router, prefix="/api/v1/orders", tags=["Orders"])
app.include_router(products.router, prefix="/api/v1/products", tags=["Products"]) # <--- เพิ่มบรรทัดนี้

@app.get("/")
def read_root():
    return {"message": "Welcome to B-Look API Server", "status": "running"}