#!/usr/bin/env python3
import sqlite3
import os

DB = os.environ.get("DATABASE_PATH", "blook_dev.db")


def main():
    if not os.path.exists(DB):
        print(f"DB file not found: {DB}")
        return
    conn = sqlite3.connect(DB)
    cur = conn.execute("PRAGMA table_info('orders')")
    rows = cur.fetchall()
    if not rows:
        print("No orders table found")
    else:
        for r in rows:
            print(r)
    conn.close()


if __name__ == "__main__":
    main()
