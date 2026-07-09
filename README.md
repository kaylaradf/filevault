# FileVault

Aplikasi manajemen file berbasis web dengan REST API menggunakan Flask, JWT Authentication, dan Role-Based Access Control (RBAC). User dapat mengupload, mendownload, dan menghapus file. Admin memiliki kontrol penuh terhadap semua file dan manajemen user.

---

## Fitur

- Autentikasi JWT (Access Token + Refresh Token)
- Token blocklist untuk logout yang aman
- Role-Based Access Control (RBAC): `admin` dan `user`
- Upload, download, dan hapus file
- Admin dapat mengelola semua user dan file
- Password di-hash menggunakan bcrypt
- Validasi ekstensi dan ukuran file
- Frontend sederhana berbasis HTML/CSS/JS

---

## Teknologi

| Komponen | Teknologi |
|---|---|
| Backend | Python, Flask |
| Autentikasi | Flask-JWT-Extended |
| Database | MariaDB (via PyMySQL) |
| Password Hashing | bcrypt |
| Environment | python-dotenv |

---

## Struktur Direktori

```
filevault/
├── routes/
│   ├── auth.py         # Register, login, logout, refresh token, profil
│   ├── files.py        # Upload, download, list, delete file
│   └── admin.py        # Manajemen user (khusus admin)
├── static/
│   ├── css/style.css
│   └── js/app.js
├── templates/
│   └── index.html      # Frontend
├── uploads/            # Folder penyimpanan file yang diupload
├── utils/
│   ├── db.py           # Helper koneksi dan query MariaDB
│   └── rbac.py         # Decorator role_required & permission_required
├── .env                # Environment variables (tidak di-commit)
├── .env.example        # Template environment variables
├── app.py              # Entry point aplikasi
├── config.py           # Konfigurasi dari environment variables
├── database.sql        # Schema database dan data awal
├── generate_hash.py    # Utility generate bcrypt hash
└── requirements.txt    # Dependensi Python
```

---

## Instalasi & Setup

### 1. Clone Repository

```bash
git clone https://github.com/<username>/<nama-repo>.git
cd filevault
```

### 2. Buat Virtual Environment

```bash
python -m venv .venv
```

Aktivasi:
- Windows: `.venv\Scripts\activate`
- Linux/macOS: `source .venv/bin/activate`

### 3. Install Dependensi

```bash
pip install -r requirements.txt
```

### 4. Konfigurasi Environment

Salin file `.env.example` menjadi `.env`:

```bash
cp .env.example .env
```

Isi file `.env`:

```env
# Flask
FLASK_SECRET_KEY=ganti-dengan-random-string-panjang
FLASK_DEBUG=True

# JWT
JWT_SECRET_KEY=ganti-dengan-random-string-berbeda

# Database (MariaDB)
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=filemanager

# File Upload
UPLOAD_FOLDER=uploads
MAX_FILE_SIZE_MB=50
```

> **Penting:** Gunakan nilai `FLASK_SECRET_KEY` dan `JWT_SECRET_KEY` yang berbeda dan acak. Jangan gunakan nilai default di production.

### 5. Setup Database

Pastikan MariaDB sudah berjalan, lalu jalankan script SQL:

```bash
mysql -u root -p < database.sql
```

Script ini akan:
- Membuat database `filemanager`
- Membuat tabel `users`, `files`, dan `token_blocklist`
- Membuat akun admin default

**Akun Admin Default:**
| Field | Value |
|---|---|
| Username | `admin` |
| Password | `admin123` |
| Role | `admin` |

> **Ganti password admin setelah login pertama!**

### 6. Jalankan Aplikasi

```bash
python app.py
```

Aplikasi berjalan di: `http://localhost:5000`

---

## API Reference

Semua endpoint API menggunakan prefix `/api`. Request body menggunakan format JSON kecuali upload file (multipart/form-data).

### Autentikasi

Header untuk endpoint yang membutuhkan token:
```
Authorization: Bearer <access_token>
```

---

### Auth Endpoints

#### Register
```
POST /api/auth/register
```
Body:
```json
{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "password123"
}
```
Response `201`:
```json
{ "message": "Registrasi berhasil." }
```

---

#### Login
```
POST /api/auth/login
```
Body:
```json
{
  "username": "johndoe",
  "password": "password123"
}
```
Response `200`:
```json
{
  "message": "Login berhasil.",
  "access_token": "<token>",
  "refresh_token": "<token>",
  "user": {
    "id": 1,
    "username": "johndoe",
    "email": "john@example.com",
    "role": "user"
  }
}
```

---

#### Refresh Token
```
POST /api/auth/refresh
```
Header: `Authorization: Bearer <refresh_token>`

Response `200`:
```json
{ "access_token": "<token_baru>" }
```

---

#### Logout
```
POST /api/auth/logout
```
Header: `Authorization: Bearer <access_token>`

Response `200`:
```json
{ "message": "Logout berhasil." }
```

---

#### Profil User
```
GET /api/auth/me
```
Header: `Authorization: Bearer <access_token>`

Response `200`:
```json
{
  "user": {
    "id": 1,
    "username": "johndoe",
    "email": "john@example.com",
    "role": "user",
    "created_at": "2024-01-01T00:00:00"
  }
}
```

---

### File Endpoints

#### Upload File
```
POST /api/files/upload
```
Header: `Authorization: Bearer <access_token>`  
Body: `multipart/form-data` dengan field `file`

Response `201`:
```json
{
  "message": "File berhasil diupload.",
  "file": {
    "id": 1,
    "original_name": "dokumen.pdf",
    "file_size": 204800,
    "mime_type": "application/pdf"
  }
}
```

---

#### List File
```
GET /api/files/
```
Header: `Authorization: Bearer <access_token>`

- User biasa: hanya melihat file milik sendiri
- Admin: melihat semua file beserta nama uploader

Response `200`:
```json
{
  "files": [
    {
      "id": 1,
      "original_name": "dokumen.pdf",
      "file_size": 204800,
      "mime_type": "application/pdf",
      "uploaded_at": "2024-01-01T00:00:00",
      "uploader": "johndoe"
    }
  ]
}
```

---

#### Download File
```
GET /api/files/download/<file_id>
```
Header: `Authorization: Bearer <access_token>`

- User biasa: hanya bisa download file milik sendiri
- Admin: bisa download semua file

Response: file binary (attachment)

---

#### Hapus File
```
DELETE /api/files/<file_id>
```
Header: `Authorization: Bearer <access_token>`

- User biasa: hanya bisa hapus file milik sendiri
- Admin: bisa hapus semua file

Response `200`:
```json
{ "message": "File berhasil dihapus." }
```

---

### Admin Endpoints

Semua endpoint admin membutuhkan role `admin`.

#### List Semua User
```
GET /api/admin/users
```

Response `200`:
```json
{
  "users": [
    {
      "id": 1,
      "username": "admin",
      "email": "admin@filemanager.local",
      "role": "admin",
      "created_at": "2024-01-01T00:00:00"
    }
  ]
}
```

---

#### Buat User Baru
```
POST /api/admin/users
```
Body:
```json
{
  "username": "newuser",
  "email": "newuser@example.com",
  "password": "password123",
  "role": "user"
}
```

Response `201`:
```json
{
  "message": "User 'newuser' berhasil dibuat dengan role 'user'.",
  "user": { "id": 2, "username": "newuser", "email": "newuser@example.com", "role": "user" }
}
```

---

#### Ubah Role User
```
PUT /api/admin/users/<user_id>/role
```
Body:
```json
{ "role": "admin" }
```

Response `200`:
```json
{ "message": "Role user berhasil diubah menjadi 'admin'." }
```

---

#### Hapus User
```
DELETE /api/admin/users/<user_id>
```

Response `200`:
```json
{ "message": "User berhasil dihapus." }
```

> Menghapus user akan otomatis menghapus semua file miliknya (CASCADE).

---

## RBAC — Hak Akses per Role

| Permission | admin | user |
|---|:---:|:---:|
| Upload file | ✅ | ✅ |
| Download file sendiri | ✅ | ✅ |
| Download semua file | ✅ | ❌ |
| Hapus file sendiri | ✅ | ✅ |
| Hapus semua file | ✅ | ❌ |
| Lihat semua file | ✅ | ❌ |
| Manajemen user | ✅ | ❌ |

---

## Tipe File yang Diizinkan

```
txt, pdf, png, jpg, jpeg, gif, bmp,
doc, docx, xls, xlsx, ppt, pptx,
zip, rar, 7z, csv, json, xml,
mp3, mp4, wav, avi, mkv, svg
```

Ukuran maksimal file: **50 MB** (dapat diubah via `MAX_FILE_SIZE_MB` di `.env`)

---

## JWT Token

| Token | Masa Berlaku |
|---|---|
| Access Token | 30 menit |
| Refresh Token | 7 hari |

- Token dikirim via header `Authorization: Bearer <token>`
- Logout akan memasukkan token ke blocklist sehingga tidak bisa digunakan kembali
- Gunakan endpoint `/api/auth/refresh` untuk mendapatkan access token baru tanpa login ulang

---

## Catatan Keamanan

- Jangan commit file `.env` ke repository (sudah ada di `.gitignore`)
- Ganti password admin default segera setelah setup
- Gunakan `FLASK_DEBUG=False` di environment production
- Gunakan secret key yang panjang dan acak untuk `FLASK_SECRET_KEY` dan `JWT_SECRET_KEY`
