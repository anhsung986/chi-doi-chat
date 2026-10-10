/**
 * Database & Realtime State Manager (Firebase Compat SDK v10)
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

// Khởi tạo Firebase Compat SDK
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const database = firebase.database();

const db = {
    setSession(user) {
        sessionStorage.setItem('chat_session', JSON.stringify(user));
    },
    getSession() {
        const s = sessionStorage.getItem('chat_session');
        return s ? JSON.parse(s) : null;
    },
    clearSession() {
        sessionStorage.removeItem('chat_session');
    },

    initPresence(userId) {
        if (!userId) return;
        const userRef = database.ref('users/' + userId);
        userRef.update({ online: true });
        userRef.child('online').onDisconnect().set(false);
    },

    listenUsers(callback) {
        database.ref('users').on('value', (snapshot) => {
            const data = snapshot.val() || {};
            const users = Object.keys(data).map(key => ({ id: key, ...data[key] }));
            callback(users);
        }, (error) => {
            console.error("Lỗi đọc danh sách users:", error);
        });
    },

    getLocalNickname(targetId, defaultName) {
        const nicknames = JSON.parse(localStorage.getItem('chat_nicknames') || '{}');
        return nicknames[targetId] || defaultName;
    },

    setLocalNickname(targetId, nickname) {
        const nicknames = JSON.parse(localStorage.getItem('chat_nicknames') || '{}');
        nicknames[targetId] = nickname;
        localStorage.setItem('chat_nicknames', JSON.stringify(nicknames));
    }
};
