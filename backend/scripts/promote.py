"""Promote a user's role directly in the database (SQLite or Postgres).

Usage (run from the backend/ directory):

    python scripts/promote.py <email> <role>

where <role> is one of: individual | professional | admin

Example:

    python scripts/promote.py admin@example.com admin
    python scripts/promote.py lawyer@example.com professional

This is a convenience for deployment owners who need to bootstrap an
admin/professional account without touching the database by hand. It uses the
same DATABASE_URL as the running app.
"""

from __future__ import annotations

import sys

sys.path.insert(0, "")

from database import SessionLocal  # noqa: E402
from models import User, UserRole  # noqa: E402


def main() -> None:
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)

    email = sys.argv[1].strip().lower()
    role_raw = sys.argv[2].strip().lower()

    valid = {r.value for r in UserRole}
    if role_raw not in valid:
        print(f"Invalid role '{role_raw}'. Choose one of: {', '.join(sorted(valid))}")
        sys.exit(2)

    role = UserRole(role_raw)

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            print(f"No user found with email '{email}'. Create the account first, then run this again.")
            sys.exit(3)

        old = user.role.value
        user.role = role
        db.commit()
        print(f"OK: {email} role changed from '{old}' to '{role.value}'.")
    finally:
        db.close()


if __name__ == "__main__":
    main()