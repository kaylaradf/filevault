"""
Blueprint autentikasi.
Menangani register, login, logout, refresh token, dan profil user.
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    get_jwt,
    get_jwt_identity,
    jwt_required,
)
import bcrypt

from utils import db

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


@auth_bp.route("/register", methods=["POST"])
def register():
    """Mendaftarkan user baru dengan role default 'user'."""
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Body request harus berupa JSON."}), 400

    username = (data.get("username") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    # Validasi input
    if not username or not email or not password:
        return jsonify({"error": "Username, email, dan password wajib diisi."}), 400

    if len(username) < 3 or len(username) > 50:
        return jsonify({"error": "Username harus 3-50 karakter."}), 400

    if len(password) < 6:
        return jsonify({"error": "Password minimal 6 karakter."}), 400

    if "@" not in email or "." not in email:
        return jsonify({"error": "Format email tidak valid."}), 400

    # Cek duplikat
    existing = db.fetch_one(
        "SELECT id FROM users WHERE username = %s OR email = %s",
        (username, email),
    )
    if existing:
        return jsonify({"error": "Username atau email sudah terdaftar."}), 409

    # Hash password dan simpan
    password_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    db.execute(
        "INSERT INTO users (username, email, password_hash, role) VALUES (%s, %s, %s, 'user')",
        (username, email, password_hash),
    )

    return jsonify({"message": "Registrasi berhasil."}), 201


@auth_bp.route("/login", methods=["POST"])
def login():
    """Login user dan mengembalikan access_token serta refresh_token."""
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Body request harus berupa JSON."}), 400

    username = (data.get("username") or "").strip()
    password = data.get("password") or ""

    if not username or not password:
        return jsonify({"error": "Username dan password wajib diisi."}), 400

    # Cari user
    user = db.fetch_one(
        "SELECT id, username, email, password_hash, role FROM users WHERE username = %s",
        (username,),
    )
    if not user:
        return jsonify({"error": "Username atau password salah."}), 401

    # Verifikasi password
    if not bcrypt.checkpw(password.encode("utf-8"), user["password_hash"].encode("utf-8")):
        return jsonify({"error": "Username atau password salah."}), 401

    # Buat token dengan claims tambahan (role)
    additional_claims = {"role": user["role"], "username": user["username"]}
    access_token = create_access_token(
        identity=str(user["id"]),
        additional_claims=additional_claims,
    )
    refresh_token = create_refresh_token(
        identity=str(user["id"]),
        additional_claims=additional_claims,
    )

    return jsonify({
        "message": "Login berhasil.",
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user": {
            "id": user["id"],
            "username": user["username"],
            "email": user["email"],
            "role": user["role"],
        },
    }), 200


@auth_bp.route("/refresh", methods=["POST"])
@jwt_required(refresh=True)
def refresh():
    """Membuat access token baru menggunakan refresh token yang valid."""
    identity = get_jwt_identity()

    # Ambil data user terbaru dari DB untuk memastikan role masih valid
    user = db.fetch_one("SELECT id, username, role FROM users WHERE id = %s", (identity,))
    if not user:
        return jsonify({"error": "User tidak ditemukan."}), 404

    additional_claims = {"role": user["role"], "username": user["username"]}
    new_access_token = create_access_token(
        identity=identity,
        additional_claims=additional_claims,
    )

    return jsonify({"access_token": new_access_token}), 200


@auth_bp.route("/logout", methods=["POST"])
@jwt_required()
def logout():
    """Logout dengan menambahkan JTI token ke blocklist."""
    jti = get_jwt()["jti"]
    db.execute("INSERT INTO token_blocklist (jti) VALUES (%s)", (jti,))
    return jsonify({"message": "Logout berhasil."}), 200


@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def me():
    """Mengembalikan data profil user yang sedang login."""
    identity = get_jwt_identity()
    user = db.fetch_one(
        "SELECT id, username, email, role, created_at FROM users WHERE id = %s",
        (identity,),
    )
    if not user:
        return jsonify({"error": "User tidak ditemukan."}), 404

    user["created_at"] = user["created_at"].isoformat() if user["created_at"] else None

    return jsonify({"user": user}), 200
