"""
Blueprint admin.
Menangani manajemen user (list, tambah, ubah role, hapus) — hanya untuk admin.
"""

import bcrypt
from flask import Blueprint, request, jsonify
from flask_jwt_extended import get_jwt_identity, jwt_required

from utils import db
from utils.rbac import role_required

admin_bp = Blueprint("admin", __name__, url_prefix="/api/admin")


@admin_bp.route("/users", methods=["GET"])
@role_required("admin")
def list_users():
    """Menampilkan daftar semua user. Hanya admin."""
    users = db.fetch_all(
        "SELECT id, username, email, role, created_at FROM users ORDER BY created_at DESC"
    )
    for u in users:
        if u.get("created_at"):
            u["created_at"] = u["created_at"].isoformat()

    return jsonify({"users": users}), 200


@admin_bp.route("/users", methods=["POST"])
@role_required("admin")
def create_user():
    """Menambahkan user baru oleh admin. Admin bisa menentukan role user yang dibuat."""
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Body request harus berupa JSON."}), 400

    username = (data.get("username") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    role = (data.get("role") or "user").strip().lower()

    # Validasi input
    if not username or not email or not password:
        return jsonify({"error": "Username, email, dan password wajib diisi."}), 400

    if len(username) < 3 or len(username) > 50:
        return jsonify({"error": "Username harus 3-50 karakter."}), 400

    if len(password) < 6:
        return jsonify({"error": "Password minimal 6 karakter."}), 400

    if "@" not in email or "." not in email:
        return jsonify({"error": "Format email tidak valid."}), 400

    if role not in ("admin", "user"):
        return jsonify({"error": "Role harus 'admin' atau 'user'."}), 400

    # Cek duplikat
    existing = db.fetch_one(
        "SELECT id FROM users WHERE username = %s OR email = %s",
        (username, email),
    )
    if existing:
        return jsonify({"error": "Username atau email sudah terdaftar."}), 409

    # Hash password dan simpan
    password_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    new_id = db.execute(
        "INSERT INTO users (username, email, password_hash, role) VALUES (%s, %s, %s, %s)",
        (username, email, password_hash, role),
    )

    return jsonify({
        "message": f"User '{username}' berhasil dibuat dengan role '{role}'.",
        "user": {
            "id": new_id,
            "username": username,
            "email": email,
            "role": role,
        },
    }), 201


@admin_bp.route("/users/<int:user_id>/role", methods=["PUT"])
@role_required("admin")
def update_role(user_id):
    """Mengubah role user. Hanya admin. Tidak bisa mengubah role diri sendiri."""
    current_user_id = get_jwt_identity()
    if str(user_id) == str(current_user_id):
        return jsonify({"error": "Tidak bisa mengubah role diri sendiri."}), 400

    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Body request harus berupa JSON."}), 400

    new_role = (data.get("role") or "").strip().lower()
    if new_role not in ("admin", "user"):
        return jsonify({"error": "Role harus 'admin' atau 'user'."}), 400

    user = db.fetch_one("SELECT id FROM users WHERE id = %s", (user_id,))
    if not user:
        return jsonify({"error": "User tidak ditemukan."}), 404

    db.execute("UPDATE users SET role = %s WHERE id = %s", (new_role, user_id))

    return jsonify({"message": f"Role user berhasil diubah menjadi '{new_role}'."}), 200


@admin_bp.route("/users/<int:user_id>", methods=["DELETE"])
@role_required("admin")
def delete_user(user_id):
    """Menghapus user beserta semua file-nya. Tidak bisa menghapus diri sendiri."""
    current_user_id = get_jwt_identity()
    if str(user_id) == str(current_user_id):
        return jsonify({"error": "Tidak bisa menghapus akun sendiri."}), 400

    user = db.fetch_one("SELECT id FROM users WHERE id = %s", (user_id,))
    if not user:
        return jsonify({"error": "User tidak ditemukan."}), 404

    # File akan terhapus otomatis via ON DELETE CASCADE
    db.execute("DELETE FROM users WHERE id = %s", (user_id,))

    return jsonify({"message": "User berhasil dihapus."}), 200
