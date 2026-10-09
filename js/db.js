/**
 * Database Engine - Firebase Realtime Database Integration
 * Project: chi-doi-chat (CHI DOI CHAT)
 */
const firebaseConfig = {
  apiKey: "AIzaSyB_AoBl-M3fueTt78MRbkFJLL1uvdFZETU",
  authDomain: "chi-doi-chat.firebaseapp.com",
  databaseURL: "https://chi-doi-chat-default-rtdb.firebaseio.com",
  projectId: "chi-doi-chat",
  storageBucket: "chi-doi-chat.firebasestorage.app",
  messagingSenderId: "709788802946",
  appId: "1:709788802946:web:addef70bee7c734b10f99b",
  measurementId: "G-R4MW68KTME"
};

// Khởi tạo Firebase SDK Compat
if (typeof firebase !== 'undefined' && !firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const rtdb = (typeof firebase !== 'undefined') ? firebase.database() : null;

const db = {
    async saveUserToFirebase(user) {
        try {
            if (!rtdb) return false;
            await rtdb.ref('users/' + user.id).set(user);
            return true;
        } catch (e) {
            console.error("Lỗi lưu user Firebase:", e);
            alert("Lỗi kết nối Firebase Database!");
            return false;
        }
    },

    async getUsersOnce() {
        try {
            if (!rtdb) return [];
            const snapshot = await rtdb.ref('users').once('value');
            const data = snapshot.val();
            return data ? Object.values(data) : [];
        } catch (e) {
            console.error("Lỗi lấy danh sách users:", e);
            return [];
        }
    },

    listenUsers(callback) {
        if (!rtdb) return;
        rtdb.ref('users').on('value', (snapshot) => {
            const data = snapshot.val();
            const userList = data ? Object.values(data) : [];
            callback(userList);
        });
    },

    getSession() {
        try {
            const data = localStorage.getItem('chidoi_session');
            return data ? JSON.parse(data) : null;
        } catch (e) {
            return null;
        }
    },

    setSession(user) {
        try {
            localStorage.setItem('chidoi_session', JSON.stringify(user));
            return true;
        } catch (e) {
            console.error("Lỗi set session:", e);
            return false;
        }
    },

    clearSession() {
        localStorage.removeItem('chidoi_session');
    },

    async saveMessageToFirebase(msg) {
        try {
            if (!rtdb) return;
            await rtdb.ref('messages/' + msg.id).set(msg);
        } catch (e) {
            console.error("Lỗi gửi tin nhắn Firebase:", e);
        }
    },

    listenMessages(callback) {
        if (!rtdb) return;
        rtdb.ref('messages').on('child_added', (snapshot) => {
            const msg = snapshot.val();
            if (msg) callback(msg);
        });
    },

    clearAllData() {
        this.clearSession();
        alert('Đã xóa phiên đăng nhập trên thiết bị!');
        window.location.href = 'login.html';
    }
};
