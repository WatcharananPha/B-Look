from fastapi import APIRouter
from app.api import (
    auth,
    orders,
    products,
    suppliers,
    customers,
    pricing_rules,
    company,
    admin,
    pricing,
    public,
)

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["Auth"])
api_router.include_router(orders.router, prefix="/orders", tags=["Orders"])
api_router.include_router(products.router, prefix="/products", tags=["Products"])
api_router.include_router(suppliers.router, prefix="/suppliers", tags=["Suppliers"])
api_router.include_router(customers.router, prefix="/customers", tags=["Customers"])
api_router.include_router(
    pricing_rules.router, prefix="/pricing-rules", tags=["Pricing Rules"]
)
api_router.include_router(company.router, prefix="/company", tags=["Company"])
api_router.include_router(admin.router, prefix="/admin", tags=["Admin"])
# ✅ Add pricing router
api_router.include_router(pricing.router, prefix="/pricing", tags=["Pricing"])
api_router.include_router(public.router, prefix="/public", tags=["Public"])
