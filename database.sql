-- ============================================
-- File Manager Database Schema
-- Database: MariaDB
-- ============================================

CREATE DATABASE IF NOT EXISTS filemanager
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE filemanager;

-- --------------------------------------------
-- Tabel Users
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    username    VARCHAR(50)  NOT NULL UNIQUE,
    email       VARCHAR(120) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role        ENUM('admin', 'user') NOT NULL DEFAULT 'user',
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- --------------------------------------------
-- Tabel Files
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS files (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    filename      VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_size     BIGINT       NOT NULL DEFAULT 0,
    mime_type     VARCHAR(100) NOT NULL DEFAULT 'application/octet-stream',
    uploader_id   INT          NOT NULL,
    uploaded_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (uploader_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- --------------------------------------------
-- Tabel Token Blocklist (untuk revoke JWT)
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS token_blocklist (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    jti        VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_jti (jti)
) ENGINE=InnoDB;

-- --------------------------------------------
-- Default Admin Account
-- Username : admin
-- Password : admin123 (bcrypt hashed)
-- GANTI PASSWORD SETELAH LOGIN PERTAMA!
-- --------------------------------------------
-- Catatan: hash di bawah adalah bcrypt hash dari 'admin123'
-- Jika hash ini tidak bekerja, gunakan script Python:
--   import bcrypt
--   print(bcrypt.hashpw(b'admin123', bcrypt.gensalt()).decode())
INSERT INTO users (username, email, password_hash, role) VALUES
    ('admin', 'admin@filemanager.local',
     '$2b$12$SRgurQ.pQ/rI0bjp2.4KKO1yQ/SraljYKp3auewIqY.q3LW757f2q',
     'admin')
ON DUPLICATE KEY UPDATE username = username;
