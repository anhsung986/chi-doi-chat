/**
 * Cryptographic Engine - Web Crypto API
 * Chuẩn bảo mật Cấp 5 (SHA-256 Password Hash, AES-GCM 256 Message Encryption, Sanitization)
 */
const SecurityEngine = {
    validatePasswordLevel5(password) {
        if (!password || password.length < 12) {
            return { valid: false, msg: "Mật khẩu Cấp 5 phải có tối thiểu 12 ký tự!" };
        }
        if (!/[A-Z]/.test(password)) {
            return { valid: false, msg: "Mật khẩu phải chứa ít nhất 1 chữ cái HOA!" };
        }
        if (!/[a-z]/.test(password)) {
            return { valid: false, msg: "Mật khẩu phải chứa ít nhất 1 chữ cái thường!" };
        }
        if (!/[0-9]/.test(password)) {
            return { valid: false, msg: "Mật khẩu phải chứa ít nhất 1 chữ số!" };
        }
        if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
            return { valid: false, msg: "Mật khẩu phải chứa ít nhất 1 ký tự đặc biệt!" };
        }
        return { valid: true };
    },

    async hashPassword(password) {
        const encoder = new TextEncoder();
        const data = encoder.encode(password + "_chidoi_salt_sec5");
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    },

    async getAESKey() {
        const secret = "chidoi_chat_aes_key_2026_sec5";
        const enc = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey(
            "raw", enc.encode(secret), { name: "PBKDF2" }, false, ["deriveKey"]
        );
        return crypto.subtle.deriveKey(
            {
                name: "PBKDF2",
                salt: enc.encode("chidoi_fixed_salt"),
                iterations: 100000,
                hash: "SHA-256"
            },
            keyMaterial,
            { name: "AES-GCM", length: 256 },
            false,
            ["encrypt", "decrypt"]
        );
    },

    async encryptAESGCM(plainText) {
        try {
            const key = await this.getAESKey();
            const iv = crypto.getRandomValues(new Uint8Array(12));
            const enc = new TextEncoder();
            const ciphertext = await crypto.subtle.encrypt(
                { name: "AES-GCM", iv: iv },
                key,
                enc.encode(plainText)
            );

            const ivBase64 = btoa(String.fromCharCode(...iv));
            const cipherBase64 = btoa(String.fromCharCode(...new Uint8Array(ciphertext)));

            return JSON.stringify({ iv: ivBase64, data: cipherBase64 });
        } catch (e) {
            console.error("Encryption Error:", e);
            return plainText;
        }
    },

    async decryptAESGCM(encryptedPayload) {
        try {
            const payload = JSON.parse(encryptedPayload);
            const key = await this.getAESKey();

            const iv = Uint8Array.from(atob(payload.iv), c => c.charCodeAt(0));
            const ciphertext = Uint8Array.from(atob(payload.data), c => c.charCodeAt(0));

            const decrypted = await crypto.subtle.decrypt(
                { name: "AES-GCM", iv: iv },
                key,
                ciphertext
            );

            return new TextDecoder().decode(decrypted);
        } catch (e) {
            return typeof encryptedPayload === 'string' ? encryptedPayload : '[Tin nhắn mã hóa]';
        }
    },

    sanitizeHTML(str) {
        if (!str) return '';
        return str.replace(/[&<>"']/g, function (m) {
            return {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#039;'
            }[m];
        });
    }
};
