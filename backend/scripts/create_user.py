#!/usr/bin/env python3
"""Create a simple admin user in the app database for local testing.

Usage:
  ./create_user.py USERNAME PASSWORD

Run from repo root with the project's virtualenv/python, e.g.
  ./blook/bin/python backend/scripts/create_user.py admin admin
"""
import sys

from app.db.session import SessionLocal
from app.models.user import User
from app.core import security


def main():
    if len(sys.argv) < 3:
        print("Usage: create_user.py USERNAME PASSWORD")
        sys.exit(1)

    username = sys.argv[1]
    password = sys.argv[2]

    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.username == username).first()
        if existing:
            print(f"User '{username}' already exists.\n")
            return

        hashed = security.pwd_context.hash(password)
        user = User(username=username, password_hash=hashed, full_name=username, role="admin")
        db.add(user)
        db.commit()
        print(f"Created user '{username}'")
    finally:
        db.close()


if __name__ == "__main__":
    main()
