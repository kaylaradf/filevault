"""
Blueprint manajemen file.
Menangani upload, download, list, dan delete file dengan RBAC.
"""

import os
import uuid

from flask import Blueprint, request, jsonify, send_from_directory, current_app
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required
from werkzeug.utils import secure_filename

from utils import db
from utils.rbac import permission_required, has_permission

files_bp = Blueprint("files", __name__, url_prefix="/api/files")


def _allowed_extension(filename):
    """Mengecek apakah ekstensi file termasuk dalam daftar yang diizinkan."""
    if "." not in filename:
        return False
    ext = filename.rsplit(".", 1)[1].lower()
    return ext in current_app.config.get("ALLOWED_EXTENSIONS", set())


@files_bp.route("/upload", methods=["POST"])
@permission_required("file:upload")
def upload():
    """Mengupload file baru ke server."""
    if "file" not in request.files:
        return jsonify({"error": "Tidak ada file yang dikirim."}), 400

    file = request.files["file"]
    if file.filename == "" or not file.filename:
        return jsonify({"error": "Nama file kosong."}), 400

    if not _allowed_extension(file.filename):
        return jsonify({"error": "Tipe file tidak diizinkan."}), 400

    # Sanitize dan buat nama unik
    original_name = secure_filename(file.filename)
    ext = original_name.rsplit(".", 1)[1].lower() if "." in original_name else ""
    unique_name = f"{uuid.uuid4().hex}.{ext}" if ext else uuid.uuid4().hex

    # Simpan file
    upload_folder = current_app.config["UPLOAD_FOLDER"]
    os.makedirs(upload_folder, exist_ok=True)
    file_path = os.path.join(upload_folder, unique_name)
    file.save(file_path)

    # Hitung ukuran file
    file_size = os.path.getsize(file_path)
    mime_type = file.content_type or "application/octet-stream"

    # Simpan metadata ke database
    identity = get_jwt_identity()
    file_id = db.execute(
        "INSERT INTO files (filename, original_name, file_size, mime_type, uploader_id) "
        "VALUES (%s, %s, %s, %s, %s)",
        (unique_name, original_name, file_size, mime_type, identity),
    )

    return jsonify({
        "message": "File berhasil diupload.",
        "file": {
            "id": file_id,
            "original_name": original_name,
            "file_size": file_size,
            "mime_type": mime_type,
        },
    }), 201


@files_bp.route("/", methods=["GET"])
@jwt_required()
def list_files():
    """Menampilkan daftar file. User biasa hanya melihat file miliknya, admin melihat semua."""
    identity = get_jwt_identity()
    claims = get_jwt()
    role = claims.get("role", "")

    if has_permission(role, "file:list_all"):
        files = db.fetch_all(
            "SELECT f.id, f.original_name, f.file_size, f.mime_type, f.uploaded_at, "
            "u.username AS uploader "
            "FROM files f JOIN users u ON f.uploader_id = u.id "
            "ORDER BY f.uploaded_at DESC"
        )
    else:
        files = db.fetch_all(
            "SELECT id, original_name, file_size, mime_type, uploaded_at "
            "FROM files WHERE uploader_id = %s ORDER BY uploaded_at DESC",
            (identity,),
        )

    # Serialize datetime
    for f in files:
        if f.get("uploaded_at"):
            f["uploaded_at"] = f["uploaded_at"].isoformat()

    return jsonify({"files": files}), 200


@files_bp.route("/download/<int:file_id>", methods=["GET"])
@jwt_required()
def download(file_id):
    """Mendownload file berdasarkan ID. User biasa hanya bisa download file miliknya."""
    identity = get_jwt_identity()
    claims = get_jwt()
    role = claims.get("role", "")

    file_record = db.fetch_one("SELECT * FROM files WHERE id = %s", (file_id,))
    if not file_record:
        return jsonify({"error": "File tidak ditemukan."}), 404

    # Cek ownership kecuali admin
    if str(file_record["uploader_id"]) != str(identity) and not has_permission(role, "file:download_all"):
        return jsonify({"error": "Akses ditolak. Anda tidak memiliki izin untuk file ini."}), 403

    upload_folder = current_app.config["UPLOAD_FOLDER"]
    return send_from_directory(
        upload_folder,
        file_record["filename"],
        as_attachment=True,
        download_name=file_record["original_name"],
    )


@files_bp.route("/<int:file_id>", methods=["DELETE"])
@jwt_required()
def delete_file(file_id):
    """Menghapus file berdasarkan ID. User biasa hanya bisa hapus file miliknya."""
    identity = get_jwt_identity()
    claims = get_jwt()
    role = claims.get("role", "")

    file_record = db.fetch_one("SELECT * FROM files WHERE id = %s", (file_id,))
    if not file_record:
        return jsonify({"error": "File tidak ditemukan."}), 404

    # Cek ownership kecuali admin
    if str(file_record["uploader_id"]) != str(identity) and not has_permission(role, "file:delete_all"):
        return jsonify({"error": "Akses ditolak. Anda tidak memiliki izin untuk menghapus file ini."}), 403

    # Hapus file fisik
    upload_folder = current_app.config["UPLOAD_FOLDER"]
    file_path = os.path.join(upload_folder, file_record["filename"])
    if os.path.exists(file_path):
        os.remove(file_path)

    # Hapus dari database
    db.execute("DELETE FROM files WHERE id = %s", (file_id,))

    return jsonify({"message": "File berhasil dihapus."}), 200
