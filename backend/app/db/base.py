# backend/app/db/base.py

from app.db.base_class import Base
from app.models.user import User
from app.models.customer import Customer
from app.models.order import Order, OrderItem
from app.models.product import ProductType, FabricType, NeckType, SleeveType, AddOnOption
from app.models.supplier import Supplier
# --- แก้ไขบรรทัดนี้: ลบ PriceTier ออก ---
from app.models.pricing_rule import PricingRule, ShippingRate 
# -------------------------------------
from app.models.company import CompanyInfo
# อย่าลืมบรรทัดนี้ ถ้าสร้างไฟล์ audit_log.py แล้ว
from app.models.audit_log import AuditLog   