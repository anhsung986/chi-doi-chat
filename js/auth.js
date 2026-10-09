/**
 * Authentication & Profile Manager
 */
const auth = {
    regSelectedBase64Image: null,

    handleRegFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) return alert('Vui lòng chọn ảnh!');

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = 128; canvas.height = 128;
                const min = Math.min(img.width, img.height);
                ctx.drawImage(img, (img.width - min)/2, (img.height - min)/2, min, min, 0, 0, 128, 128);
                
                this.regSelectedBase64Image = canvas.toDataURL('image/png');
                const box = document.getElementById('reg-avatar-preview-box');
                if (box) box.innerHTML = `<img src="${this.regSelectedBase64Image}" class="w-full h-full object-cover rounded-full">`;
            };
        };
        reader.readAsDataURL(file);
    },

    async handleRegister(e) {
        e.preventDefault();
        db.clearSession();
        const errorEl = document.getElementById('reg-error');
        errorEl.classList.add('hidden');

        const username = document.getElementById('reg-username').value.trim();
        const email = document.getElementById('reg-email').value.trim();
        const phone = document.getElementById('reg-phone').value.trim() || 'Chưa cập nhật';
        const password = document.getElementById('reg-password').value;
        const confirmPassword = document.getElementById('reg-confirm-password').value;

        if (password !== confirmPassword) {
            errorEl.innerText = "Mật khẩu không khớp!";
            errorEl.classList.remove('hidden');
            return;
        }

        const secCheck = SecurityEngine.validatePasswordLevel5(password);
        if (!secCheck.valid) {
            errorEl.innerText = secCheck.msg;
            errorEl.classList.remove('hidden');
            return;
        }

        const users = await db.getUsersOnce();
        if (users.some(u => u.username === username)) {
            errorEl.innerText = "Tên đăng nhập đã tồn tại!";
            errorEl.classList.remove('hidden');
            return;
        }

        const newUser = {
            id: 'usr_' + Date.now() + '_' + Math.floor(Math.random() * 10000),
            username,
            passwordHash: await SecurityEngine.hashPassword(password),
            email,
            phone,
            displayName: username,
            icon: this.regSelectedBase64Image || 'fa-solid fa-user-ninja'
        };

        if (await db.saveUserToFirebase(newUser)) {
            alert("Đăng ký thành công!");
            window.location.href = 'login.html';
        }
    },

    async handleLogin(e) {
        e.preventDefault();
        db.clearSession();
        const errorEl = document.getElementById('login-error');
        errorEl.classList.add('hidden');

        const loginId = document.getElementById('login-id').value.trim();
        const password = document.getElementById('login-password').value;
        const users = await db.getUsersOnce();
        const hash = await SecurityEngine.hashPassword(password);

        const user = users.find(u => (u.username === loginId || u.email === loginId) && u.passwordHash === hash);
        if (!user) {
            errorEl.innerText = "Sai tài khoản hoặc mật khẩu!";
            errorEl.classList.remove('hidden');
            return;
        }

        db.setSession(user);
        window.location.href = 'chat-group.html';
    },

    logout() {
        db.clearSession();
        window.location.href = 'login.html';
    }
};
