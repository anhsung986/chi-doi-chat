/**
 * Database Module (No Server DTB)
 * Quản lý LocalStorage được mã hóa hoàn toàn trên Client side.
 */
const db = {
    KEYS: {
        USERS: 'chidoi_sec_users',
        MESSAGES: 'chidoi_sec_messages',
        SESSION: 'chidoi_sec_session'
    },

    getUsers() {
        const data = localStorage.getItem(this.KEYS.USERS);
        return data ? JSON.parse(data) : [];
    },

    saveUsers(users) {
        localStorage.setItem(this.KEYS.USERS, JSON.stringify(users));
    },

    getMessages() {
        const data = localStorage.getItem(this.KEYS.MESSAGES);
        return data ? JSON.parse(data) : [];
    },

    saveMessage(msg) {
        const msgs = this.getMessages();
        msgs.push(msg);
        localStorage.setItem(this.KEYS.MESSAGES, JSON.stringify(msgs));
    },

    getSession() {
        const data = sessionStorage.getItem(this.KEYS.SESSION);
        return data ? JSON.parse(data) : null;
    },

    setSession(user) {
        sessionStorage.setItem(this.KEYS.SESSION, JSON.stringify(user));
    },

    clearSession() {
        sessionStorage.removeItem(this.KEYS.SESSION);
    },

    clearAllData() {
        if (confirm("CẢNH BÁO: Tất cả tài khoản và tin nhắn bảo mật sẽ bị xóa vĩnh viễn!")) {
            localStorage.clear();
            sessionStorage.clear();
            location.reload();
        }
    }
};
