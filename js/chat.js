/**
 * Advanced Chat Engine with Nickname & Love Proposal Extensions
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
        db.initPresence(user.id);
        db.listenUsers((users) => {
            if (this.currentRoomId === 'group') this.renderFriendsList(users, user);
        });
        const chatInput = document.getElementById('chat-input');
        if (chatInput) chatInput.addEventListener('input', () => this.handleTypingEvent());
        this.applySavedTheme();
    },

    getPrivateRoomId(id1, id2) {
        return 'dm_' + [id1, id2].sort().join('_');
    },

    switchRoom(roomId, targetUser = null) {
        if (this.currentRoomId) db.stopListenMessages(this.currentRoomId);
        this.currentRoomId = roomId;
        this.currentTargetUser = targetUser;
        this.replyingMessage = null;
        this.clearReplyPreview();

        const container = document.getElementById('chat-messages');
        if (container) container.innerHTML = '';

        db.listenMessages(roomId, async (msg) => await this.renderSingleMessage(msg));
        db.listenPinnedMessage(roomId, (pinned) => this.renderPinnedBar(pinned));
        
        const currentUser = db.getSession();
        db.listenTypingStatus(roomId, currentUser.id, (typers) => this.renderTypingIndicator(typers));
    },

    async sendMessage(e) {
        e.preventDefault();
        const inputEl = document.getElementById('chat-input');
        const text = inputEl.value.trim();
        if (!text) return;

        const currentUser = db.getSession();
        if (!currentUser) return window.location.href = 'login.html';

        try {
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
        } catch (err) {
            console.error(err);
        }
    },

    triggerImageUpload() {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                const img = new Image();
                img.src = ev.target.result;
                img.onload = async () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    canvas.width = 800; canvas.height = Math.round((img.height * 800) / img.width);
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    
                    const encryptedImage = await SecurityEngine.encryptAES256(canvas.toDataURL('image/jpeg', 0.7));
                    const currentUser = db.getSession();
                    await db.saveMessageToFirebase(this.currentRoomId, {
                        id: 'msg_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
                        senderId: currentUser.id,
                        senderName: currentUser.displayName || currentUser.username,
                        senderAvatar: currentUser.icon || 'fa-solid fa-user',
                        text: encryptedImage,
                        type: 'image',
                        timestamp: Date.now()
                    });
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
        const decryptedText = msg.recalled ? '[Tin nhắn đã bị thu hồi]' : await SecurityEngine.decryptAES256(msg.text);
        msg.decryptedText = decryptedText;

        if (document.getElementById(msg.id)) return this.updateMessageUI(msg);

        let senderDisplayName = msg.senderName;
        if (!isMe) {
            senderDisplayName = db.getLocalNickname(msg.senderId, msg.senderName);
        }

        const msgDiv = document.createElement('div');
        msgDiv.id = msg.id;
        msgDiv.className = `flex gap-3 mb-4 ${isMe ? 'flex-row-reverse' : 'flex-row'} items-start group`;

        const avatarHtml = msg.senderAvatar && msg.senderAvatar.startsWith('data:image/')
            ? `<img src="${msg.senderAvatar}" class="w-8 h-8 rounded-full object-cover border border-cyan-500 shrink-0">`
            : `<div class="w-8 h-8 bg-slate-800 border border-slate-700 rounded-full flex items-center justify-center text-cyan-400 text-xs shrink-0"><i class="${msg.senderAvatar || 'fa-solid fa-user'}"></i></div>`;

        const replyHtml = msg.replyTo ? `<div class="text-[10px] bg-black/30 border-l-2 border-cyan-400 pl-2 py-1 mb-1 rounded text-slate-300"><span class="font-semibold text-cyan-400">@${SecurityEngine.sanitizeHTML(msg.replyTo.senderName)}:</span> ${SecurityEngine.sanitizeHTML(msg.replyTo.previewText.substring(0, 30))}...</div>` : '';
        const contentHtml = msg.type === 'image' && !msg.recalled ? `<img src="${decryptedText}" class="max-w-xs rounded-lg border border-slate-700 shadow-md cursor-pointer" onclick="window.open('${decryptedText}')">` : `<p class="text-sm whitespace-pre-wrap break-words ${msg.recalled ? 'italic text-slate-400' : ''}">${SecurityEngine.sanitizeHTML(decryptedText)}</p>`;

        msgDiv.innerHTML = `
            ${avatarHtml}
            <div class="max-w-[75%] space-y-1">
                <div class="flex items-center gap-2 ${isMe ? 'justify-end' : 'justify-start'}">
                    <span class="text-[11px] font-semibold text-slate-400">${SecurityEngine.sanitizeHTML(senderDisplayName)}</span>
                    <span class="text-[9px] text-slate-500">${new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div class="relative group/bubble">
                    <div class="p-3 rounded-2xl ${isMe ? 'bg-cyan-600 text-white rounded-tr-none' : 'bg-slate-800 text-slate-100 border border-slate-700 rounded-tl-none'} shadow-md">
                        ${replyHtml} ${contentHtml}
                    </div>
                    <div class="absolute top-1/2 -translate-y-1/2 ${isMe ? '-left-28' : '-right-28'} hidden group-hover/bubble:flex items-center gap-1 bg-slate-800 border border-slate-700 p-1 rounded-lg shadow-lg z-10">
                        <button onclick="chat.setReplyTarget('${msg.id}', '${SecurityEngine.sanitizeHTML(senderDisplayName)}', '${encodeURIComponent(decryptedText)}')" class="p-1 hover:text-cyan-400 text-xs text-slate-300"><i class="fa-solid fa-reply"></i></button>
                        <button onclick="chat.toggleEmojiMenu('${msg.id}')" class="p-1 hover:text-yellow-400 text-xs text-slate-300"><i class="fa-solid fa-face-smile"></i></button>
                        <button onclick="chat.pinMsg('${msg.id}')" class="p-1 hover:text-emerald-400 text-xs text-slate-300"><i class="fa-solid fa-thumbtack"></i></button>
                        ${isMe && !msg.recalled ? `<button onclick="chat.recallMsg('${msg.id}')" class="p-1 hover:text-rose-400 text-xs text-slate-300"><i class="fa-solid fa-rotate-left"></i></button>` : ''}
                    </div>
                    <div id="emoji-popover-${msg.id}" class="hidden absolute top-full mt-1 ${isMe ? 'right-0' : 'left-0'} bg-slate-800 border border-slate-700 p-1.5 rounded-xl shadow-2xl flex gap-2 z-20">
                        <span onclick="chat.addReaction('${msg.id}', '👍')" class="cursor-pointer">👍</span>
                        <span onclick="chat.addReaction('${msg.id}', '❤️')" class="cursor-pointer">❤️</span>
                        <span onclick="chat.addReaction('${msg.id}', '😂')" class="cursor-pointer">😂</span>
                    </div>
                </div>
                <div id="reactions-box-${msg.id}">${this.renderReactionsList(msg.reactions)}</div>
            </div>
        `;
        container.appendChild(msgDiv);
        container.scrollTop = container.scrollHeight;
        if (!isMe) this.playNotificationSound();
    },

    renderReactionsList(reactionsObj) {
        if (!reactionsObj) return '';
        const counts = {};
        Object.values(reactionsObj).forEach(e => counts[e] = (counts[e] || 0) + 1);
        return `<div class="flex flex-wrap gap-1 mt-1">${Object.entries(counts).map(([em, cnt]) => `<span class="bg-slate-800 border border-slate-700 text-[10px] px-1.5 py-0.5 rounded-full text-slate-200">${em} <strong class="text-cyan-400">${cnt}</strong></span>`).join('')}</div>`;
    },

    updateMessageUI(msg) {
        const box = document.getElementById(`reactions-box-${msg.id}`);
        if (box) box.innerHTML = this.renderReactionsList(msg.reactions);
    },

    setReplyTarget(msgId, senderName, encodedText) {
        const decoded = decodeURIComponent(encodedText);
        this.replyingMessage = { id: msgId, senderName, decryptedText: decoded };
        let bar = document.getElementById('reply-preview-bar');
        if (!bar) {
            bar = document.createElement('div');
            bar.id = 'reply-preview-bar';
            bar.className = 'bg-slate-900 border-b border-slate-700 p-2 text-xs flex justify-between items-center text-slate-300';
            document.querySelector('form').parentNode.insertBefore(bar, document.querySelector('form'));
        }
        bar.innerHTML = `<span class="truncate">Trả lời <strong class="text-cyan-400">@${senderName}</strong>: "${decoded.substring(0, 30)}..."</span><button onclick="chat.clearReplyPreview()" class="text-rose-400"><i class="fa-solid fa-xmark"></i></button>`;
    },

    clearReplyPreview() {
        this.replyingMessage = null;
        const bar = document.getElementById('reply-preview-bar');
        if (bar) bar.remove();
    },

    toggleEmojiMenu(msgId) { document.getElementById(`emoji-popover-${msgId}`).classList.toggle('hidden'); },
    async addReaction(msgId, emoji) { await db.toggleReaction(this.currentRoomId, msgId, db.getSession().id, emoji); this.toggleEmojiMenu(msgId); },
    async recallMsg(msgId) { if (confirm("Thu hồi tin nhắn?")) await db.recallMessage(this.currentRoomId, msgId); },
    async pinMsg(msgId) { await db.pinMessage(this.currentRoomId, msgId, true); },

    renderPinnedBar(pinned) {
        let bar = document.getElementById('pinned-message-bar');
        if (!pinned) { if (bar) bar.remove(); return; }
        if (!bar) {
            bar = document.createElement('div');
            bar.id = 'pinned-message-bar';
            bar.className = 'bg-slate-800 border-b border-slate-700 p-2 px-4 text-xs flex justify-between items-center z-10';
            document.getElementById('chat-messages').parentNode.insertBefore(bar, document.getElementById('chat-messages'));
        }
        bar.innerHTML = `<span class="text-cyan-400 truncate"><i class="fa-solid fa-thumbtack text-amber-400"></i> Ghim: ${SecurityEngine.sanitizeHTML(pinned.text.substring(0, 35))}</span><button onclick="db.pinMessage('${this.currentRoomId}', null, false)" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button>`;
    },

    handleTypingEvent() {
        const u = db.getSession();
        db.setTypingStatus(this.currentRoomId, u.id, u.username, true);
        clearTimeout(this.typingTimeout);
        this.typingTimeout = setTimeout(() => db.setTypingStatus(this.currentRoomId, u.id, u.username, false), 3000);
    },

    renderTypingIndicator(typers) {
        let ind = document.getElementById('typing-indicator-bar');
        if (typers.length === 0) { if (ind) ind.remove(); return; }
        if (!ind) {
            ind = document.createElement('div');
            ind.id = 'typing-indicator-bar';
            ind.className = 'text-[11px] text-cyan-400 italic px-4 py-1 bg-slate-900 border-t border-slate-800';
            document.querySelector('form').parentNode.insertBefore(ind, document.querySelector('form'));
        }
        ind.innerHTML = `<i class="fa-solid fa-pen-nib animate-pulse"></i> ${typers.join(', ')} đang soạn tin...`;
    },

    playNotificationSound() {
        try {
            if (!this.audioCtx) this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            osc.frequency.setValueAtTime(587.33, this.audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(880, this.audioCtx.currentTime + 0.15);
            gain.gain.setValueAtTime(0.08, this.audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.2);
            osc.connect(gain); gain.connect(this.audioCtx.destination);
            osc.start(); osc.stop(this.audioCtx.currentTime + 0.2);
        } catch(e){}
    },

    searchMessages(q) {
        const kw = q.toLowerCase().trim();
        document.querySelectorAll('#chat-messages > div').forEach(d => {
            const p = d.querySelector('p');
            if (p) d.style.display = p.innerText.toLowerCase().includes(kw) ? 'flex' : 'none';
        });
    },

    setTheme(t) { sessionStorage.setItem('chidoi_theme', t); this.applySavedTheme(); },
    applySavedTheme() { document.documentElement.setAttribute('data-theme', sessionStorage.getItem('chidoi_theme') || 'cyan'); },

    renderFriendsList(users, currentUser) {
        const container = document.getElementById('friends-list');
        const countEl = document.getElementById('friends-count');
        if (!container) return;
        container.innerHTML = '';
        if (countEl) countEl.innerText = users.length;

        users.forEach(u => {
            const isMe = u.id === currentUser.id;
            const nick = db.getLocalNickname(u.id, u.displayName || u.username);
            const avatar = u.icon && u.icon.startsWith('data:image/') ? `<img src="${u.icon}" class="w-8 h-8 rounded-full object-cover border border-cyan-500">` : `<div class="w-8 h-8 bg-slate-900 border border-slate-700 rounded-full flex items-center justify-center text-cyan-400 text-xs"><i class="${u.icon || 'fa-solid fa-user'}"></i></div>`;

            const item = document.createElement('div');
            item.className = 'flex items-center gap-3 p-2 rounded-xl transition hover:bg-slate-700/50';
            item.innerHTML = `<div class="relative shrink-0">${avatar}<span class="w-2.5 h-2.5 rounded-full ${u.online ? 'bg-emerald-400' : 'bg-slate-500'} absolute bottom-0 right-0 border-2 border-slate-800"></span></div><div class="flex-1 min-w-0"><div class="text-xs font-semibold text-slate-200 truncate">${SecurityEngine.sanitizeHTML(nick)} ${isMe ? '(Bạn)' : ''}</div><div class="text-[10px] ${u.online ? 'text-emerald-400' : 'text-slate-500'}">${u.online ? 'Online' : 'Offline'}</div></div>`;
            container.appendChild(item);
        });
    },

    // Biệt danh & Người yêu Extensions
    promptChangeNickname(targetUserId, defaultName) {
        const current = db.getLocalNickname(targetUserId, defaultName);
        const name = prompt(`Nhập biệt danh cho @${defaultName}:`, current);
        if (name !== null) {
            db.setLocalNickname(targetUserId, name.trim() || defaultName);
            alert("Đã cập nhật biệt danh!");
            location.reload();
        }
    },

    async proposeLove(targetUserId, targetName) {
        const u = db.getSession();
        if (confirm(`Gửi lời mời làm người yêu đến @${targetName}?`)) {
            await db.sendLoveProposal(u, targetUserId);
            alert("Đã gửi lời mời!");
        }
    },

    initLoveStatusListener(targetUserId) {
        const u = db.getSession();
        if (!u) return;
        db.listenRelationship(u.id, targetUserId, (rel) => {
            let bar = document.getElementById('love-status-bar');
            if (!rel || rel.status === 'rejected') { if (bar) bar.remove(); return; }
            if (!bar) {
                bar = document.createElement('div');
                bar.id = 'love-status-bar';
                bar.className = 'bg-rose-950/90 border-b border-rose-800 p-2 px-4 text-xs flex justify-between items-center text-rose-300 z-10';
                document.getElementById('chat-messages').parentNode.insertBefore(bar, document.getElementById('chat-messages'));
            }
            if (rel.status === 'pending') {
                if (rel.fromId === u.id) {
                    bar.innerHTML = `<span><i class="fa-solid fa-heart text-rose-400 animate-pulse"></i> Đã gửi lời mời Người yêu, chờ phản hồi...</span>`;
                } else {
                    bar.innerHTML = `<span><i class="fa-solid fa-heart text-rose-400"></i> @${rel.fromName} muốn làm Người yêu của bạn!</span><div class="space-x-1"><button onclick="db.respondLoveProposal('${rel.id}', 'accepted')" class="bg-rose-600 text-white px-2 py-0.5 rounded">Đồng ý ❤️</button><button onclick="db.respondLoveProposal('${rel.id}', 'rejected')" class="bg-slate-700 text-slate-300 px-2 py-0.5 rounded">Từ chối</button></div>`;
                }
            } else if (rel.status === 'accepted') {
                bar.innerHTML = `<span class="mx-auto font-semibold text-rose-400"><i class="fa-solid fa-heart text-rose-500 animate-pulse"></i> Đang trong mối quan hệ Người yêu chính thức 💕</span>`;
            }
        });
    }
};
        
