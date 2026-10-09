/**
 * Database Engine - Firebase Realtime Database Integration
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
            return [];
        }
    },

    listenUsers(callback) {
        if (!rtdb) return;
        rtdb.ref('users').on('value', (snapshot) => {
            const data = snapshot.val();
            callback(data ? Object.values(data) : []);
        });
    },

    initPresence(userId) {
        if (!rtdb || !userId) return;
        const myRef = rtdb.ref(`users/${userId}/online`);
        rtdb.ref('.info/connected').on('value', (snap) => {
            if (snap.val() === true) {
                myRef.onDisconnect().set(false);
                myRef.set(true);
            }
        });
    },

    getSession() {
        try {
            const data = sessionStorage.getItem('chidoi_session');
            return data ? JSON.parse(data) : null;
        } catch (e) {
            return null;
        }
    },

    setSession(user) {
        try {
            sessionStorage.setItem('chidoi_session', JSON.stringify(user));
            return true;
        } catch (e) {
            return false;
        }
    },

    clearSession() {
        sessionStorage.removeItem('chidoi_session');
        localStorage.removeItem('chidoi_session');
    },

    async saveMessageToFirebase(roomId, msg) {
        try {
            if (!rtdb) return;
            await rtdb.ref(`messages/${roomId}/${msg.id}`).set(msg);
        } catch (e) {
            alert("Gửi tin nhắn thất bại!");
        }
    },

    listenMessages(roomId, callback) {
        if (!rtdb) return;
        rtdb.ref(`messages/${roomId}`).on('child_added', (snapshot) => {
            const msg = snapshot.val();
            if (msg) callback(msg);
        });
        rtdb.ref(`messages/${roomId}`).on('child_changed', (snapshot) => {
            const msg = snapshot.val();
            if (msg && window.chat) window.chat.updateMessageUI(msg);
        });
    },

    stopListenMessages(roomId) {
        if (rtdb) rtdb.ref(`messages/${roomId}`).off();
    },

    async toggleReaction(roomId, msgId, userId, emoji) {
        if (!rtdb) return;
        const ref = rtdb.ref(`messages/${roomId}/${msgId}/reactions/${userId}`);
        const snap = await ref.once('value');
        if (snap.val() === emoji) await ref.remove();
        else await ref.set(emoji);
    },

    async recallMessage(roomId, msgId) {
        if (!rtdb) return;
        await rtdb.ref(`messages/${roomId}/${msgId}`).update({
            recalled: true,
            text: '[Tin nhắn đã bị thu hồi]',
            type: 'text'
        });
    },

    async pinMessage(roomId, msgId, isPinned) {
        if (!rtdb) return;
        if (isPinned) {
            const snap = await rtdb.ref(`messages/${roomId}/${msgId}`).once('value');
            await rtdb.ref(`pinned/${roomId}`).set(snap.val());
        } else {
            await rtdb.ref(`pinned/${roomId}`).remove();
        }
    },

    listenPinnedMessage(roomId, callback) {
        if (!rtdb) return;
        rtdb.ref(`pinned/${roomId}`).on('value', (snap) => callback(snap.val()));
    },

    setTypingStatus(roomId, userId, username, isTyping) {
        if (!rtdb) return;
        rtdb.ref(`typing/${roomId}/${userId}`).set(isTyping ? { username, timestamp: Date.now() } : null);
    },

    listenTypingStatus(roomId, currentUserId, callback) {
        if (!rtdb) return;
        rtdb.ref(`typing/${roomId}`).on('value', (snap) => {
            const data = snap.val() || {};
            const typers = Object.entries(data)
                .filter(([uid, val]) => uid !== currentUserId && val && (Date.now() - val.timestamp < 4000))
                .map(([_, val]) => val.username);
            callback(typers);
        });
    },

    // Quản lý Biệt danh cá nhân
    setLocalNickname(targetUserId, nickname) {
        const user = this.getSession();
        if (!user) return;
        localStorage.setItem(`nick_${user.id}_${targetUserId}`, nickname);
    },

    getLocalNickname(targetUserId, defaultName) {
        const user = this.getSession();
        if (!user) return defaultName;
        return localStorage.getItem(`nick_${user.id}_${targetUserId}`) || defaultName;
    },

    // Quản lý Mối quan hệ Người yêu
    async sendLoveProposal(fromUser, toUserId) {
        if (!rtdb) return;
        const proposalId = 'love_' + [fromUser.id, toUserId].sort().join('_');
        await rtdb.ref(`relationships/${proposalId}`).set({
            id: proposalId,
            fromId: fromUser.id,
            fromName: fromUser.displayName || fromUser.username,
            toId: toUserId,
            status: 'pending',
            timestamp: Date.now()
        });
    },

    async respondLoveProposal(proposalId, status) {
        if (!rtdb) return;
        await rtdb.ref(`relationships/${proposalId}`).update({ status });
    },

    listenRelationship(userId1, userId2, callback) {
        if (!rtdb) return;
        const proposalId = 'love_' + [userId1, userId2].sort().join('_');
        rtdb.ref(`relationships/${proposalId}`).on('value', (snap) => {
            callback(snap.val());
        });
    }
};
