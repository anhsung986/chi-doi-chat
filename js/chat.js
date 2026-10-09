/**
 * Real-Time Encrypted Broadcast Chat Engine
 * Hỗ trợ hiển thị Avatar, mã hóa AES-256 và Quản lý Danh sách Bạn bè/Thành viên.
 */
class ChatEngine {
    constructor() {
        this.channel = new BroadcastChannel('chidoi_chat_realtime');
        this.typingTimeout = null;
        this.allFriends = [];
        this.setupListeners();
    }

    setupListeners() {
        this.channel.onmessage = async (event) => {
            const { type, payload } = event.data;

            if (type === 'NEW_MESSAGE') {
                await this.renderSingleMessage(payload);
            } else if (type === 'TYPING_START') {
                this.showTyping(payload.user);
            } else if (type === 'TYPING_STOP') {
                this.hideTyping();
            } else if (type === 'MEMBER_UPDATED') {
                this.loadFriendsList();
            }
        };
    }

    // Nạp danh sách Bạn bè / Thành viên đã đăng ký trong hệ thống
    loadFriendsList() {
        const container = document.getElementById('friends-list');
        const countEl = document.getElementById('friends-count');
        if (!container) return;

        const users = db.getUsers();
        const currentUser = db.getSession();

        // Lọc tất cả thành viên (bao gồm bản thân và bạn bè)
        this.allFriends = users;
        if (countEl) countEl.innerText = users.length;

        this.renderFriends(users, currentUser);
    }

    renderFriends(usersList, currentUser) {
        const container = document.getElementById('friends-list');
        container.innerHTML = '';

        if (!usersList || usersList.length === 0) {
            container.innerHTML = `<div class="text-xs text-slate-500 text-center py-4">Chưa có thành viên nào</div>`;
            return;
        }

        usersList.forEach(u => {
            const isSelf = currentUser && (u.id === currentUser.id || u.username === currentUser.username);

            // Render Avatar dạng Image Base64 hoặc FontAwesome Icon
            let avatarHtml = '';
            if (u.icon && u.icon.startsWith('data:image/')) {
                avatarHtml = `<img src="${u.icon}" class="w-8 h-8 rounded-full object-cover border border-cyan-500/40" alt="avatar">`;
            } else {
                avatarHtml = `<div class="w-8 h-8 bg-slate-900 border border-slate-700 rounded-full flex items-center justify-center text-cyan-400 text-xs"><i class="${u.icon || 'fa-solid fa-user'}"></i></div>`;
            }

            const item = document.createElement('div');
            item.className = `flex items-center gap-3 p-2 rounded-xl transition hover:bg-slate-700/50 cursor-pointer ${isSelf ? 'bg-cyan-950/30 border border-cyan-800/40' : ''}`;
            
            item.innerHTML = `
                <div class="relative shrink-0">
                    ${avatarHtml}
                    <span class="w-2.5 h-2.5 rounded-full ${isSelf ? 'bg-cyan-400' : 'bg-emerald-400'} absolute bottom-0 right-0 border-2 border-slate-800"></span>
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between">
                        <span class="text-xs font-semibold text-slate-200 truncate">${SecurityEngine.sanitizeHTML(u.displayName || u.username)}</span>
                        ${isSelf ? '<span class="text-[9px] bg-cyan-900 text-cyan-300 px-1.5 py-0.5 rounded">Bạn</span>' : ''}
                    </div>
                    <div class="text-[10px] text-slate-400 truncate">@${SecurityEngine.sanitizeHTML(u.username)}</div>
                </div>
            `;

            container.appendChild(item);
        });
    }

    // Tìm kiếm bạn bè theo Tên hoặc Username
    filterFriends(keyword) {
        const query = keyword.toLowerCase().trim();
        const currentUser = db.getSession();

        if (!query) {
            this.renderFriends(this.allFriends, currentUser);
            return;
        }

        const filtered = this.allFriends.filter(u => 
            (u.displayName && u.displayName.toLowerCase().includes(query)) ||
            (u.username && u.username.toLowerCase().includes(query)) ||
            (u.email && u.email.toLowerCase().includes(query))
        );

        this.renderFriends(filtered, currentUser);
    }

    async loadHistory() {
        const container = document.getElementById('chat-messages');
        container.innerHTML = '';
        const messages = db.getMessages();
        for (const msg of messages) {
            await this.renderSingleMessage(msg);
        }
        container.scrollTop = container.scrollHeight;
    }

    async sendMessage(e) {
        e.preventDefault();
        const input = document.getElementById('chat-input');
        const rawText = input.value.trim();
        const currentUser = db.getSession();

        if (!rawText || !currentUser) return;

        const encryptedData = await SecurityEngine.encryptAESGCM(rawText);

        const msgPayload = {
            id: Date.now(),
            senderId: currentUser.id,
            senderUsername: currentUser.username,
            senderName: currentUser.displayName,
            senderIcon: currentUser.icon || 'fa-solid fa-user-ninja',
            encryptedData: encryptedData,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        db.saveMessage(msgPayload);
        await this.renderSingleMessage(msgPayload);
        this.channel.postMessage({ type: 'NEW_MESSAGE', payload: msgPayload });

        input.value = '';
        this.sendTypingStop();
    }

    async renderSingleMessage(msg) {
        const container = document.getElementById('chat-messages');
        const currentUser = db.getSession();
        
        const isSelf = currentUser && (
            (msg.senderId && msg.senderId === currentUser.id) || 
            (!msg.senderId && msg.senderUsername === currentUser.username)
        );

        let plainText = '';
        if (msg.encryptedData) {
            plainText = await SecurityEngine.decryptAESGCM(msg.encryptedData);
        } else {
            plainText = msg.text || '';
        }

        const sanitizedText = SecurityEngine.sanitizeHTML(plainText);

        let avatarHtml = '';
        if (msg.senderIcon && msg.senderIcon.startsWith('data:image/')) {
            avatarHtml = `<img src="${msg.senderIcon}" class="w-5 h-5 rounded-full object-cover border border-cyan-400/50" alt="avatar">`;
        } else {
            avatarHtml = `<i class="${msg.senderIcon || 'fa-solid fa-user'}"></i>`;
        }

        const msgDiv = document.createElement('div');
        msgDiv.className = `flex gap-2 mb-3 ${isSelf ? 'justify-end' : 'justify-start'}`;

        msgDiv.innerHTML = `
            <div class="max-w-[75%] ${isSelf ? 'bg-cyan-600 text-white rounded-l-xl rounded-tr-xl' : 'bg-slate-800 text-slate-100 rounded-r-xl rounded-tl-xl border border-slate-700'} p-3 shadow-md">
                <div class="flex items-center gap-2 mb-1 text-xs text-slate-300 font-semibold border-b border-white/10 pb-1">
                    ${avatarHtml}
                    <span>${msg.senderName}</span>
                    <span class="text-[10px] bg-cyan-950/80 text-cyan-400 px-1.5 py-0.5 rounded border border-cyan-800/50">AES-256</span>
                    <span class="text-[10px] opacity-60 ml-auto">${msg.time}</span>
                </div>
                <div class="text-sm break-words">${sanitizedText}</div>
            </div>
        `;

        container.appendChild(msgDiv);
        container.scrollTop = container.scrollHeight;
    }

    handleTyping() {
        const currentUser = db.getSession();
        if (!currentUser) return;

        this.channel.postMessage({
            type: 'TYPING_START',
            payload: { user: currentUser.displayName }
        });

        clearTimeout(this.typingTimeout);
        this.typingTimeout = setTimeout(() => {
            this.sendTypingStop();
        }, 2000);
    }

    sendTypingStop() {
        this.channel.postMessage({ type: 'TYPING_STOP' });
    }

    showTyping(username) {
        const el = document.getElementById('typing-indicator');
        el.innerHTML = `<i class="fa-solid fa-pen-nib animate-bounce mr-1"></i> ${username} đang viết...`;
    }

    hideTyping() {
        const el = document.getElementById('typing-indicator');
        el.innerText = '';
    }
}

const chat = new ChatEngine();
                                        
