"""
Simple maintenance script to normalize existing orders that have legacy status values
(like 'draft') into the canonical workflow states (e.g., 'WAITING_BOOKING').

Usage:
    python backend/scripts/fix_statuses.py

This script uses the project's SQLAlchemy SessionLocal. Make sure your environment
is configured with the correct DATABASE_URL and other settings (use the blook venv).
"""

from app.db.session import SessionLocal
from app.models.order import Order

LEGACY = {"draft", "sp-draft", "sp_draft"}


def main():
    db = SessionLocal()
    try:
        rows = db.query(Order).filter(Order.status != None).all()
        changed = 0
        for r in rows:
            s = (r.status or "").strip()
            if not s:
                continue
            if s.lower() in LEGACY:
                r.status = "WAITING_BOOKING"
                db.add(r)
                changed += 1
        db.commit()
        print(f"Updated {changed} orders to WAITING_BOOKING")
    finally:
        db.close()


if __name__ == "__main__":
    main()
