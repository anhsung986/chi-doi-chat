/**
 * Authentication & Profile Manager
 * Xử lý Đăng ký, Đăng nhập, Profile bảo mật level 5.
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

        // 2. Kiểm tra trùng lặp
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
        router('login');
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
        updateUIState();
        router('chat-group');
    },

    logout() {
        db.clearSession();
        updateUIState();
        router('welcome');
    },

    updateAvatar() {
        const iconInput = document.getElementById('prof-icon-input').value.trim();
        const user = db.getSession();
        if (!user || !iconInput) return;

        user.icon = SecurityEngine.sanitizeHTML(iconInput);
        db.setSession(user);

        // Cập nhật vào danh sách DB
        const users = db.getUsers();
        const idx = users.findIndex(u => u.username === user.username);
        if (idx !== -1) {
            users[idx].icon = user.icon;
            db.saveUsers(users);
        }

        alert("Đã cập nhật Icon thành công!");
    }
};
