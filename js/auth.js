/**
 * Authentication & Profile Manager
 */
const auth = {
    selectedBase64Image: null,

    async handleRegister(e) {
        e.preventDefault();
        db.clearSession(); // Làm sạch phiên làm việc cũ

        const errorEl = document.getElementById('reg-error');
        errorEl.classList.add('hidden');

        const username = document.getElementById('reg-username').value.trim();
        const email = document.getElementById('reg-email').value.trim();
        const phone = document.getElementById('reg-phone').value.trim();
        const password = document.getElementById('reg-password').value;
        const confirmPassword = document.getElementById('reg-confirm-password').value;

        // 1. Kiểm tra hai mật khẩu khớp nhau
        if (password !== confirmPassword) {
            errorEl.innerText = "Mật khẩu nhập lại không khớp!";
            errorEl.classList.remove('hidden');
            return;
        }

        // 2. Kiểm tra chuẩn Mật khẩu Cấp 5
        const secCheck = SecurityEngine.validatePasswordLevel5(password);
        if (!secCheck.valid) {
            errorEl.innerText = secCheck.msg;
            errorEl.classList.remove('hidden');
            return;
        }

        // 3. Kiểm tra trùng tên đăng nhập
        const users = await db.getUsersOnce();
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

        const success = await db.saveUserToFirebase(newUser);
        if (success) {
            alert("Đăng ký tài khoản thành công! Hãy đăng nhập bằng tài khoản vừa tạo.");
            window.location.href = 'login.html';
        }
    },

    async handleLogin(e) {
        e.preventDefault();
        db.clearSession(); // Làm sạch phiên làm việc cũ

        const errorEl = document.getElementById('login-error');
        errorEl.classList.add('hidden');

        const loginId = document.getElementById('login-id').value.trim();
        const password = document.getElementById('login-password').value;

        const passwordHash = await SecurityEngine.hashPassword(password);
        const users = await db.getUsersOnce();

        const user = users.find(u => (u.username === loginId || u.email === loginId) && u.passwordHash === passwordHash);

        if (!user) {
            errorEl.innerText = "Tên đăng nhập/Mật khẩu không chính xác!";
            errorEl.classList.remove('hidden');
            return;
        }

        if (!user.id) {
            user.id = 'usr_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
            await db.saveUserToFirebase(user);
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
            img.onload = async () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = 128;
                canvas.height = 128;

                const minSide = Math.min(img.width, img.height);
                const sx = (img.width - minSide) / 2;
                const sy = (img.height - minSide) / 2;

                ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, 128, 128);
                
                const base64Img = canvas.toDataURL('image/png');
                this.selectedBase64Image = base64Img;
                this.renderAvatarPreview(base64Img);

                await this.autoSaveAvatar(base64Img);
            };
        };
        reader.readAsDataURL(file);
    },

    async autoSaveAvatar(base64Img) {
        const currentUser = db.getSession();
        if (!currentUser) return;

        currentUser.icon = base64Img;
        await db.saveUserToFirebase(currentUser);
        db.setSession(currentUser);
        this.showProfileMessage("Đã đồng bộ Ảnh Đại Diện mới lên Firebase!", "success");
    },

    renderAvatarPreview(avatarValue) {
        const box = document.getElementById('prof-avatar-preview-box');
        if (!box) return;

        if (avatarValue && avatarValue.startsWith('data:image/')) {
            box.innerHTML = `<img src="${avatarValue}" class="w-full h-full object-cover rounded-full" alt="Avatar">`;
        } else {
            box.innerHTML = `<i class="${avatarValue || 'fa-solid fa-user-ninja'}"></i>`;
        }
    },

    async updateFullProfile(e) {
        e.preventDefault();
        const currentUser = db.getSession();
        if (!currentUser) return;

        const newDisplayName = document.getElementById('prof-display-name').value.trim();
        const newUsername = document.getElementById('prof-username').value.trim();
        const newEmail = document.getElementById('prof-email').value.trim();
        const newPhone = document.getElementById('prof-phone').value.trim();
        const newPassword = document.getElementById('prof-new-password').value;

        const users = await db.getUsersOnce();

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

        const finalAvatar = this.selectedBase64Image || currentUser.icon || 'fa-solid fa-user-ninja';

        const updatedUser = {
            id: currentUser.id,
            username: SecurityEngine.sanitizeHTML(newUsername),
            passwordHash: updatedPasswordHash,
            email: SecurityEngine.sanitizeHTML(newEmail),
            phone: SecurityEngine.sanitizeHTML(newPhone),
            displayName: SecurityEngine.sanitizeHTML(newDisplayName),
            icon: finalAvatar
        };

        const success = await db.saveUserToFirebase(updatedUser);
        if (success) {
            db.setSession(updatedUser);
            if (document.getElementById('prof-new-password')) {
                document.getElementById('prof-new-password').value = '';
            }
            this.showProfileMessage("Đã cập nhật hồ sơ thành công lên Firebase Database!", "success");
            this.renderAvatarPreview(updatedUser.icon);
        }
    },

    showProfileMessage(msg, type) {
        const msgEl = document.getElementById('prof-msg');
        if (!msgEl) return;
        msgEl.innerText = msg;
        msgEl.classList.remove('hidden', 'bg-slate-900');

        if (type === 'error') {
            msgEl.style.color = '#fb7185';
            msgEl.style.border = '1px solid #9f1239';
        } else {
            msgEl.style.color = '#34d399';
            msgEl.style.border = '1px solid #065f46';
        }
    }
};
        
