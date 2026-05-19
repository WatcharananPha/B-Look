import sys
from app.db.session import SessionLocal
from app.models.user import User
from app.core import security


def main():
    if len(sys.argv) < 3:
        print("Usage: create_user.py USERNAME PASSWORD [ROLE]")
        sys.exit(1)

    username = sys.argv[1]
    password = sys.argv[2]
    role_arg = sys.argv[3] if len(sys.argv) >= 4 else "ADMIN_A"
    role = role_arg.strip().upper() if role_arg else "ADMIN_A"

    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.username == username).first()
        if existing:
            print(f"User '{username}' already exists.\n")
            return

        hashed = security.pwd_context.hash(password)
        user = User(
            username=username, password_hash=hashed, full_name=username, role=role
        )
        db.add(user)
        db.commit()
        print(f"Created user '{username}'")
    finally:
        db.close()


if __name__ == "__main__":
    main()
