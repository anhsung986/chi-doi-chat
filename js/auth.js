/**
 * Authentication & Full Profile Manager
 * Xử lý Đăng ký, Đăng nhập, và Cập nhật Toàn bộ Hồ sơ Cá nhân (Security Level 5).
 */
const auth = {
    async handleRegister(e) {
        e.preventDefault();
        const errorEl = document.getElementById('reg-error');
        errorEl.classList.add('hidden');

        const username = document.getElementById('reg-username').value.trim();
        const password = document.getElementById('reg-password').value;
        const email = document.getElementById('reg-email').value.trim();
        const phone = document.getElementById('reg-phone').value.trim();

        // 1. Kiểm tra định dạng mật khẩu Cấp 5
        const secCheck = SecurityEngine.validatePasswordLevel5(password);
        if (!secCheck.valid) {
            errorEl.innerText = secCheck.msg;
            errorEl.classList.remove('hidden');
            return;
        }

        // 2. Kiểm tra trùng lặp Tên đăng nhập
        const users = db.getUsers();
        if (users.some(u => u.username === username)) {
            errorEl.innerText = "Tên đăng nhập đã tồn tại!";
            errorEl.classList.remove('hidden');
            return;
        }

        // 3. Mã hóa Mật khẩu SHA-256
        const passwordHash = await SecurityEngine.hashPassword(password);

        const newUser = {
            username,
            passwordHash,
            email,
            phone,
            displayName: username,
            icon: 'fa-solid fa-user-ninja'
        };

        users.push(newUser);
        db.saveUsers(users);

        alert("Đăng ký thành công với tiêu chuẩn Bảo Mật Cấp 5!");
        window.location.href = 'login.html';
    },

    async handleLogin(e) {
        e.preventDefault();
        const errorEl = document.getElementById('login-error');
        errorEl.classList.add('hidden');

        const loginId = document.getElementById('login-id').value.trim();
        const password = document.getElementById('login-password').value;

        const passwordHash = await SecurityEngine.hashPassword(password);
        const users = db.getUsers();

        const user = users.find(u => (u.username === loginId || u.email === loginId) && u.passwordHash === passwordHash);

        if (!user) {
            errorEl.innerText = "Tên đăng nhập/Mật khẩu không chính xác!";
            errorEl.classList.remove('hidden');
            return;
        }

        db.setSession(user);
        window.location.href = 'chat-group.html';
    },

    logout() {
        db.clearSession();
        window.location.href = 'login.html';
    },

    // Preview trực tiếp Icon FontAwesome khi gõ
    previewIcon(iconClass) {
        const previewEl = document.getElementById('prof-icon-preview');
        if (previewEl) {
            previewEl.className = SecurityEngine.sanitizeHTML(iconClass) || 'fa-solid fa-user';
        }
    },

    // CẬP NHẬT TẤT CẢ THÔNG TIN HỒ SƠ
    async updateFullProfile(e) {
        e.preventDefault();
        const msgEl = document.getElementById('prof-msg');
        msgEl.classList.add('hidden');

        const currentUser = db.getSession();
        if (!currentUser) return;

        const newDisplayName = document.getElementById('prof-display-name').value.trim();
        const newUsername = document.getElementById('prof-username').value.trim();
        const newEmail = document.getElementById('prof-email').value.trim();
        const newPhone = document.getElementById('prof-phone').value.trim();
        const newIcon = document.getElementById('prof-icon-input').value.trim() || 'fa-solid fa-user-ninja';
        const newPassword = document.getElementById('prof-new-password').value;

        const users = db.getUsers();

        // 1. Kiểm tra nếu Tên đăng nhập mới bị trùng với người dùng khác
        if (newUsername !== currentUser.username) {
            const isTaken = users.some(u => u.username === newUsername && u.username !== currentUser.username);
            if (isTaken) {
                this.showProfileMessage("Tên đăng nhập mới đã tồn tại trên hệ thống!", "error");
                return;
            }
        }

        // 2. Nếu người dùng đổi Mật khẩu mới -> Kiểm tra chuẩn Cấp 5 & Mã hóa SHA-256
        let updatedPasswordHash = currentUser.passwordHash;
        if (newPassword && newPassword.trim() !== '') {
            const secCheck = SecurityEngine.validatePasswordLevel5(newPassword);
            if (!secCheck.valid) {
                this.showProfileMessage(secCheck.msg, "error");
                return;
            }
            updatedPasswordHash = await SecurityEngine.hashPassword(newPassword);
        }

        // 3. Cập nhật dữ liệu đối tượng User
        const updatedUser = {
            username: SecurityEngine.sanitizeHTML(newUsername),
            passwordHash: updatedPasswordHash,
            email: SecurityEngine.sanitizeHTML(newEmail),
            phone: SecurityEngine.sanitizeHTML(newPhone),
            displayName: SecurityEngine.sanitizeHTML(newDisplayName),
            icon: SecurityEngine.sanitizeHTML(newIcon)
        };

        // 4. Tìm và thay thế trong danh sách CSDL LocalStorage
        const userIndex = users.findIndex(u => u.username === currentUser.username);
        if (userIndex !== -1) {
            users[userIndex] = updatedUser;
        } else {
            users.push(updatedUser);
        }
        db.saveUsers(users);

        // 5. Cập nhật Session làm việc hiện tại
        db.setSession(updatedUser);

        // 6. Reset ô nhập mật khẩu & Hiển thị thông báo thành công
        document.getElementById('prof-new-password').value = '';
        this.showProfileMessage("Cập nhật tất cả thông tin hồ sơ thành công (Level 5)!", "success");
    },

    showProfileMessage(msg, type) {
        const msgEl = document.getElementById('prof-msg');
        msgEl.innerText = msg;
        msgEl.classList.remove('hidden', 'bg-rose-950/50', 'text-rose-300', 'border-rose-800', 'bg-emerald-950/50', 'text-emerald-300', 'border-emerald-800');

        if (type === 'error') {
            msgEl.classList.add('bg-rose-950/50', 'text-rose-300', 'border', 'border-rose-800');
        } else {
            msgEl.classList.add('bg-emerald-950/50', 'text-emerald-300', 'border', 'border-emerald-800');
        }
    }
};
