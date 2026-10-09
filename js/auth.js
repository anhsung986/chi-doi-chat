/**
 * Authentication & Full Profile Manager
 * Đã bỏ ô ghi tên icon, chỉ nhận chọn tệp ảnh trực tiếp từ thiết bị.
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

    // Chọn ảnh từ điện thoại / máy tính & nén tự động
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
            };
        };
        reader.readAsDataURL(file);
    },

    // Hiển thị ảnh xem trước
    renderAvatarPreview(avatarValue) {
        const box = document.getElementById('prof-avatar-preview-box');
        if (!box) return;

        if (avatarValue && avatarValue.startsWith('data:image/')) {
            box.innerHTML = `<img src="${avatarValue}" class="w-full h-full object-cover rounded-full" alt="Avatar">`;
        } else {
            box.innerHTML = `<i class="${avatarValue || 'fa-solid fa-user-ninja'}"></i>`;
        }
    },

    // Lưu thông tin hồ sơ
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
        const newPassword = document.getElementById('prof-new-password').value;

        // Dùng ảnh vừa chọn từ máy, nếu không có thì giữ ảnh cũ
        let finalAvatar = currentUser.icon || 'fa-solid fa-user-ninja';
        if (this.selectedBase64Image) {
            finalAvatar = this.selectedBase64Image;
        }

        const users = db.getUsers();

        const isDuplicate = users.some(u => u.username === newUsername && u.id !== currentUser.id);
        if (isDuplicate) {
            this.showProfileMessage("Tên đăng nhập này đã được người khác sử dụng!", "error");
            return;
        }

        let updatedPasswordHash = currentUser.passwordHash;
        if (newPassword && newPassword.trim() !== '') {
            const secCheck = SecurityEngine.validatePasswordLevel5(newPassword);
            if (!secCheck.valid) {
                this.showProfileMessage(secCheck.msg, "error");
                return;
            }
            updatedPasswordHash = await SecurityEngine.hashPassword(newPassword);
        }

        const updatedUser = {
            id: currentUser.id || ('usr_' + Date.now()),
            username: SecurityEngine.sanitizeHTML(newUsername),
            passwordHash: updatedPasswordHash,
            email: SecurityEngine.sanitizeHTML(newEmail),
            phone: SecurityEngine.sanitizeHTML(newPhone),
            displayName: SecurityEngine.sanitizeHTML(newDisplayName),
            icon: finalAvatar
        };

        const userIndex = users.findIndex(u => u.id === currentUser.id || u.username === currentUser.username);
        if (userIndex !== -1) {
            users[userIndex] = updatedUser;
        } else {
            users.push(updatedUser);
        }

        db.saveUsers(users);
        db.setSession(updatedUser);

        document.getElementById('prof-new-password').value = '';
        this.showProfileMessage("Đã cập nhật ảnh đại diện và thông tin cá nhân thành công!", "success");
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
            
