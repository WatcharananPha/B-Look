# app/db/base.py
from app.db.base_class import Base

# Import models ให้ครบทุกไฟล์ เพื่อให้ Alembic มองเห็น
from app.models.user import User
from app.models.customer import Customer
from app.models.order import Order, OrderItem
# Module 2 Imports
from app.models.product import ProductType, FabricType, NeckType, SleeveType, AddOnOption
from app.models.supplier import Supplier
from app.models.pricing_rule import PriceTier, ShippingRate
from app.models.company import CompanyInfo