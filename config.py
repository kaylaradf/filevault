"""
Konfigurasi aplikasi.
Memuat environment variables dari file .env dan menyediakan config object.
"""

import os
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()


class Config:
    """Konfigurasi utama aplikasi dari environment variables."""

    # Flask
    SECRET_KEY = os.environ.get("FLASK_SECRET_KEY", os.urandom(32).hex())
    DEBUG = os.environ.get("FLASK_DEBUG", "False").lower() in ("true", "1")

    # JWT
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", os.urandom(32).hex())
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=30)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=7)
    JWT_TOKEN_LOCATION = ["headers"]
    JWT_HEADER_NAME = "Authorization"
    JWT_HEADER_TYPE = "Bearer"
    JWT_CSRF_CHECK = False  # CSRF tidak diperlukan karena token via headers, bukan cookies

    # Database (MariaDB)
    DB_HOST = os.environ.get("DB_HOST", "127.0.0.1")
    DB_PORT = int(os.environ.get("DB_PORT", 3306))
    DB_USER = os.environ.get("DB_USER", "root")
    DB_PASSWORD = os.environ.get("DB_PASSWORD", "")
    DB_NAME = os.environ.get("DB_NAME", "filemanager")

    # File Upload
    UPLOAD_FOLDER = os.environ.get("UPLOAD_FOLDER", "uploads")
    MAX_FILE_SIZE_MB = int(os.environ.get("MAX_FILE_SIZE_MB", 50))
    MAX_CONTENT_LENGTH = MAX_FILE_SIZE_MB * 1024 * 1024

    ALLOWED_EXTENSIONS = {
        "txt", "pdf", "png", "jpg", "jpeg", "gif", "bmp",
        "doc", "docx", "xls", "xlsx", "ppt", "pptx",
        "zip", "rar", "7z", "csv", "json", "xml",
        "mp3", "mp4", "wav", "avi", "mkv", "svg",
    }
