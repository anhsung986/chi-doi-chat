/**
 * Real-Time Broadcast Chat Engine
 * Giúp Play(a) và Play(b) nhắn tin, nhận tin, hiện "Đang viết..." theo thời gian thực không qua Backend server.
 */
class ChatEngine {
    constructor() {
        this.channel = new BroadcastChannel('chidoi_chat_realtime');
        this.typingTimeout = null;
        this.setupListeners();
    }

    setupListeners() {
        // Lắng nghe sự kiện từ các tab/cửa sổ khác
        this.channel.onmessage = (event) => {
            const { type, payload } = event.data;

            if (type === 'NEW_MESSAGE') {
                this.renderSingleMessage(payload);
            } else if (type === 'TYPING_START') {
                this.showTyping(payload.user);
            } else if (type === 'TYPING_STOP') {
                this.hideTyping();
            }
        };
    }

    loadHistory() {
        const container = document.getElementById('chat-messages');
        container.innerHTML = '';
        const messages = db.getMessages();
        messages.forEach(msg => this.renderSingleMessage(msg));
        container.scrollTop = container.scrollHeight;
    }

    sendMessage(e) {
        e.preventDefault();
        const input = document.getElementById('chat-input');
        const text = input.value.trim();
        const currentUser = db.getSession();

        if (!text || !currentUser) return;

        const msgPayload = {
            id: Date.now(),
            senderUsername: currentUser.username,
            senderName: currentUser.displayName,
            senderIcon: currentUser.icon || 'fa-solid fa-user',
            text: SecurityEngine.sanitizeHTML(text),
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        // Lưu local
        db.saveMessage(msgPayload);

        // Hiển thị ở bản thân (Play A)
        this.renderSingleMessage(msgPayload);

        // Phát tín hiệu Real-time cho Play B
        this.channel.postMessage({ type: 'NEW_MESSAGE', payload: msgPayload });

        // Reset
        input.value = '';
        this.sendTypingStop();
    }

    renderSingleMessage(msg) {
        const container = document.getElementById('chat-messages');
        const currentUser = db.getSession();
        const isSelf = currentUser && currentUser.username === msg.senderUsername;

        const msgDiv = document.createElement('div');
        msgDiv.className = `flex gap-2 mb-3 ${isSelf ? 'justify-end' : 'justify-start'}`;

        msgDiv.innerHTML = `
            <div class="max-w-[75%] ${isSelf ? 'bg-cyan-600 text-white rounded-l-xl rounded-tr-xl' : 'bg-slate-800 text-slate-100 rounded-r-xl rounded-tl-xl border border-slate-700'} p-3 shadow-md">
                <div class="flex items-center gap-2 mb-1 text-xs text-slate-300 font-semibold border-b border-white/10 pb-1">
                    <i class="${msg.senderIcon}"></i>
                    <span>${msg.senderName}</span>
                    <span class="text-[10px] opacity-60 ml-auto">${msg.time}</span>
                </div>
                <div class="text-sm break-words">${msg.text}</div>
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
