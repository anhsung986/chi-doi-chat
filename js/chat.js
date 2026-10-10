/**
 * Chat Logic & Realtime Communication Engine
 */
const chat = {
    currentRoomId: 'group',
    activeTarget: null,
    messagesRef: null,
    messagesListener: null,

    switchRoom(roomId, target = null) {
        this.currentRoomId = roomId;
        this.activeTarget = target;
        const msgContainer = document.getElementById('chat-messages');
        if (msgContainer) {
            msgContainer.innerHTML = '';
        }

        if (this.messagesRef && this.messagesListener) {
            this.messagesRef.off('child_added', this.messagesListener);
        }

        if (!window.database) {
            console.error("Firebase Database chưa được khởi tạo!");
            return;
        }

        this.messagesRef = window.database.ref('messages/' + roomId);
        this.messagesListener = this.messagesRef.limitToLast(50).on('child_added', async (snapshot) => {
            const msg = snapshot.val();
            if (msg) {
                await this.renderMessage(msg);
            }
        });
    },

    async sendMessage(event) {
        if (event) event.preventDefault();
        const input = document.getElementById('chat-input');
        if (!input) return;

        const text = input.value.trim();
        if (!text) return;

        const u = db.getSession();
        if (!u) {
            alert("Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại!");
            window.location.href = 'login.html';
            return;
        }

        if (!this.currentRoomId) {
            alert("Vui lòng chọn phòng chat hoặc người nhận trước khi gửi tin nhắn!");
            return;
        }

        try {
            const encryptedText = await SecurityEngine.encryptAES256(text);
            const msgData = {
                senderId: u.id,
                senderName: u.displayName || u.username,
                senderIcon: u.icon || 'fa-solid fa-shield-cat',
                text: encryptedText,
                type: 'text',
                timestamp: Date.now()
            };

            await window.database.ref('messages/' + this.currentRoomId).push(msgData);
            input.value = '';
        } catch (e) {
            alert("Không thể gửi tin nhắn. Lỗi: " + e.message);
            console.error("Send Message Error:", e);
        }
    },

    triggerImageUpload() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            if (file.size > 1024 * 1024 * 2) {
                alert("Dung lượng ảnh vượt quá giới hạn 2MB để mã hóa an toàn!");
                return;
            }
            const reader = new FileReader();
            reader.onload = async (uploadEvent) => {
                try {
                    const base64Img = uploadEvent.target.result;
                    const encryptedImg = await SecurityEngine.encryptAES256(base64Img);
                    const u = db.getSession();
                    const msgData = {
                        senderId: u.id,
                        senderName: u.displayName || u.username,
                        senderIcon: u.icon || 'fa-solid fa-shield-cat',
                        text: encryptedImg,
                        type: 'image',
                        timestamp: Date.now()
                    };
                    await window.database.ref('messages/' + this.currentRoomId).push(msgData);
                } catch (err) {
                    alert("Lỗi tải ảnh lên: " + err.message);
                }
            };
            reader.readAsDataURL(file);
        };
        input.click();
    },

    async renderMessage(msg) {
        const container = document.getElementById('chat-messages');
        if (!container) return;

        const u = db.getSession();
        if (!u) return;

        const isMe = msg.senderId === u.id;
        
        let decryptedContent = await SecurityEngine.decryptAES256(msg.text);
        let contentHtml = '';

        if (msg.type === 'image') {
            contentHtml = `<img src="${decryptedContent}" class="max-w-[220px] rounded-xl border border-slate-700 shadow-lg cursor-pointer" onclick="window.open(this.src)">`;
        } else {
            contentHtml = `<p class="text-xs md:text-sm break-words">${SecurityEngine.sanitizeHTML(decryptedContent)}</p>`;
        }

        const div = document.createElement('div');
        div.className = `flex gap-2.5 items-end ${isMe ? 'flex-row-reverse' : 'flex-row'}`;
        div.innerHTML = `
            <div class="w-7 h-7 bg-slate-900 border border-slate-700 rounded-full flex items-center justify-center text-cyan-400 text-xs shrink-0"><i class="${msg.senderIcon || 'fa-solid fa-user'}"></i></div>
            <div class="max-w-[75%] md:max-w-[65%] rounded-2xl px-3.5 py-2.5 shadow-md ${isMe ? 'bg-cyan-600 text-white rounded-br-sm' : 'bg-slate-800 text-slate-100 border border-slate-700 rounded-bl-sm'}">
                <div class="text-[10px] opacity-75 mb-0.5 font-semibold">${SecurityEngine.sanitizeHTML(msg.senderName)}</div>
                ${contentHtml}
            </div>
        `;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    },

    getPrivateRoomId(id1, id2) {
        return [id1, id2].sort().join('_');
    },

    promptChangeNickname(targetId, originalName) {
        const newNick = prompt(`Nhập biệt danh mới cho ${originalName}:`, originalName);
        if (newNick) {
            db.setLocalNickname(targetId, newNick);
            alert("Đã cập nhật biệt danh thành công!");
            location.reload();
        }
    },

    proposeLove(targetId, targetName) {
        const confirmLove = confirm(`Bạn có muốn gửi lời mời hẹn hò / tỏ tình đến ${targetName} ngay bây giờ không? ❤️`);
        if (confirmLove) {
            const u = db.getSession();
            window.database.ref('love_proposals/' + targetId).set({
                fromId: u.id,
                fromName: u.displayName || u.username,
                timestamp: Date.now()
            });
            alert("Đã gửi lời mời ngọt ngào thành công! Đang chờ đối phương phản hồi...");
        }
    },

    initLoveStatusListener(userId) {
        window.database.ref('love_proposals/' + userId).on('value', (snapshot) => {
            const proposal = snapshot.val();
            if (proposal) {
                const accept = confirm(`❤️ Nhận được lời mời hẹn hò từ ${proposal.fromName}! Bạn có đồng ý nhận lời không?`);
                if (accept) {
                    alert("🎉 Chúc mừng hai bạn đã chính thức trở thành đôi của nhau trên CHI DOI CHAT!");
                }
                window.database.ref('love_proposals/' + userId).remove();
            }
        });
    },

    setTheme(themeName) {
        localStorage.setItem('chat_theme', themeName);
        document.documentElement.setAttribute('data-theme', themeName);
        location.reload();
    },

    applySavedTheme() {
        const savedTheme = localStorage.getItem('chat_theme') || 'cyan';
        document.documentElement.setAttribute('data-theme', savedTheme);
    },

    initRealtimeListeners() {
        this.applySavedTheme();
    }
};
