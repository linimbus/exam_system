import sqlite3
from pathlib import Path

from flask import current_app, g

from .seed import ensure_admin, seed_demo_data


def get_db():
    if "db" not in g:
        connection = sqlite3.connect(
            current_app.config["DATABASE"],
            detect_types=sqlite3.PARSE_DECLTYPES,
            timeout=15,
        )
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        g.db = connection
    return g.db


def close_db(_error=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def _migrate_schema(db):
    columns = {
        row["name"] for row in db.execute("PRAGMA table_info(users)").fetchall()
    }
    if "nickname" not in columns:
        db.execute(
            "ALTER TABLE users ADD COLUMN nickname TEXT NOT NULL DEFAULT ''"
        )


def init_db():
    db = get_db()
    schema_path = Path(__file__).with_name("schema.sql")
    db.executescript(schema_path.read_text(encoding="utf-8"))
    _migrate_schema(db)
    ensure_admin(
        db,
        current_app.config["ADMIN_USERNAME"],
        current_app.config["ADMIN_PASSWORD"],
    )
    if current_app.config["SEED_DEMO_DATA"]:
        seed_demo_data(db)
    db.commit()


def init_app(app):
    app.teardown_appcontext(close_db)
    with app.app_context():
        init_db()
