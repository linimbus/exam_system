import os
from pathlib import Path

from flask import Flask, jsonify
from flask_cors import CORS
from werkzeug.exceptions import HTTPException

from .db import init_app as init_db_app
from .utils import ApiError, error_response


BASE_DIR = Path(__file__).resolve().parent.parent


def create_app(test_config=None):
    app = Flask(__name__)

    default_database = BASE_DIR / "data" / "exam.db"
    origins = os.environ.get(
        "EXAM_CORS_ORIGINS",
        "http://localhost:8000,http://127.0.0.1:8000,"
        "http://localhost:5173,http://127.0.0.1:5173",
    )

    app.config.from_mapping(
        DATABASE=os.environ.get("EXAM_DATABASE", str(default_database)),
        SECRET_KEY=os.environ.get(
            "EXAM_SECRET_KEY", "dev-only-secret-change-me-before-production"
        ),
        TOKEN_MAX_AGE=int(os.environ.get("EXAM_TOKEN_MAX_AGE", 60 * 60 * 24 * 7)),
        ADMIN_USERNAME=os.environ.get("EXAM_ADMIN_USERNAME", "admin"),
        ADMIN_PASSWORD=os.environ.get("EXAM_ADMIN_PASSWORD", "admin123"),
        SEED_DEMO_DATA=os.environ.get("EXAM_SEED_DEMO", "1") != "0",
        CORS_ORIGINS=[item.strip() for item in origins.split(",") if item.strip()],
        MAX_CONTENT_LENGTH=2 * 1024 * 1024,
    )

    if test_config:
        app.config.update(test_config)

    database = app.config["DATABASE"]
    if database != ":memory:":
        Path(database).expanduser().resolve().parent.mkdir(parents=True, exist_ok=True)

    CORS(
        app,
        resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}},
        allow_headers=["Content-Type", "Authorization"],
        methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    )

    from .routes.auth_routes import bp as auth_bp
    from .routes.subjects import bp as subjects_bp
    from .routes.admin import bp as admin_bp
    from .routes.exams import bp as exams_bp
    from .routes.stats import bp as stats_bp
    from .routes.settings import bp as settings_bp

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(subjects_bp, url_prefix="/api")
    app.register_blueprint(admin_bp, url_prefix="/api/admin")
    app.register_blueprint(exams_bp, url_prefix="/api")
    app.register_blueprint(stats_bp, url_prefix="/api")
    app.register_blueprint(settings_bp, url_prefix="/api")

    @app.errorhandler(ApiError)
    def handle_api_error(error):
        return error_response(error)

    @app.errorhandler(HTTPException)
    def handle_http_error(error):
        return jsonify({"error": error.description}), error.code

    @app.get("/api/health")
    def health():
        return jsonify({"status": "ok"})

    init_db_app(app)
    return app
