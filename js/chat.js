/**
 * Real-Time Encrypted Chat Engine (Group & Direct Messaging)
 */
class ChatEngine {
    constructor() {
        this.allFriends = [];
        this.renderedMsgIds = new Set();
        this.activeRoomId = 'group'; // Mặc định là phòng chat nhóm
        this.activeTargetUser = null; // null: Nhóm, object User: Chat riêng
    }

    // Tạo Room ID cố định duy nhất cho 2 người dùng
    getPrivateRoomId(id1, id2) {
        return 'dm_' + [id1, id2].sort().join('_');
    }

    initRealtimeListeners() {
        // Lắng nghe danh sách bạn bè
        db.listenUsers((users) => {
            this.allFriends = users;
            const currentUser = db.getSession();
            this.renderFriends(users, currentUser);
        });

        // Mặc định vào Chat Nhóm
        this.switchRoom('group', null);
    }

    // Chuyển đổi giữa Chat Nhóm và Chat Riêng
    switchRoom(roomId, targetUser = null) {
        if (this.activeRoomId) {
            db.stopListenMessages(this.activeRoomId);
        }

        this.activeRoomId = roomId;
        this.activeTargetUser = targetUser;
        this.renderedMsgIds.clear();

        // Xóa khung chat hiện tại
        const container = document.getElementById('chat-messages');
        if (container) container.innerHTML = '';

        // Cập nhật tiêu đề khung chat
        const titleEl = document.getElementById('chat-room-title');
        const descEl = document.getElementById('chat-room-desc');
        if (titleEl) {
            if (targetUser) {
                titleEl.innerHTML = `<i class="fa-solid fa-lock text-cyan-400"></i> Chat Riêng: <span class="text-white">${SecurityEngine.sanitizeHTML(targetUser.displayName || targetUser.username)}</span>`;
                if (descEl) descEl.innerText = `Tin nhắn mã hóa AES-256 riêng tư với @${SecurityEngine.sanitizeHTML(targetUser.username)}`;
            } else {
                titleEl.innerHTML = `<i class="fa-solid fa-comments text-cyan-400"></i> CHI DOI CHAT ROOM (Nhóm)`;
                if (descEl) descEl.innerText = `Đồng bộ Firebase Realtime DB & Mã Hóa AES-GCM 256-bit`;
            }
        }

        // Đánh dấu người dùng đang được chọn trong Sidebar
        this.highlightActiveItem();

        // Lắng nghe tin nhắn từ phòng mới
        db.listenMessages(this.activeRoomId, async (msg) => {
            if (!this.renderedMsgIds.has(msg.id)) {
                this.renderedMsgIds.add(msg.id);
                await this.renderSingleMessage(msg);
            }
        });
    }

    highlightActiveItem() {
        const items = document.querySelectorAll('.sidebar-item');
        items.forEach(el => {
            const targetId = el.getAttribute('data-target-id');
            if ((!this.activeTargetUser && targetId === 'group') || (this.activeTargetUser && targetId === this.activeTargetUser.id)) {
                el.classList.add('bg-cyan-950', 'border-cyan-800');
                el.classList.remove('hover:bg-slate-700');
            } else {
                el.classList.remove('bg-cyan-950', 'border-cyan-800');
                el.classList.add('hover:bg-slate-700');
            }
        });
    }

    renderFriends(usersList, currentUser) {
        const container = document.getElementById('friends-list');
        const countEl = document.getElementById('friends-count');
        if (!container) return;

        if (countEl) countEl.innerText = usersList.length;
        container.innerHTML = '';

        // 1. Nút "Phòng Chat Nhóm" ở đầu danh sách
        const groupBtn = document.createElement('div');
        groupBtn.setAttribute('data-target-id', 'group');
        groupBtn.className = `sidebar-item flex items-center gap-3 p-2.5 rounded-xl transition cursor-pointer border border-transparent ${!this.activeTargetUser ? 'bg-cyan-950 border-cyan-800' : 'hover:bg-slate-700'}`;
        groupBtn.onclick = () => this.switchRoom('group', null);
        groupBtn.innerHTML = `
            <div class="w-8 h-8 bg-cyan-600/30 border border-cyan-500/50 rounded-full flex items-center justify-center text-cyan-400 text-xs shrink-0">
                <i class="fa-solid fa-users"></i>
            </div>
            <div class="flex-1 min-w-0">
                <div class="text-xs font-bold text-cyan-400">Phòng Chat Nhóm</div>
                <div class="text-[10px] text-slate-400 truncate">Tất cả thành viên</div>
            </div>
        `;
        container.appendChild(groupBtn);

        if (!usersList || usersList.length === 0) return;

        // 2. Danh sách thành viên (Nhấp vào để Chat Riêng)
        usersList.forEach(u => {
            const isSelf = currentUser && u.id === currentUser.id;

            let avatarHtml = '';
            if (u.icon && u.icon.startsWith('data:image/')) {
                avatarHtml = `<img src="${u.icon}" class="w-8 h-8 rounded-full object-cover border border-cyan-500" alt="avatar">`;
            } else {
                avatarHtml = `<div class="w-8 h-8 bg-slate-900 border border-slate-700 rounded-full flex items-center justify-center text-cyan-400 text-xs"><i class="${u.icon || 'fa-solid fa-user'}"></i></div>`;
            }

            const item = document.createElement('div');
            item.setAttribute('data-target-id', u.id);
            item.className = `sidebar-item flex items-center gap-3 p-2 rounded-xl transition cursor-pointer border border-transparent ${this.activeTargetUser && this.activeTargetUser.id === u.id ? 'bg-cyan-950 border-cyan-800' : 'hover:bg-slate-700'}`;
            
            if (isSelf) {
                item.onclick = () => alert("Đây là tài khoản của bạn!");
            } else {
                item.onclick = () => {
                    const privateRoomId = this.getPrivateRoomId(currentUser.id, u.id);
                    this.switchRoom(privateRoomId, u);
                };
            }

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

    filterFriends(keyword) {
        const query = keyword.toLowerCase().trim();
        const currentUser = db.getSession();

        if (!query) {
            this.renderFriends(this.allFriends, currentUser);
            return;
        }

        const filtered = this.allFriends.filter(u => 
            (u.displayName && u.displayName.toLowerCase().includes(query)) ||
            (u.username && u.username.toLowerCase().includes(query))
        );

        this.renderFriends(filtered, currentUser);
    }

    async sendMessage(e) {
        e.preventDefault();
        const input = document.getElementById('chat-input');
        const rawText = input.value.trim();
        const currentUser = db.getSession();

        if (!rawText || !currentUser) return;

        // Mã hóa AES-256
        const encryptedData = await SecurityEngine.encryptAESGCM(rawText);

        const msgPayload = {
            id: Date.now() + '_' + Math.floor(Math.random() * 1000),
            senderId: currentUser.id,
            senderUsername: currentUser.username,
            senderName: currentUser.displayName,
            senderIcon: currentUser.icon || 'fa-solid fa-user-ninja',
            encryptedData: encryptedData,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        await db.saveMessageToFirebase(this.activeRoomId, msgPayload);
        input.value = '';
    }

    async renderSingleMessage(msg) {
        const container = document.getElementById('chat-messages');
        if (!container) return;

        const currentUser = db.getSession();
        const isSelf = currentUser && currentUser.id === msg.senderId;

        let plainText = '';
        if (msg.encryptedData) {
            plainText = await SecurityEngine.decryptAESGCM(msg.encryptedData);
        } else {
            plainText = msg.text || '';
        }

        const sanitizedText = SecurityEngine.sanitizeHTML(plainText);

        let avatarHtml = '';
        if (msg.senderIcon && msg.senderIcon.startsWith('data:image/')) {
            avatarHtml = `<img src="${msg.senderIcon}" class="w-5 h-5 rounded-full object-cover border border-cyan-400" alt="avatar">`;
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
                    <span class="text-[10px] bg-cyan-950 text-cyan-400 px-1.5 py-0.5 rounded border border-cyan-800">AES-256</span>
                    <span class="text-[10px] opacity-60 ml-auto">${msg.time}</span>
                </div>
                <div class="text-sm break-words">${sanitizedText}</div>
            </div>
        `;

        container.appendChild(msgDiv);
        container.scrollTop = container.scrollHeight;
    }
}

const chat = new ChatEngine();
                
