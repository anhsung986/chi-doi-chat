/**
 * Authentication & Full Profile Manager
 * Đã bổ sung userId cố định để người dùng thoải mái đổi Tên đăng nhập mà không bị đổi/mất tài khoản.
 */
const auth = {
    selectedBase64Image: null,

    async handleRegister(e) {
        e.preventDefault();
        const errorEl = document.getElementById('reg-error');
        errorEl.classList.add('hidden');

        const username = document.getElementById('reg-username').value.trim();
        const password = document.getElementById('reg-password').value;
        const email = document.getElementById('reg-email').value.trim();
        const phone = document.getElementById('reg-phone').value.trim();

        const secCheck = SecurityEngine.validatePasswordLevel5(password);
        if (!secCheck.valid) {
            errorEl.innerText = secCheck.msg;
            errorEl.classList.remove('hidden');
            return;
        }

        const users = db.getUsers();
        if (users.some(u => u.username === username)) {
            errorEl.innerText = "Tên đăng nhập đã tồn tại!";
            errorEl.classList.remove('hidden');
            return;
        }

        const passwordHash = await SecurityEngine.hashPassword(password);

        // Tạo ID duy nhất không bao giờ thay đổi cho tài khoản
        const newUser = {
            id: 'usr_' + Date.now() + '_' + Math.floor(Math.random() * 10000),
            username,
            passwordHash,
            email,
            phone,
            displayName: username,
            icon: 'fa-solid fa-user-ninja'
        };

        users.push(newUser);
        db.saveUsers(users);

        alert("Đăng ký thành công!");
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

        // Tự động cấp ID nếu là tài khoản cũ chưa có ID
        if (!user.id) {
            user.id = 'usr_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
            db.saveUsers(users);
        }

        db.setSession(user);
        window.location.href = 'chat-group.html';
    },

    logout() {
        db.clearSession();
        window.location.href = 'login.html';
    },

    handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            alert('Vui lòng chọn tệp hình ảnh!');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = 128;
                canvas.height = 128;

                const minSide = Math.min(img.width, img.height);
                const sx = (img.width - minSide) / 2;
                const sy = (img.height - minSide) / 2;

                ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, 128, 128);
                
                this.selectedBase64Image = canvas.toDataURL('image/png');
                this.renderAvatarPreview(this.selectedBase64Image);
                document.getElementById('prof-icon-input').value = '';
            };
        };
        reader.readAsDataURL(file);
    },

    renderAvatarPreview(avatarValue) {
        const box = document.getElementById('prof-avatar-preview-box');
        if (!box) return;

        if (avatarValue && avatarValue.startsWith('data:image/')) {
            box.innerHTML = `<img src="${avatarValue}" class="w-full h-full object-cover" alt="Avatar">`;
        } else {
            box.innerHTML = `<i class="${avatarValue || 'fa-solid fa-user-ninja'}"></i>`;
            document.getElementById('prof-icon-input').value = avatarValue.startsWith('data:image/') ? '' : avatarValue;
        }
    },

    previewIcon(iconClass) {
        this.selectedBase64Image = null;
        this.renderAvatarPreview(SecurityEngine.sanitizeHTML(iconClass) || 'fa-solid fa-user-ninja');
    },

    // CẬP NHẬT HỒ SƠ DỰA TRÊN USER ID (KHÔNG BỊ TẠO HOẶC ĐỔI SANG TÀI KHOẢN MỚI)
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
        const iconInput = document.getElementById('prof-icon-input').value.trim();
        const newPassword = document.getElementById('prof-new-password').value;

        let finalAvatar = currentUser.icon || 'fa-solid fa-user-ninja';
        if (this.selectedBase64Image) {
            finalAvatar = this.selectedBase64Image;
        } else if (iconInput !== '') {
            finalAvatar = SecurityEngine.sanitizeHTML(iconInput);
        }

        const users = db.getUsers();

        // 1. Kiểm tra nếu Tên đăng nhập mới trùng với tài khoản CỦA NGƯỜI KHÁC
        const isDuplicate = users.some(u => u.username === newUsername && u.id !== currentUser.id);
        if (isDuplicate) {
            this.showProfileMessage("Tên đăng nhập này đã được người khác sử dụng!", "error");
            return;
        }

        // 2. Xử lý đổi Mật khẩu nếu có nhập
        let updatedPasswordHash = currentUser.passwordHash;
        if (newPassword && newPassword.trim() !== '') {
            const secCheck = SecurityEngine.validatePasswordLevel5(newPassword);
            if (!secCheck.valid) {
                this.showProfileMessage(secCheck.msg, "error");
                return;
            }
            updatedPasswordHash = await SecurityEngine.hashPassword(newPassword);
        }

        // 3. Giữ nguyên ID định danh cũ, cập nhật các thông tin mới
        const updatedUser = {
            id: currentUser.id || ('usr_' + Date.now()), // Bảo toàn ID
            username: SecurityEngine.sanitizeHTML(newUsername),
            passwordHash: updatedPasswordHash,
            email: SecurityEngine.sanitizeHTML(newEmail),
            phone: SecurityEngine.sanitizeHTML(newPhone),
            displayName: SecurityEngine.sanitizeHTML(newDisplayName),
            icon: finalAvatar
        };

        // 4. Tìm chính xác tài khoản cũ theo ID để đè dữ liệu
        const userIndex = users.findIndex(u => u.id === currentUser.id || u.username === currentUser.username);
        if (userIndex !== -1) {
            users[userIndex] = updatedUser;
        } else {
            users.push(updatedUser);
        }

        // 5. Lưu lại danh sách và cập nhật phiên làm việc
        db.saveUsers(users);
        db.setSession(updatedUser);

        document.getElementById('prof-new-password').value = '';
        this.showProfileMessage("Đã đổi thông tin thành công! Tài khoản của bạn được giữ nguyên.", "success");
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
