"""
Script utilitas untuk menggenerate hash bcrypt.
Jalankan setelah install requirements: python generate_hash.py
"""

import bcrypt

password = b"admin123"
hashed = bcrypt.hashpw(password, bcrypt.gensalt())
print("Bcrypt hash untuk 'admin123':")
print(hashed.decode())
print()
print("Salin hash di atas ke database.sql jika diperlukan.")
