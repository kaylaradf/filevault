"""
Modul database.
Menyediakan koneksi ke MariaDB dan helper functions untuk query.
"""

import pymysql
from config import Config


def get_connection():
    """Membuat dan mengembalikan koneksi baru ke database MariaDB."""
    return pymysql.connect(
        host=Config.DB_HOST,
        port=Config.DB_PORT,
        user=Config.DB_USER,
        password=Config.DB_PASSWORD,
        database=Config.DB_NAME,
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor,
        autocommit=True,
    )


def execute(query, params=None):
    """Mengeksekusi query INSERT/UPDATE/DELETE dan mengembalikan jumlah row yang terpengaruh."""
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(query, params)
            return cursor.lastrowid or cursor.rowcount
    finally:
        conn.close()


def fetch_one(query, params=None):
    """Mengeksekusi query SELECT dan mengembalikan satu baris hasil sebagai dict."""
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(query, params)
            return cursor.fetchone()
    finally:
        conn.close()


def fetch_all(query, params=None):
    """Mengeksekusi query SELECT dan mengembalikan semua baris hasil sebagai list of dict."""
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(query, params)
            return cursor.fetchall()
    finally:
        conn.close()
