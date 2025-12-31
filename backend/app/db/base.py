# Import Base from base_class to avoid circular imports
from app.db.base_class import Base

# Import all models here so Alembic and Main can see them
# Order matters! Import dependent models first if needed, 
# but usually SQLAlchemy handles string reference fine if all are loaded.
from app.models.user import User
from app.models.customer import Customer
from app.models.product import FabricType
from app.models.order import Order, OrderItem
