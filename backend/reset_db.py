import sys
import os
# Add path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.session import engine
from app.db.base import Base

# Import all models to ensure metadata is populated
# (Order matters somewhat, but drop_all handles dependencies)
from app.models import user, customer, order, product, supplier, company, pricing_rule

def reset_database():
    print("💣 Dropping all tables...")
    Base.metadata.drop_all(bind=engine)
    print("✅ All tables dropped.")

if __name__ == "__main__":
    reset_database()