from flask import Blueprint, jsonify

from ..db import get_db
from ..utils import serialize_site_settings


bp = Blueprint("settings", __name__)


@bp.get("/settings")
def get_site_settings():
    row = get_db().execute(
        "SELECT * FROM site_settings WHERE id = 1"
    ).fetchone()
    return jsonify({"settings": serialize_site_settings(row)})
