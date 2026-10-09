/**
 * Advanced Chat Engine with Encryption & Interactive Tools
 */
const chat = {
    currentRoomId: 'group',
    currentTargetUser: null,
    replyingMessage: null,
    typingTimeout: null,
    audioCtx: null,

    initRealtimeListeners() {
        const user = db.getSession();
        if (!user) return;

        // Kích hoạt Trạng thái Online
        db.initPresence(user.id);

        // Lắng nghe danh sách bạn bè / thành viên
        db.listenUsers((users) => {
            if (this.currentRoomId === 'group') {
                this.renderFriendsList(users, user);
            }
        });

        // Đăng ký sự kiện phím Đang gõ...
        const chatInput = document.getElementById('chat-input');
        if (chatInput) {
            chatInput.addEventListener('input', () => this.handleTypingEvent());
        }

        // Tải màu giao diện đã chọn
        this.applySavedTheme();
    },

    getPrivateRoomId(id1, id2) {
        return 'dm_' + [id1, id2].sort().join('_');
    },

    switchRoom(roomId, targetUser = null) {
        if (this.currentRoomId) {
            db.stopListenMessages(this.currentRoomId);
        }

        this.currentRoomId = roomId;
        this.currentTargetUser = targetUser;
        this.replyingMessage = null;
        this.clearReplyPreview();

        const messagesContainer = document.getElementById('chat-messages');
        if (messagesContainer) messagesContainer.innerHTML = '';

        // Lắng nghe Tin nhắn mới
        db.listenMessages(roomId, async (msg) => {
            await this.renderSingleMessage(msg);
        });

        // Lắng nghe Tin nhắn ghim
        db.listenPinnedMessage(roomId, (pinnedMsg) => {
            this.renderPinnedBar(pinnedMsg);
        });

        // Lắng nghe Đang gõ phím
        const currentUser = db.getSession();
        db.listenTypingStatus(roomId, currentUser.id, (typers) => {
            this.renderTypingIndicator(typers);
        });
    },

    async sendMessage(e) {
        e.preventDefault();
        const inputEl = document.getElementById('chat-input');
        const text = inputEl.value.trim();
        if (!text) return;

        const currentUser = db.getSession();
        const encryptedText = await SecurityEngine.encryptAES256(text);

        const msgObj = {
            id: 'msg_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
            senderId: currentUser.id,
            senderName: currentUser.displayName || currentUser.username,
            senderAvatar: currentUser.icon || 'fa-solid fa-user',
            text: encryptedText,
            type: 'text',
            timestamp: Date.now(),
            replyTo: this.replyingMessage ? {
                id: this.replyingMessage.id,
                senderName: this.replyingMessage.senderName,
                previewText: this.replyingMessage.decryptedText
            } : null
        };

        await db.saveMessageToFirebase(this.currentRoomId, msgObj);
        
        inputEl.value = '';
        this.clearReplyPreview();
        db.setTypingStatus(this.currentRoomId, currentUser.id, currentUser.username, false);
    },

    // Gửi Ảnh Mã Hóa Base64 (AES-256)
    triggerImageUpload() {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = async () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    const maxDim = 800;
                    let w = img.width, h = img.height;

                    if (w > maxDim || h > maxDim) {
                        if (w > h) { h = Math.round((h * maxDim) / w); w = maxDim; }
                        else { w = Math.round((w * maxDim) / h); h = maxDim; }
                    }

                    canvas.width = w;
                    canvas.height = h;
                    ctx.drawImage(img, 0, 0, w, h);

                    const base64Str = canvas.toDataURL('image/jpeg', 0.7);
                    const encryptedImage = await SecurityEngine.encryptAES256(base64Str);
                    const currentUser = db.getSession();

                    const msgObj = {
                        id: 'msg_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
                        senderId: currentUser.id,
                        senderName: currentUser.displayName || currentUser.username,
                        senderAvatar: currentUser.icon || 'fa-solid fa-user',
                        text: encryptedImage,
                        type: 'image',
                        timestamp: Date.now()
                    };

                    await db.saveMessageToFirebase(this.currentRoomId, msgObj);
                };
            };
            reader.readAsDataURL(file);
        };
        fileInput.click();
    },

    async renderSingleMessage(msg) {
        const container = document.getElementById('chat-messages');
        if (!container) return;

        const currentUser = db.getSession();
        const isMe = msg.senderId === currentUser.id;

        let decryptedText = '';
        if (msg.recalled) {
            decryptedText = '[Tin nhắn đã bị thu hồi]';
        } else {
            decryptedText = await SecurityEngine.decryptAES256(msg.text);
        }
        msg.decryptedText = decryptedText;

        const existingEl = document.getElementById(msg.id);
        if (existingEl) {
            this.updateMessageUI(msg);
            return;
        }

        const msgDiv = document.createElement('div');
        msgDiv.id = msg.id;
        msgDiv.className = `flex gap-3 mb-4 ${isMe ? 'flex-row-reverse' : 'flex-row'} items-start group`;

        // Avatar
        let avatarHtml = '';
        if (msg.senderAvatar && msg.senderAvatar.startsWith('data:image/')) {
            avatarHtml = `<img src="${msg.senderAvatar}" class="w-8 h-8 rounded-full object-cover border border-cyan-500 shrink-0" alt="avatar">`;
        } else {
            avatarHtml = `<div class="w-8 h-8 bg-slate-800 border border-slate-700 rounded-full flex items-center justify-center text-cyan-400 text-xs shrink-0"><i class="${msg.senderAvatar || 'fa-solid fa-user'}"></i></div>`;
        }

        // Reply Header
        let replyHtml = '';
        if (msg.replyTo) {
            replyHtml = `
                <div class="text-[10px] bg-black/30 border-l-2 border-cyan-400 pl-2 py-1 mb-1 rounded text-slate-300">
                    <span class="font-semibold text-cyan-400">@${SecurityEngine.sanitizeHTML(msg.replyTo.senderName)}:</span> ${SecurityEngine.sanitizeHTML(msg.replyTo.previewText.substring(0, 40))}...
                </div>
            `;
        }

        // Content (Text/Image)
        let contentHtml = '';
        if (msg.type === 'image' && !msg.recalled) {
            contentHtml = `<img src="${decryptedText}" class="max-w-xs sm:max-w-sm rounded-lg border border-slate-700 shadow-md cursor-pointer hover:opacity-90" onclick="window.open('${decryptedText}')" alt="image">`;
        } else {
            contentHtml = `<p class="text-sm whitespace-pre-wrap break-words ${msg.recalled ? 'italic text-slate-400' : ''}">${SecurityEngine.sanitizeHTML(decryptedText)}</p>`;
        }

        // Reactions list
        const reactionsHtml = this.renderReactionsList(msg.reactions);

        const timeStr = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        msgDiv.innerHTML = `
            ${avatarHtml}
            <div class="max-w-[75%] space-y-1">
                <div class="flex items-center gap-2 ${isMe ? 'justify-end' : 'justify-start'}">
                    <span class="text-[11px] font-semibold text-slate-400">${SecurityEngine.sanitizeHTML(msg.senderName)}</span>
                    <span class="text-[9px] text-slate-500">${timeStr}</span>
                </div>
                
                <div class="relative group/bubble">
                    <div class="p-3 rounded-2xl ${isMe ? 'bg-cyan-600 text-white rounded-tr-none' : 'bg-slate-800 text-slate-100 border border-slate-700 rounded-tl-none'} shadow-md">
                        ${replyHtml}
                        ${contentHtml}
                    </div>

                    <!-- Action Bar (Reply, Reaction, Pin, Recall) -->
                    <div class="absolute top-1/2 -translate-y-1/2 ${isMe ? '-left-28' : '-right-28'} hidden group-hover/bubble:flex items-center gap-1 bg-slate-800 border border-slate-700 p-1 rounded-lg shadow-lg z-10">
                        <button onclick="chat.setReplyTarget('${msg.id}', '${SecurityEngine.sanitizeHTML(msg.senderName)}', '${encodeURIComponent(decryptedText)}')" class="p-1 hover:text-cyan-400 text-xs text-slate-300" title="Trả lời"><i class="fa-solid fa-reply"></i></button>
                        <button onclick="chat.toggleEmojiMenu('${msg.id}')" class="p-1 hover:text-yellow-400 text-xs text-slate-300" title="Cảm xúc"><i class="fa-solid fa-face-smile"></i></button>
                        <button onclick="chat.pinMsg('${msg.id}')" class="p-1 hover:text-emerald-400 text-xs text-slate-300" title="Ghim"><i class="fa-solid fa-thumbtack"></i></button>
                        ${isMe && !msg.recalled ? `<button onclick="chat.recallMsg('${msg.id}')" class="p-1 hover:text-rose-400 text-xs text-slate-300" title="Thu hồi"><i class="fa-solid fa-rotate-left"></i></button>` : ''}
                    </div>

                    <!-- Emoji Popover Menu -->
                    <div id="emoji-popover-${msg.id}" class="hidden absolute top-full mt-1 ${isMe ? 'right-0' : 'left-0'} bg-slate-800 border border-slate-700 p-1.5 rounded-xl shadow-2xl flex gap-2 z-20">
                        <span onclick="chat.addReaction('${msg.id}', '👍')" class="cursor-pointer hover:scale-125 transition">👍</span>
                        <span onclick="chat.addReaction('${msg.id}', '❤️')" class="cursor-pointer hover:scale-125 transition">❤️</span>
                        <span onclick="chat.addReaction('${msg.id}', '😂')" class="cursor-pointer hover:scale-125 transition">😂</span>
                        <span onclick="chat.addReaction('${msg.id}', '😮')" class="cursor-pointer hover:scale-125 transition">😮</span>
                        <span onclick="chat.addReaction('${msg.id}', '😢')" class="cursor-pointer hover:scale-125 transition">😢</span>
                        <span onclick="chat.addReaction('${msg.id}', '🔥')" class="cursor-pointer hover:scale-125 transition">🔥</span>
                    </div>
                </div>

                <div id="reactions-box-${msg.id}">${reactionsHtml}</div>
            </div>
        `;

        container.appendChild(msgDiv);
        container.scrollTop = container.scrollHeight;

        // Phát âm thanh thông báo nếu tin nhắn đến từ người khác
        if (!isMe) this.playNotificationSound();
    },

    renderReactionsList(reactionsObj) {
        if (!reactionsObj) return '';
        const counts = {};
        Object.values(reactionsObj).forEach(e => counts[e] = (counts[e] || 0) + 1);
        
        const badges = Object.entries(counts).map(([emoji, count]) => `
            <span class="inline-flex items-center gap-0.5 bg-slate-800 border border-slate-700 text-[10px] px-1.5 py-0.5 rounded-full text-slate-200">
                <span>${emoji}</span> <span class="font-bold text-cyan-400">${count}</span>
            </span>
        `).join(' ');

        return `<div class="flex flex-wrap gap-1 mt-1">${badges}</div>`;
    },

    updateMessageUI(msg) {
        const msgEl = document.getElementById(msg.id);
        if (!msgEl) return;
        const reactionsBox = document.getElementById(`reactions-box-${msg.id}`);
        if (reactionsBox) {
            reactionsBox.innerHTML = this.renderReactionsList(msg.reactions);
        }
    },

    // Trả lời tin nhắn
    setReplyTarget(msgId, senderName, encodedText) {
        const decodedText = decodeURIComponent(encodedText);
        this.replyingMessage = { id: msgId, senderName, decryptedText: decodedText };

        let replyBar = document.getElementById('reply-preview-bar');
        if (!replyBar) {
            replyBar = document.createElement('div');
            replyBar.id = 'reply-preview-bar';
            replyBar.className = 'bg-slate-900 border-b border-slate-700 p-2 text-xs flex justify-between items-center text-slate-300';
            const chatForm = document.querySelector('form');
            if (chatForm) chatForm.parentNode.insertBefore(replyBar, chatForm);
        }

        replyBar.innerHTML = `
            <div class="flex items-center gap-2 truncate">
                <i class="fa-solid fa-reply text-cyan-400"></i>
                <span>Đang trả lời <strong class="text-cyan-400">@${senderName}</strong>: "${SecurityEngine.sanitizeHTML(decodedText.substring(0, 30))}..."</span>
            </div>
            <button onclick="chat.clearReplyPreview()" class="text-rose-400 hover:text-rose-300 font-bold ml-2"><i class="fa-solid fa-xmark"></i></button>
        `;
    },

    clearReplyPreview() {
        this.replyingMessage = null;
        const replyBar = document.getElementById('reply-preview-bar');
        if (replyBar) replyBar.remove();
    },

    // Emoji Popover
    toggleEmojiMenu(msgId) {
        const menu = document.getElementById(`emoji-popover-${msgId}`);
        if (menu) menu.classList.toggle('hidden');
    },

    async addReaction(msgId, emoji) {
        const currentUser = db.getSession();
        await db.toggleReaction(this.currentRoomId, msgId, currentUser.id, emoji);
        this.toggleEmojiMenu(msgId);
    },

    // Thu hồi
    async recallMsg(msgId) {
        if (confirm("Bạn có chắc chắn muốn thu hồi tin nhắn này?")) {
            await db.recallMessage(this.currentRoomId, msgId);
        }
    },

    // Ghim
    async pinMsg(msgId) {
        await db.pinMessage(this.currentRoomId, msgId, true);
    },

    renderPinnedBar(pinnedMsg) {
        let pinnedBar = document.getElementById('pinned-message-bar');
        if (!pinnedMsg) {
            if (pinnedBar) pinnedBar.remove();
            return;
        }

        if (!pinnedBar) {
            pinnedBar = document.createElement('div');
            pinnedBar.id = 'pinned-message-bar';
            pinnedBar.className = 'bg-slate-800/90 backdrop-blur border-b border-slate-700 p-2.5 px-4 text-xs flex justify-between items-center z-10';
            const messagesContainer = document.getElementById('chat-messages');
            if (messagesContainer) messagesContainer.parentNode.insertBefore(pinnedBar, messagesContainer);
        }

        pinnedBar.innerHTML = `
            <div class="flex items-center gap-2 text-cyan-400 font-semibold truncate">
                <i class="fa-solid fa-thumbtack text-amber-400 animate-bounce"></i>
                <span>Tin nhắn ghim (@${SecurityEngine.sanitizeHTML(pinnedMsg.senderName)}):</span>
                <span class="text-slate-200 font-normal truncate">${SecurityEngine.sanitizeHTML(pinnedMsg.text.substring(0, 45))}</span>
            </div>
            <button onclick="db.pinMessage('${this.currentRoomId}', null, false)" class="text-slate-400 hover:text-rose-400 ml-2"><i class="fa-solid fa-xmark"></i></button>
        `;
    },

    // Đang gõ phím (Typing)
    handleTypingEvent() {
        const currentUser = db.getSession();
        db.setTypingStatus(this.currentRoomId, currentUser.id, currentUser.username, true);

        clearTimeout(this.typingTimeout);
        this.typingTimeout = setTimeout(() => {
            db.setTypingStatus(this.currentRoomId, currentUser.id, currentUser.username, false);
        }, 3000);
    },

    renderTypingIndicator(typers) {
        let indicator = document.getElementById('typing-indicator-bar');
        if (typers.length === 0) {
            if (indicator) indicator.remove();
            return;
        }

        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'typing-indicator-bar';
            indicator.className = 'text-[11px] text-cyan-400 italic px-4 py-1 bg-slate-900 border-t border-slate-800 flex items-center gap-1';
            const chatForm = document.querySelector('form');
            if (chatForm) chatForm.parentNode.insertBefore(indicator, chatForm);
        }

        indicator.innerHTML = `<i class="fa-solid fa-pen-nib animate-pulse"></i> ${typers.join(', ')} đang soạn tin...`;
    },

    // Phát âm thanh Web Audio API
    playNotificationSound() {
        try {
            if (!this.audioCtx) this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(587.33, this.audioCtx.currentTime); // D5
            osc.frequency.exponentialRampToValueAtTime(880, this.audioCtx.currentTime + 0.15); // A5
            gain.gain.setValueAtTime(0.08, this.audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.2);
            osc.connect(gain);
            gain.connect(this.audioCtx.destination);
            osc.start();
            osc.stop(this.audioCtx.currentTime + 0.2);
        } catch(e) {}
    },

    // Tìm kiếm tin nhắn
    searchMessages(query) {
        const keyword = query.toLowerCase().trim();
        const msgDivs = document.querySelectorAll('#chat-messages > div');
        msgDivs.forEach(div => {
            const p = div.querySelector('p');
            if (p) {
                const text = p.innerText.toLowerCase();
                div.style.display = text.includes(keyword) ? 'flex' : 'none';
            }
        });
    },

    // Đổi màu chủ đạo (Theme Accent)
    setTheme(themeName) {
        sessionStorage.setItem('chidoi_theme', themeName);
        this.applySavedTheme();
    },

    applySavedTheme() {
        const theme = sessionStorage.getItem('chidoi_theme') || 'cyan';
        document.documentElement.setAttribute('data-theme', theme);
    },

    renderFriendsList(users, currentUser) {
        const container = document.getElementById('friends-list');
        const countEl = document.getElementById('friends-count');
        if (!container) return;

        container.innerHTML = '';
        if (countEl) countEl.innerText = users.length;

        users.forEach(u => {
            const isMe = u.id === currentUser.id;
            let avatarHtml = u.icon && u.icon.startsWith('data:image/') 
                ? `<img src="${u.icon}" class="w-8 h-8 rounded-full object-cover border border-cyan-500" alt="avatar">`
                : `<div class="w-8 h-8 bg-slate-900 border border-slate-700 rounded-full flex items-center justify-center text-cyan-400 text-xs"><i class="${u.icon || 'fa-solid fa-user'}"></i></div>`;

            const item = document.createElement('div');
            item.className = 'flex items-center gap-3 p-2 rounded-xl transition hover:bg-slate-700/50';
            item.innerHTML = `
                <div class="relative shrink-0">
                    ${avatarHtml}
                    <span class="w-2.5 h-2.5 rounded-full ${u.online ? 'bg-emerald-400' : 'bg-slate-500'} absolute bottom-0 right-0 border-2 border-slate-800"></span>
                </div>
                <div class="flex-1 min-w-0">
                    <div class="text-xs font-semibold text-slate-200 truncate">${SecurityEngine.sanitizeHTML(u.displayName || u.username)} ${isMe ? '(Bạn)' : ''}</div>
                    <div class="text-[10px] ${u.online ? 'text-emerald-400' : 'text-slate-500'}">${u.online ? 'Online' : 'Offline'}</div>
                </div>
            `;
            container.appendChild(item);
        });
    }
};
