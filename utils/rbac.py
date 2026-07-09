"""
Modul RBAC (Role-Based Access Control).
Menyediakan decorator untuk memvalidasi role dan permission dari JWT claims.
"""

from functools import wraps
from flask import jsonify
from flask_jwt_extended import get_jwt, verify_jwt_in_request

# Mapping permission per role
ROLE_PERMISSIONS = {
    "admin": {
        "file:upload", "file:download_own", "file:download_all",
        "file:delete_own", "file:delete_all", "file:list_all",
        "user:list", "user:create", "user:update_role", "user:delete",
    },
    "user": {
        "file:upload", "file:download_own",
        "file:delete_own", "file:list_own",
    },
}


def role_required(*allowed_roles):
    """Decorator yang membatasi akses hanya untuk role tertentu.

    Args:
        *allowed_roles: Satu atau lebih role yang diizinkan (misal: 'admin', 'user').

    Returns:
        403 Forbidden jika role user tidak termasuk dalam allowed_roles.
    """
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            claims = get_jwt()
            user_role = claims.get("role", "")

            if user_role not in allowed_roles:
                return jsonify({"error": "Akses ditolak. Role tidak memiliki izin."}), 403

            return fn(*args, **kwargs)
        return wrapper
    return decorator


def permission_required(permission):
    """Decorator yang memeriksa apakah user memiliki permission tertentu berdasarkan role.

    Args:
        permission: String permission yang dibutuhkan (misal: 'file:upload').

    Returns:
        403 Forbidden jika role user tidak memiliki permission tersebut.
    """
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            claims = get_jwt()
            user_role = claims.get("role", "")
            user_permissions = ROLE_PERMISSIONS.get(user_role, set())

            if permission not in user_permissions:
                return jsonify({"error": "Akses ditolak. Permission tidak mencukupi."}), 403

            return fn(*args, **kwargs)
        return wrapper
    return decorator


def has_permission(role, permission):
    """Mengecek apakah sebuah role memiliki permission tertentu.

    Args:
        role: Nama role (misal: 'admin').
        permission: Nama permission (misal: 'file:delete_all').

    Returns:
        True jika role memiliki permission, False jika tidak.
    """
    return permission in ROLE_PERMISSIONS.get(role, set())
