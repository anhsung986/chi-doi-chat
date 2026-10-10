/**
 * Authentication Module
 */
const auth = {
    async register(username, email, phone, password, icon) {
        try {
            const validation = SecurityEngine.validatePasswordLevel5(password);
            if (!validation.valid) {
                alert(validation.msg);
                return;
            }
            const passwordHash = await SecurityEngine.hashPassword(password);
            const usersRef = database.ref('users');
            const snapshot = await usersRef.orderByChild('username').equalTo(username).once('value');
            
            if (snapshot.exists()) {
                alert("Tên tài khoản này đã tồn tại!");
                return;
            }

            const newUserRef = usersRef.push();
            const userId = newUserRef.key;
            const userData = {
                id: userId,
                username: username,
                displayName: username,
                email: email || '',
                phone: phone || '',
                passwordHash: passwordHash,
                icon: icon || 'fa-solid fa-shield-cat',
                online: true,
                createdAt: Date.now()
            };

            await newUserRef.set(userData);
            db.setSession(userData);
            alert("Đăng ký tài khoản bảo mật cấp 5 thành công!");
            window.location.href = 'home.html';
        } catch (e) {
            alert("Lỗi đăng ký: " + e.message);
        }
    },

    async login(username, password) {
        try {
            const passwordHash = await SecurityEngine.hashPassword(password);
            const usersRef = database.ref('users');
            const snapshot = await usersRef.orderByChild('username').equalTo(username).once('value');

            if (!snapshot.exists()) {
                alert("Tài khoản không tồn tại!");
                return;
            }

            let userData = null;
            snapshot.forEach((childSnapshot) => {
                userData = childSnapshot.val();
            });

            if (userData.passwordHash !== passwordHash) {
                alert("Sai mật khẩu hoặc thông tin xác thực không khớp!");
                return;
            }

            db.setSession(userData);
            database.ref('users/' + userData.id).update({ online: true });
            window.location.href = 'home.html';
        } catch (e) {
            alert("Lỗi đăng nhập: " + e.message);
        }
    },

    logout() {
        const u = db.getSession();
        if (u) {
            database.ref('users/' + u.id).update({ online: false });
        }
        db.clearSession();
        window.location.href = 'login.html';
    }
};
