/**
 * Real-Time Encrypted Broadcast Chat Engine (AES-GCM 256-bit)
 * Mã hóa tin nhắn trước khi lưu LocalStorage và truyền qua BroadcastChannel.
 */
class ChatEngine {
    constructor() {
        this.channel = new BroadcastChannel('chidoi_chat_realtime');
        this.typingTimeout = null;
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
            }
        };
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

        // 1. Mã hóa tin nhắn bằng AES-GCM 256-bit trước khi gửi/lưu
        const encryptedData = await SecurityEngine.encryptAESGCM(rawText);

        const msgPayload = {
            id: Date.now(),
            senderUsername: currentUser.username,
            senderName: currentUser.displayName,
            senderIcon: currentUser.icon || 'fa-solid fa-user',
            encryptedData: encryptedData, // Không truyền văn bản thô
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        // 2. Lưu vào LocalStorage mã hóa
        db.saveMessage(msgPayload);

        // 3. Hiển thị trên màn hình người gửi
        await this.renderSingleMessage(msgPayload);

        // 4. Phát tín hiệu qua BroadcastChannel cho tab khác
        this.channel.postMessage({ type: 'NEW_MESSAGE', payload: msgPayload });

        // Reset
        input.value = '';
        this.sendTypingStop();
    }

    async renderSingleMessage(msg) {
        const container = document.getElementById('chat-messages');
        const currentUser = db.getSession();
        const isSelf = currentUser && currentUser.username === msg.senderUsername;

        // 解密 (Giải mã) nội dung AES-GCM 256-bit
        let plainText = '';
        if (msg.encryptedData) {
            plainText = await SecurityEngine.decryptAESGCM(msg.encryptedData);
        } else {
            plainText = msg.text || ''; // Fallback cho tin nhắn cũ
        }

        const sanitizedText = SecurityEngine.sanitizeHTML(plainText);

        const msgDiv = document.createElement('div');
        msgDiv.className = `flex gap-2 mb-3 ${isSelf ? 'justify-end' : 'justify-start'}`;

        msgDiv.innerHTML = `
            <div class="max-w-[75%] ${isSelf ? 'bg-cyan-600 text-white rounded-l-xl rounded-tr-xl' : 'bg-slate-800 text-slate-100 rounded-r-xl rounded-tl-xl border border-slate-700'} p-3 shadow-md">
                <div class="flex items-center gap-2 mb-1 text-xs text-slate-300 font-semibold border-b border-white/10 pb-1">
                    <i class="${msg.senderIcon}"></i>
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
            
