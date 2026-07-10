/**
 * File Manager — Frontend Application
 * SPA-like client with JWT token management and RBAC-aware UI.
 */

(function () {
    "use strict";

    /* =============================================
       State & Token Management
       ============================================= */

    /** State aplikasi tersimpan di memory (bukan localStorage) untuk keamanan. */
    const state = {
        accessToken: null,
        refreshToken: null,
        user: null,
        currentPage: "login",
    };

    /* =============================================
       API Helper
       ============================================= */

    /**
     * Melakukan fetch ke API backend dengan auto-attach JWT dan auto-refresh.
     * @param {string} url - Endpoint API.
     * @param {object} options - Fetch options (method, body, headers, dll).
     * @returns {Promise<Response>}
     */
    async function api(url, options = {}) {
        const headers = options.headers || {};

        if (state.accessToken && !headers["Authorization"]) {
            headers["Authorization"] = `Bearer ${state.accessToken}`;
        }

        if (!(options.body instanceof FormData) && options.body) {
            headers["Content-Type"] = "application/json";
        }

        const response = await fetch(url, { ...options, headers });

        // Auto-refresh jika token expired
        if (response.status === 401 && state.refreshToken && !url.includes("/refresh")) {
            const refreshed = await refreshToken();
            if (refreshed) {
                headers["Authorization"] = `Bearer ${state.accessToken}`;
                return fetch(url, { ...options, headers });
            }
        }

        return response;
    }

    /**
     * Memperbarui access token menggunakan refresh token (dengan rotation).
     * Refresh token lama otomatis di-blocklist oleh server, diganti token baru.
     * @returns {Promise<boolean>} True jika berhasil, false jika gagal.
     */
    async function refreshToken() {
        try {
            const res = await fetch("/api/auth/refresh", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${state.refreshToken}`,
                    "Content-Type": "application/json",
                },
            });
            if (res.ok) {
                const data = await res.json();
                state.accessToken = data.access_token;
                state.refreshToken = data.refresh_token;
                return true;
            }
        } catch (_) { /* ignore */ }

        // Refresh gagal → force logout
        logout();
        return false;
    }

    /* =============================================
       Toast Notifications
       ============================================= */

    /**
     * Menampilkan notifikasi toast.
     * @param {string} message - Pesan yang ditampilkan.
     * @param {"success"|"error"|"warning"} type - Tipe toast.
     */
    function showToast(message, type = "success") {
        const container = document.getElementById("toast-container");
        const icons = { success: "✓", error: "✕", warning: "⚠" };

        const toast = document.createElement("div");
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || "ℹ"}</span>
            <span>${message}</span>
        `;

        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add("toast-exit");
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    }

    /* =============================================
       Utility Functions
       ============================================= */

    /**
     * Memformat ukuran file ke format yang mudah dibaca.
     * @param {number} bytes - Ukuran dalam bytes.
     * @returns {string} Ukuran yang diformat (misal: "2.5 MB").
     */
    function formatSize(bytes) {
        if (bytes === 0) return "0 B";
        const sizes = ["B", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + " " + sizes[i];
    }

    /**
     * Memformat tanggal ISO ke format lokal.
     * @param {string} isoStr - Tanggal ISO string.
     * @returns {string} Tanggal yang diformat.
     */
    function formatDate(isoStr) {
        if (!isoStr) return "-";
        const d = new Date(isoStr);
        return d.toLocaleDateString("id-ID", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    }

    /**
     * Menentukan class icon berdasarkan nama file.
     * @param {string} filename - Nama file.
     * @returns {object} Object dengan class dan emoji.
     */
    function getFileIcon(filename) {
        const ext = (filename || "").split(".").pop().toLowerCase();
        const map = {
            doc: { cls: "doc", icon: "📄" }, docx: { cls: "doc", icon: "📄" },
            pdf: { cls: "doc", icon: "📕" }, txt: { cls: "doc", icon: "📝" },
            xls: { cls: "doc", icon: "📊" }, xlsx: { cls: "doc", icon: "📊" },
            csv: { cls: "doc", icon: "📊" },
            ppt: { cls: "doc", icon: "📊" }, pptx: { cls: "doc", icon: "📊" },
            png: { cls: "img", icon: "🖼️" }, jpg: { cls: "img", icon: "🖼️" },
            jpeg: { cls: "img", icon: "🖼️" }, gif: { cls: "img", icon: "🖼️" },
            bmp: { cls: "img", icon: "🖼️" }, svg: { cls: "img", icon: "🖼️" },
            zip: { cls: "zip", icon: "📦" }, rar: { cls: "zip", icon: "📦" },
            "7z": { cls: "zip", icon: "📦" },
            mp4: { cls: "vid", icon: "🎬" }, avi: { cls: "vid", icon: "🎬" },
            mkv: { cls: "vid", icon: "🎬" },
            mp3: { cls: "vid", icon: "🎵" }, wav: { cls: "vid", icon: "🎵" },
            json: { cls: "doc", icon: "📋" }, xml: { cls: "doc", icon: "📋" },
        };
        return map[ext] || { cls: "default", icon: "📎" };
    }

    /**
     * Escape HTML untuk mencegah XSS.
     * @param {string} str - String yang akan di-escape.
     * @returns {string} String yang sudah di-escape.
     */
    function escapeHtml(str) {
        const div = document.createElement("div");
        div.textContent = str;
        return div.innerHTML;
    }

    /* =============================================
       Navigation & Routing
       ============================================= */

    /**
     * Navigasi ke halaman tertentu.
     * @param {string} page - Nama halaman.
     */
    function navigate(page) {
        state.currentPage = page;
        render();
    }

    /** Render halaman berdasarkan state saat ini. */
    function render() {
        const app = document.getElementById("app");
        const navbar = document.getElementById("navbar");

        if (!state.user) {
            navbar.style.display = "none";
            if (state.currentPage === "register") {
                app.innerHTML = renderRegisterPage();
            } else {
                app.innerHTML = renderLoginPage();
            }
        } else {
            navbar.style.display = "flex";
            renderNavbar();

            switch (state.currentPage) {
                case "files":
                    app.innerHTML = renderFilesPage();
                    loadFiles();
                    break;
                case "admin":
                    if (state.user.role === "admin") {
                        app.innerHTML = renderAdminPage();
                        loadUsers();
                    } else {
                        navigate("files");
                    }
                    break;
                default:
                    app.innerHTML = renderFilesPage();
                    loadFiles();
                    break;
            }
        }

        attachEventListeners();
    }

    /* =============================================
       Auth Actions
       ============================================= */

    /** Melakukan proses login. */
    async function doLogin() {
        const username = document.getElementById("login-username").value.trim();
        const password = document.getElementById("login-password").value;
        const btn = document.getElementById("login-btn");

        if (!username || !password) {
            showToast("Isi username dan password.", "warning");
            return;
        }

        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Memproses...';

        try {
            const res = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password }),
            });

            const data = await res.json();

            if (res.ok) {
                state.accessToken = data.access_token;
                state.refreshToken = data.refresh_token;
                state.user = data.user;
                state.currentPage = "files";
                showToast(`Selamat datang, ${data.user.username}!`, "success");
                render();
            } else {
                showToast(data.error || "Login gagal.", "error");
            }
        } catch (err) {
            showToast("Koneksi ke server gagal.", "error");
        } finally {
            btn.disabled = false;
            btn.textContent = "Masuk";
        }
    }

    /** Melakukan proses registrasi. */
    async function doRegister() {
        const username = document.getElementById("reg-username").value.trim();
        const email = document.getElementById("reg-email").value.trim();
        const password = document.getElementById("reg-password").value;
        const confirmPassword = document.getElementById("reg-confirm-password").value;
        const btn = document.getElementById("register-btn");

        if (!username || !email || !password) {
            showToast("Semua field wajib diisi.", "warning");
            return;
        }

        if (password !== confirmPassword) {
            showToast("Password tidak cocok.", "warning");
            return;
        }

        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Memproses...';

        try {
            const res = await fetch("/api/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, email, password }),
            });

            const data = await res.json();

            if (res.ok) {
                showToast("Registrasi berhasil! Silakan login.", "success");
                navigate("login");
            } else {
                showToast(data.error || "Registrasi gagal.", "error");
            }
        } catch (err) {
            showToast("Koneksi ke server gagal.", "error");
        } finally {
            btn.disabled = false;
            btn.textContent = "Daftar";
        }
    }

    /** Melakukan proses logout. Mengirim refresh token agar ikut di-blocklist oleh server. */
    async function logout() {
        if (state.accessToken) {
            try {
                await api("/api/auth/logout", {
                    method: "POST",
                    body: JSON.stringify({ refresh_token: state.refreshToken }),
                });
            } catch (_) { /* ignore */ }
        }

        state.accessToken = null;
        state.refreshToken = null;
        state.user = null;
        state.currentPage = "login";
        showToast("Anda telah logout.", "success");
        render();
    }

    /* =============================================
       File Management Actions
       ============================================= */

    /** Memuat daftar file dari server. */
    async function loadFiles() {
        const tbody = document.getElementById("file-list-body");
        if (!tbody) return;

        tbody.innerHTML = `
            <tr><td colspan="6">
                <div class="loading-overlay"><span class="spinner"></span> Memuat file...</div>
            </td></tr>
        `;

        try {
            const res = await api("/api/files/");
            const data = await res.json();

            if (!res.ok) {
                tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state">
                    <p>${escapeHtml(data.error || "Gagal memuat file.")}</p>
                </div></td></tr>`;
                return;
            }

            const files = data.files || [];
            updateFileStats(files);

            if (files.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state">
                    <div class="empty-icon">📂</div>
                    <h3>Belum ada file</h3>
                    <p>Upload file pertamamu menggunakan area di atas.</p>
                </div></td></tr>`;
                return;
            }

            tbody.innerHTML = files.map(f => {
                const icon = getFileIcon(f.original_name);
                const isOwner = state.user && (
                    !f.uploader || f.uploader === state.user.username
                );
                const canDelete = state.user.role === "admin" || isOwner;

                return `
                <tr>
                    <td>
                        <div class="file-name-cell">
                            <div class="file-icon ${icon.cls}">${icon.icon}</div>
                            <span title="${escapeHtml(f.original_name)}">${escapeHtml(f.original_name)}</span>
                        </div>
                    </td>
                    <td>${formatSize(f.file_size)}</td>
                    <td>${escapeHtml(f.mime_type || "-")}</td>
                    <td>${f.uploader ? escapeHtml(f.uploader) : "Anda"}</td>
                    <td>${formatDate(f.uploaded_at)}</td>
                    <td>
                        <div class="file-actions">
                            <button class="btn btn-success btn-icon" title="Download"
                                onclick="window._app.downloadFile(${f.id})">⬇</button>
                            ${canDelete ? `<button class="btn btn-danger btn-icon" title="Hapus"
                                onclick="window._app.deleteFile(${f.id}, '${escapeHtml(f.original_name)}')">✕</button>` : ""}
                        </div>
                    </td>
                </tr>`;
            }).join("");

        } catch (err) {
            tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state">
                <p>Gagal terhubung ke server.</p>
            </div></td></tr>`;
        }
    }

    /**
     * Memperbarui statistik file di dashboard.
     * @param {Array} files - Array data file.
     */
    function updateFileStats(files) {
        const totalCount = document.getElementById("stat-total-files");
        const totalSize = document.getElementById("stat-total-size");

        if (totalCount) totalCount.textContent = files.length;
        if (totalSize) {
            const total = files.reduce((sum, f) => sum + (f.file_size || 0), 0);
            totalSize.textContent = formatSize(total);
        }
    }

    /**
     * Mengupload file ke server.
     * @param {File} file - File object yang akan diupload.
     */
    async function uploadFile(file) {
        const progressContainer = document.getElementById("upload-progress");
        const progressBar = document.getElementById("progress-bar-fill");
        const progressText = document.getElementById("progress-text");

        if (!file) return;

        progressContainer.classList.add("active");
        progressBar.style.width = "0%";
        progressText.textContent = `Mengupload ${file.name}...`;

        const formData = new FormData();
        formData.append("file", file);

        try {
            // XMLHttpRequest untuk progress tracking
            const xhr = new XMLHttpRequest();
            const token = state.accessToken;

            await new Promise((resolve, reject) => {
                xhr.upload.addEventListener("progress", (e) => {
                    if (e.lengthComputable) {
                        const pct = Math.round((e.loaded / e.total) * 100);
                        progressBar.style.width = pct + "%";
                        progressText.textContent = `Mengupload ${file.name}... ${pct}%`;
                    }
                });

                xhr.addEventListener("load", () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve();
                    } else {
                        try {
                            const errData = JSON.parse(xhr.responseText);
                            reject(new Error(errData.error || "Upload gagal."));
                        } catch (_) {
                            reject(new Error("Upload gagal."));
                        }
                    }
                });

                xhr.addEventListener("error", () => reject(new Error("Koneksi gagal.")));
                xhr.open("POST", "/api/files/upload");
                xhr.setRequestHeader("Authorization", `Bearer ${token}`);
                xhr.send(formData);
            });

            showToast(`${file.name} berhasil diupload!`, "success");
            loadFiles();
        } catch (err) {
            showToast(err.message, "error");
        } finally {
            setTimeout(() => {
                progressContainer.classList.remove("active");
            }, 1500);
        }
    }

    /**
     * Mendownload file berdasarkan ID.
     * @param {number} fileId - ID file.
     */
    async function downloadFile(fileId) {
        try {
            const res = await api(`/api/files/download/${fileId}`);

            if (!res.ok) {
                const data = await res.json();
                showToast(data.error || "Download gagal.", "error");
                return;
            }

            // Ambil nama file dari Content-Disposition header
            const disposition = res.headers.get("Content-Disposition") || "";
            let filename = "download";
            const match = disposition.match(/filename\*?=(?:UTF-8''|"?)([^";]+)/i);
            if (match) {
                filename = decodeURIComponent(match[1].replace(/"/g, ""));
            }

            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            showToast("File berhasil didownload.", "success");
        } catch (err) {
            showToast("Download gagal.", "error");
        }
    }

    /**
     * Menghapus file setelah konfirmasi.
     * @param {number} fileId - ID file.
     * @param {string} fileName - Nama file (untuk konfirmasi).
     */
    async function deleteFile(fileId, fileName) {
        showModal(
            "Hapus File",
            `Yakin ingin menghapus <strong>${escapeHtml(fileName)}</strong>? Tindakan ini tidak bisa dibatalkan.`,
            async () => {
                try {
                    const res = await api(`/api/files/${fileId}`, { method: "DELETE" });
                    const data = await res.json();

                    if (res.ok) {
                        showToast(data.message, "success");
                        loadFiles();
                    } else {
                        showToast(data.error || "Gagal menghapus file.", "error");
                    }
                } catch (err) {
                    showToast("Koneksi ke server gagal.", "error");
                }
            }
        );
    }

    /* =============================================
       Admin Actions
       ============================================= */

    /** Menampilkan modal form untuk menambah user baru (admin only). */
    function showCreateUserModal() {
        const existing = document.querySelector(".modal-overlay");
        if (existing) existing.remove();

        const overlay = document.createElement("div");
        overlay.className = "modal-overlay";
        overlay.innerHTML = `
            <div class="modal">
                <h3>➕ Tambah User Baru</h3>
                <form id="create-user-form">
                    <div class="form-group">
                        <label for="new-username">Username</label>
                        <input type="text" id="new-username" class="form-input"
                            placeholder="3-50 karakter" required>
                    </div>
                    <div class="form-group">
                        <label for="new-email">Email</label>
                        <input type="email" id="new-email" class="form-input"
                            placeholder="email@contoh.com" required>
                    </div>
                    <div class="form-group">
                        <label for="new-password">Password</label>
                        <input type="password" id="new-password" class="form-input"
                            placeholder="Minimal 6 karakter" required>
                    </div>
                    <div class="form-group">
                        <label for="new-role">Role</label>
                        <select id="new-role" class="form-select">
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>
                    <div class="modal-actions">
                        <button type="button" class="btn btn-secondary" id="modal-cancel">Batal</button>
                        <button type="submit" class="btn btn-primary" id="create-user-btn">Buat User</button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(overlay);

        document.getElementById("modal-cancel").addEventListener("click", () => overlay.remove());
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) overlay.remove();
        });

        document.getElementById("create-user-form").addEventListener("submit", async (e) => {
            e.preventDefault();
            const btn = document.getElementById("create-user-btn");
            const username = document.getElementById("new-username").value.trim();
            const email = document.getElementById("new-email").value.trim();
            const password = document.getElementById("new-password").value;
            const role = document.getElementById("new-role").value;

            if (!username || !email || !password) {
                showToast("Semua field wajib diisi.", "warning");
                return;
            }

            btn.disabled = true;
            btn.innerHTML = '<span class="spinner"></span> Memproses...';

            try {
                const res = await api("/api/admin/users", {
                    method: "POST",
                    body: JSON.stringify({ username, email, password, role }),
                });
                const data = await res.json();

                if (res.ok) {
                    showToast(data.message, "success");
                    overlay.remove();
                    loadUsers();
                } else {
                    showToast(data.error || "Gagal membuat user.", "error");
                }
            } catch (err) {
                showToast("Koneksi ke server gagal.", "error");
            } finally {
                btn.disabled = false;
                btn.textContent = "Buat User";
            }
        });
    }

    /** Memuat daftar user (admin only). */
    async function loadUsers() {
        const tbody = document.getElementById("user-list-body");
        if (!tbody) return;

        tbody.innerHTML = `
            <tr><td colspan="5">
                <div class="loading-overlay"><span class="spinner"></span> Memuat user...</div>
            </td></tr>
        `;

        try {
            const res = await api("/api/admin/users");
            const data = await res.json();

            if (!res.ok) {
                tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state">
                    <p>${escapeHtml(data.error || "Gagal memuat data user.")}</p>
                </div></td></tr>`;
                return;
            }

            const users = data.users || [];
            const statUsers = document.getElementById("stat-total-users");
            if (statUsers) statUsers.textContent = users.length;

            tbody.innerHTML = users.map(u => {
                const isSelf = state.user && u.id === state.user.id;
                return `
                <tr>
                    <td>${u.id}</td>
                    <td><strong>${escapeHtml(u.username)}</strong>${isSelf ? " (Anda)" : ""}</td>
                    <td>${escapeHtml(u.email)}</td>
                    <td><span class="role-badge ${u.role}">${u.role}</span></td>
                    <td>
                        ${!isSelf ? `
                        <div class="file-actions">
                            <select class="form-select" style="width:auto;display:inline-block;min-width:100px"
                                id="role-select-${u.id}" onchange="window._app.changeRole(${u.id}, this.value)">
                                <option value="user" ${u.role === "user" ? "selected" : ""}>User</option>
                                <option value="admin" ${u.role === "admin" ? "selected" : ""}>Admin</option>
                            </select>
                            <button class="btn btn-danger btn-sm"
                                onclick="window._app.deleteUser(${u.id}, '${escapeHtml(u.username)}')">Hapus</button>
                        </div>` : `<span style="color:var(--text-muted);font-size:var(--font-size-xs)">—</span>`}
                    </td>
                </tr>`;
            }).join("");

        } catch (err) {
            tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state">
                <p>Gagal terhubung ke server.</p>
            </div></td></tr>`;
        }
    }

    /**
     * Mengubah role user.
     * @param {number} userId - ID user.
     * @param {string} newRole - Role baru ('admin' atau 'user').
     */
    async function changeRole(userId, newRole) {
        try {
            const res = await api(`/api/admin/users/${userId}/role`, {
                method: "PUT",
                body: JSON.stringify({ role: newRole }),
            });
            const data = await res.json();

            if (res.ok) {
                showToast(data.message, "success");
                loadUsers();
            } else {
                showToast(data.error || "Gagal mengubah role.", "error");
                loadUsers(); // reset select
            }
        } catch (err) {
            showToast("Koneksi ke server gagal.", "error");
        }
    }

    /**
     * Menghapus user setelah konfirmasi.
     * @param {number} userId - ID user.
     * @param {string} username - Username (untuk konfirmasi).
     */
    async function deleteUser(userId, username) {
        showModal(
            "Hapus User",
            `Yakin ingin menghapus user <strong>${escapeHtml(username)}</strong> beserta semua filenya?`,
            async () => {
                try {
                    const res = await api(`/api/admin/users/${userId}`, { method: "DELETE" });
                    const data = await res.json();

                    if (res.ok) {
                        showToast(data.message, "success");
                        loadUsers();
                    } else {
                        showToast(data.error || "Gagal menghapus user.", "error");
                    }
                } catch (err) {
                    showToast("Koneksi ke server gagal.", "error");
                }
            }
        );
    }

    /* =============================================
       Modal
       ============================================= */

    /**
     * Menampilkan modal konfirmasi.
     * @param {string} title - Judul modal.
     * @param {string} body - HTML body modal.
     * @param {Function} onConfirm - Callback saat confirm.
     */
    function showModal(title, body, onConfirm) {
        const existing = document.querySelector(".modal-overlay");
        if (existing) existing.remove();

        const overlay = document.createElement("div");
        overlay.className = "modal-overlay";
        overlay.innerHTML = `
            <div class="modal">
                <h3>${title}</h3>
                <p>${body}</p>
                <div class="modal-actions">
                    <button class="btn btn-secondary" id="modal-cancel">Batal</button>
                    <button class="btn btn-danger" id="modal-confirm">Konfirmasi</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        document.getElementById("modal-cancel").addEventListener("click", () => overlay.remove());
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) overlay.remove();
        });
        document.getElementById("modal-confirm").addEventListener("click", () => {
            overlay.remove();
            onConfirm();
        });
    }

    /* =============================================
       Page Renderers
       ============================================= */

    /** Render halaman login. */
    function renderLoginPage() {
        return `
        <div class="auth-container">
            <div class="auth-card terminal-window">
                <div class="terminal-titlebar">
                    <div class="terminal-dots">
                        <div class="terminal-dot close"></div>
                        <div class="terminal-dot minimize"></div>
                        <div class="terminal-dot maximize"></div>
                    </div>
                    <div class="terminal-title">filevault — login</div>
                </div>
                <div class="terminal-body">
                    <h2>$ login<span class="cursor-blink"></span></h2>
                    <p class="auth-subtitle">Autentikasi ke FileVault</p>
                    <form id="login-form" autocomplete="off">
                        <div class="form-group">
                            <label for="login-username">username</label>
                            <input type="text" id="login-username" class="form-input"
                                placeholder="ketik username" autocomplete="username" required>
                        </div>
                        <div class="form-group">
                            <label for="login-password">password</label>
                            <input type="password" id="login-password" class="form-input"
                                placeholder="ketik password" autocomplete="current-password" required>
                        </div>
                        <button type="submit" id="login-btn" class="btn btn-primary btn-block">→ Masuk</button>
                    </form>
                    <div class="auth-links">
                        Belum punya akun? <a id="goto-register">register</a>
                    </div>
                </div>
            </div>
        </div>`;
    }

    /** Render halaman register. */
    function renderRegisterPage() {
        return `
        <div class="auth-container">
            <div class="auth-card terminal-window">
                <div class="terminal-titlebar">
                    <div class="terminal-dots">
                        <div class="terminal-dot close"></div>
                        <div class="terminal-dot minimize"></div>
                        <div class="terminal-dot maximize"></div>
                    </div>
                    <div class="terminal-title">filevault — register</div>
                </div>
                <div class="terminal-body">
                    <h2>$ register<span class="cursor-blink"></span></h2>
                    <p class="auth-subtitle">Buat akun baru</p>
                    <form id="register-form" autocomplete="off">
                        <div class="form-group">
                            <label for="reg-username">username</label>
                            <input type="text" id="reg-username" class="form-input"
                                placeholder="3-50 karakter" autocomplete="username" required>
                        </div>
                        <div class="form-group">
                            <label for="reg-email">email</label>
                            <input type="email" id="reg-email" class="form-input"
                                placeholder="email@contoh.com" autocomplete="email" required>
                        </div>
                        <div class="form-group">
                            <label for="reg-password">password</label>
                            <input type="password" id="reg-password" class="form-input"
                                placeholder="minimal 6 karakter" autocomplete="new-password" required>
                        </div>
                        <div class="form-group">
                            <label for="reg-confirm-password">confirm_password</label>
                            <input type="password" id="reg-confirm-password" class="form-input"
                                placeholder="ulangi password" autocomplete="new-password" required>
                        </div>
                        <button type="submit" id="register-btn" class="btn btn-primary btn-block">→ Daftar</button>
                    </form>
                    <div class="auth-links">
                        Sudah punya akun? <a id="goto-login">login</a>
                    </div>
                </div>
            </div>
        </div>`;
    }

    /** Render navbar berdasarkan user yang login. */
    function renderNavbar() {
        const navbar = document.getElementById("navbar");
        const u = state.user;
        const initial = u.username.charAt(0).toUpperCase();

        navbar.innerHTML = `
            <div class="navbar-brand" onclick="window._app.navigate('files')">
                <span class="brand-icon">▸</span>
                <span>filevault</span>
            </div>
            <nav class="navbar-nav">
                <button class="nav-link ${state.currentPage === 'files' ? 'active' : ''}"
                    onclick="window._app.navigate('files')">~/files</button>
                ${u.role === "admin" ? `
                <button class="nav-link ${state.currentPage === 'admin' ? 'active' : ''}"
                    onclick="window._app.navigate('admin')">~/admin</button>` : ""}
                <div class="nav-user-info">
                    <div class="nav-user-avatar">${initial}</div>
                    <span>${escapeHtml(u.username)}</span>
                    <span class="nav-role-badge ${u.role}">${u.role}</span>
                </div>
                <button class="nav-link" onclick="window._app.logout()">exit</button>
            </nav>
        `;
    }

    /** Render halaman file manager. */
    function renderFilesPage() {
        return `
        <div class="main-content">
            <div class="page-header">
                <div>
                    <h1>~/files<span class="cursor-blink"></span></h1>
                    <p class="header-subtitle">Kelola file Anda dengan aman</p>
                </div>
            </div>

            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-icon purple">📄</div>
                    <div class="stat-info">
                        <h3 id="stat-total-files">—</h3>
                        <p>total_files</p>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon cyan">💾</div>
                    <div class="stat-info">
                        <h3 id="stat-total-size">—</h3>
                        <p>total_size</p>
                    </div>
                </div>
            </div>

            <!-- Upload Zone -->
            <div class="upload-zone" id="upload-zone">
                <div class="upload-icon">↑</div>
                <p><strong>Drag & drop file di sini</strong> atau klik untuk memilih</p>
                <p class="upload-hint">max_size: 50MB</p>
                <input type="file" id="file-input" style="display:none" multiple>
            </div>

            <!-- Upload Progress -->
            <div class="upload-progress-container" id="upload-progress">
                <span id="progress-text" style="font-size:var(--font-size-sm);color:var(--text-secondary)">uploading...</span>
                <div class="progress-bar-wrapper">
                    <div class="progress-bar-fill" id="progress-bar-fill"></div>
                </div>
            </div>

            <!-- File List -->
            <div class="terminal-window">
                <div class="terminal-titlebar">
                    <div class="terminal-dots">
                        <div class="terminal-dot close"></div>
                        <div class="terminal-dot minimize"></div>
                        <div class="terminal-dot maximize"></div>
                    </div>
                    <div class="terminal-title">ls -la ~/files</div>
                </div>
                <div style="overflow-x:auto">
                    <table class="file-table">
                        <thead>
                            <tr>
                                <th>filename</th>
                                <th>size</th>
                                <th>type</th>
                                <th>owner</th>
                                <th>modified</th>
                                <th>actions</th>
                            </tr>
                        </thead>
                        <tbody id="file-list-body">
                            <tr><td colspan="6">
                                <div class="loading-overlay"><span class="spinner"></span> loading...</div>
                            </td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>`;
    }

    /** Render halaman admin (manage users). */
    function renderAdminPage() {
        return `
        <div class="main-content">
            <div class="page-header">
                <div>
                    <h1>~/admin<span class="cursor-blink"></span></h1>
                    <p class="header-subtitle">Manajemen user dan kontrol akses</p>
                </div>
                <button class="btn btn-primary" onclick="window._app.showCreateUserModal()">
                    + useradd
                </button>
            </div>

            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-icon orange">👤</div>
                    <div class="stat-info">
                        <h3 id="stat-total-users">—</h3>
                        <p>total_users</p>
                    </div>
                </div>
            </div>

            <div class="terminal-window">
                <div class="terminal-titlebar">
                    <div class="terminal-dots">
                        <div class="terminal-dot close"></div>
                        <div class="terminal-dot minimize"></div>
                        <div class="terminal-dot maximize"></div>
                    </div>
                    <div class="terminal-title">cat /etc/passwd — user management</div>
                </div>
                <div style="overflow-x:auto">
                    <table class="user-table">
                        <thead>
                            <tr>
                                <th>uid</th>
                                <th>username</th>
                                <th>email</th>
                                <th>role</th>
                                <th>actions</th>
                            </tr>
                        </thead>
                        <tbody id="user-list-body">
                            <tr><td colspan="5">
                                <div class="loading-overlay"><span class="spinner"></span> loading...</div>
                            </td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>`;
    }

    /* =============================================
       Event Listeners
       ============================================= */

    /** Memasang event listener setelah render. */
    function attachEventListeners() {
        // Login form
        const loginForm = document.getElementById("login-form");
        if (loginForm) {
            loginForm.addEventListener("submit", (e) => {
                e.preventDefault();
                doLogin();
            });
        }

        // Register form
        const registerForm = document.getElementById("register-form");
        if (registerForm) {
            registerForm.addEventListener("submit", (e) => {
                e.preventDefault();
                doRegister();
            });
        }

        // Auth navigation links
        const gotoRegister = document.getElementById("goto-register");
        if (gotoRegister) {
            gotoRegister.addEventListener("click", () => navigate("register"));
        }

        const gotoLogin = document.getElementById("goto-login");
        if (gotoLogin) {
            gotoLogin.addEventListener("click", () => navigate("login"));
        }

        // Upload zone
        const uploadZone = document.getElementById("upload-zone");
        const fileInput = document.getElementById("file-input");

        if (uploadZone && fileInput) {
            uploadZone.addEventListener("click", () => fileInput.click());

            fileInput.addEventListener("change", (e) => {
                const files = e.target.files;
                for (const file of files) {
                    uploadFile(file);
                }
                fileInput.value = "";
            });

            // Drag & drop
            uploadZone.addEventListener("dragover", (e) => {
                e.preventDefault();
                uploadZone.classList.add("drag-over");
            });

            uploadZone.addEventListener("dragleave", () => {
                uploadZone.classList.remove("drag-over");
            });

            uploadZone.addEventListener("drop", (e) => {
                e.preventDefault();
                uploadZone.classList.remove("drag-over");
                const files = e.dataTransfer.files;
                for (const file of files) {
                    uploadFile(file);
                }
            });
        }
    }

    /* =============================================
       Expose API for onclick handlers
       ============================================= */

    window._app = {
        navigate,
        logout,
        downloadFile,
        deleteFile,
        changeRole,
        deleteUser,
        showCreateUserModal,
    };

    /* =============================================
       Initialize
       ============================================= */

    document.addEventListener("DOMContentLoaded", () => {
        render();
    });

})();
