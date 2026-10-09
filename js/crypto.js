/**
 * Security Engine Level 5
 * Xử lý mã hóa SHA-256 (Mật khẩu) và AES-GCM 256-bit (Tin nhắn & Dữ liệu) bằng Web Crypto API.
 */
const SecurityEngine = {
    // Khóa bí mật dùng để dẫn xuất khóa mã hóa AES-256
    MASTER_SECRET: 'CHI_DOI_CHAT_SEC_LVL_5_MASTER_KEY_2026',

    // Dẫn xuất CryptoKey (AES-GCM 256-bit) từ Secret Passphrase bằng PBKDF2
    async getEncryptionKey() {
        if (this._aesKey) return this._aesKey;
        const enc = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey(
            "raw",
            enc.encode(this.MASTER_SECRET),
            "PBKDF2",
            false,
            ["deriveKey"]
        );
        this._aesKey = await crypto.subtle.deriveKey(
            {
                name: "PBKDF2",
                salt: enc.encode("CHI_DOI_CHAT_SALT_SEC5_2026"),
                iterations: 100000,
                hash: "SHA-256"
            },
            keyMaterial,
            { name: "AES-GCM", length: 256 },
            false,
            ["encrypt", "decrypt"]
        );
        return this._aesKey;
    },

    // Mã hóa văn bản bằng thuật toán AES-GCM 256-bit
    async encryptAESGCM(plainText) {
        try {
            const key = await this.getEncryptionKey();
            // Khởi tạo Vector đo lường ngẫu nhiên (IV) 12-byte chuẩn AES-GCM
            const iv = crypto.getRandomValues(new Uint8Array(12));
            const encodedText = new TextEncoder().encode(plainText);

            const ciphertextBuffer = await crypto.subtle.encrypt(
                { name: "AES-GCM", iv: iv },
                key,
                encodedText
            );

            // Chuyển đổi ciphertext & IV sang chuỗi Hex để lưu trữ / truyền tải
            const ciphertextHex = Array.from(new Uint8Array(ciphertextBuffer))
                .map(b => b.toString(16).padStart(2, '0')).join('');
            const ivHex = Array.from(iv)
                .map(b => b.toString(16).padStart(2, '0')).join('');

            return { ciphertext: ciphertextHex, iv: ivHex };
        } catch (e) {
            console.error("AES-GCM Encryption error:", e);
            throw e;
        }
    },

    // Giải mã văn bản AES-GCM 256-bit
    async decryptAESGCM(encryptedData) {
        try {
            if (!encryptedData || !encryptedData.ciphertext || !encryptedData.iv) {
                return "[Dữ liệu không hợp lệ]";
            }

            const key = await this.getEncryptionKey();
            const iv = new Uint8Array(encryptedData.iv.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
            const ciphertext = new Uint8Array(encryptedData.ciphertext.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));

            const decryptedBuffer = await crypto.subtle.decrypt(
                { name: "AES-GCM", iv: iv },
                key,
                ciphertext
            );

            return new TextDecoder().decode(decryptedBuffer);
        } catch (e) {
            console.error("AES-GCM Decryption error:", e);
            return "[Cảnh báo: Tin nhắn không thể giải mã hoặc đã bị can thiệp]";
        }
    },

    // Băm mật khẩu SHA-256
    async hashPassword(password) {
        const msgUint8 = new TextEncoder().encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
        return Array.from(new Uint8Array(hashBuffer))
            .map(b => b.toString(16).padStart(2, '0')).join('');
    },

    // Kiểm tra độ mạnh mật khẩu Cấp 5
    validatePasswordLevel5(password) {
        if (password.length < 12) return { valid: false, msg: "Mật khẩu phải từ 12 ký tự trở lên!" };
        if (!/[A-Z]/.test(password)) return { valid: false, msg: "Mật khẩu phải chứa ít nhất 1 chữ cái HOA!" };
        if (!/[a-z]/.test(password)) return { valid: false, msg: "Mật khẩu phải chứa ít nhất 1 chữ cái thường!" };
        if (!/[0-9]/.test(password)) return { valid: false, msg: "Mật khẩu phải chứa ít nhất 1 chữ số!" };
        if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) return { valid: false, msg: "Mật khẩu phải chứa ít nhất 1 ký tự đặc biệt!" };
        return { valid: true };
    },

    // Chống XSS Sanitization
    sanitizeHTML(str) {
        const temp = document.createElement('div');
        temp.textContent = str;
        return temp.innerHTML;
    }
};
                     
