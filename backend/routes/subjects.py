from flask import Blueprint, jsonify

from ..auth import login_required
from ..catalog import serialize_subject, subject_rows


bp = Blueprint("subjects", __name__)


@bp.get("/subjects")
@login_required
def list_subjects():
    return jsonify({"items": [serialize_subject(row) for row in subject_rows()]})
