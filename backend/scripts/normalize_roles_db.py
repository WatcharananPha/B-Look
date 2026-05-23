"""Normalize user role values in the local database to canonical roles.

Usage: run from repository root with the backend venv Python, for example:
  ../blook/bin/python backend/scripts/normalize_roles_db.py

This script makes a backup copy of the SQLite DB file before modifying it.
"""

import shutil
import os
from app.db.session import SessionLocal
from app.models.user import User
from app.api.rbac import _normalize_role


def backup_db(db_path: str):
    if not os.path.exists(db_path):
        print(f"DB file not found: {db_path}")
        return False
    bak = db_path + ".bak"
    shutil.copy2(db_path, bak)
    print(f"Backup created: {bak}")
    return True


def normalize_all_users():
    db = SessionLocal()
    try:
        users = db.query(User).all()
        changed = 0
        print(f"Found {len(users)} users")
        for u in users:
            old = (u.role or "").strip()
            new = _normalize_role(old)
            if new != old:
                print(f"Updating user {u.id} {u.username}: '{old}' -> '{new}'")
                u.role = new
                db.add(u)
                changed += 1
        if changed:
            db.commit()
            print(f"Committed {changed} role updates")
        else:
            print("No role changes needed")
    finally:
        db.close()


if __name__ == "__main__":
    # Determine DB path from app/db/session.py default env fallback
    # The default DB file is './blook_dev.db' relative to backend/ when running the app.
    db_path = os.getenv("DATABASE_URL")
    if not db_path or db_path.startswith("sqlite:///"):
        # extract file path when using sqlite:///./blook_dev.db or sqlite:////abs/path
        if db_path and db_path.startswith("sqlite:///"):
            path = db_path.replace("sqlite://", "")
        else:
            # default used by session.py
            path = os.path.join(os.path.dirname(__file__), "..", "blook_dev.db")
            path = os.path.normpath(path)
    else:
        # Non-sqlite DB: do not attempt a file backup here
        path = None

    if path:
        print(f"Detected sqlite DB path: {path}")
        ok = backup_db(path)
        if not ok:
            print("Aborting: no DB backup created")
        else:
            normalize_all_users()
    else:
        print(
            "Non-sqlite DATABASE_URL detected; proceeding to update via DB connection"
        )
        normalize_all_users()
