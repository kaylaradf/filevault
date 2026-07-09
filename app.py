"""
Entry point aplikasi Flask.
Menginisialisasi app, JWT manager, dan mendaftarkan semua blueprint.
"""

import os

from flask import Flask, jsonify, send_from_directory
from flask_jwt_extended import JWTManager

from config import Config
from routes.auth import auth_bp
from routes.files import files_bp
from routes.admin import admin_bp
from utils import db as database


def create_app():
    """Membuat dan mengkonfigurasi instance Flask application."""
    app = Flask(
        __name__,
        static_folder="static",
        template_folder="templates",
    )

    # Load konfigurasi
    app.config.from_object(Config)
    app.config["UPLOAD_FOLDER"] = os.path.abspath(Config.UPLOAD_FOLDER)
    app.config["ALLOWED_EXTENSIONS"] = Config.ALLOWED_EXTENSIONS

    # Buat folder upload jika belum ada
    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

    # Inisialisasi JWT
    jwt = JWTManager(app)

    @jwt.token_in_blocklist_loader
    def check_token_blocklist(_jwt_header, jwt_payload):
        """Mengecek apakah token sudah ada di blocklist (sudah di-logout)."""
        jti = jwt_payload["jti"]
        result = database.fetch_one(
            "SELECT id FROM token_blocklist WHERE jti = %s", (jti,)
        )
        return result is not None

    @jwt.revoked_token_loader
    def revoked_token_response(_jwt_header, _jwt_payload):
        """Response ketika token sudah direvoke."""
        return jsonify({"error": "Token sudah tidak valid (sudah logout)."}), 401

    @jwt.expired_token_loader
    def expired_token_response(_jwt_header, _jwt_payload):
        """Response ketika token sudah expired."""
        return jsonify({"error": "Token sudah kedaluwarsa."}), 401

    @jwt.invalid_token_loader
    def invalid_token_response(error_string):
        """Response ketika token tidak valid (misal: dimanipulasi)."""
        return jsonify({"error": "Token tidak valid.", "detail": error_string}), 422

    @jwt.unauthorized_loader
    def unauthorized_response(error_string):
        """Response ketika tidak ada token di request."""
        return jsonify({"error": "Token diperlukan untuk mengakses resource ini."}), 401

    # Register blueprints
    app.register_blueprint(auth_bp)
    app.register_blueprint(files_bp)
    app.register_blueprint(admin_bp)

    # Serve frontend
    @app.route("/")
    def index():
        """Menampilkan halaman utama (frontend)."""
        return send_from_directory("templates", "index.html")

    @app.route("/favicon.ico")
    def favicon():
        """Mengembalikan 204 untuk favicon request."""
        return "", 204

    return app


if __name__ == "__main__":
    application = create_app()
    application.run(host="0.0.0.0", port=5000, debug=Config.DEBUG)
