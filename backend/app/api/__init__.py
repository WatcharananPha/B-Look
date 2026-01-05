# backend/app/api/__init__.py

from fastapi import APIRouter
# ลบ 'users' ออกจากบรรทัดนี้
from app.api import auth, orders, products, customers, suppliers, admin, pricing_rules, company 

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
# api_router.include_router(users.router, prefix="/users", tags=["users"]) # Comment หรือลบทิ้งถ้าไม่มีไฟล์ users.py
api_router.include_router(orders.router, prefix="/orders", tags=["orders"])
api_router.include_router(products.router, prefix="/products", tags=["products"])
api_router.include_router(customers.router, prefix="/customers", tags=["customers"])
api_router.include_router(suppliers.router, prefix="/suppliers", tags=["suppliers"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
api_router.include_router(pricing_rules.router, prefix="/pricing-rules", tags=["pricing"])
api_router.include_router(company.router, prefix="/company", tags=["company"])