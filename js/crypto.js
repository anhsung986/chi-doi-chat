/**
 * Security Engine - SHA-256 Hash, AES-GCM 256-bit Encryption & XSS Sanitization
 */
const SecurityEngine = {
    // 1. Mã hóa mật khẩu chuẩn SHA-256 (Khớp chính xác với Firebase)
    async hashPassword(password) {
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    },

    // 2. Kiểm tra độ mạnh mật khẩu Cấp 5
    validatePasswordLevel5(password) {
        if (!password || password.length < 12) {
            return { valid: false, msg: "Mật khẩu cấp 5 yêu cầu tối thiểu 12 ký tự!" };
        }
        const hasUpper = /[A-Z]/.test(password);
        const hasLower = /[a-z]/.test(password);
        const hasNum = /[0-9]/.test(password);
        const hasSpecial = /[^A-Za-z0-9]/.test(password);

        if (!hasUpper || !hasLower || !hasNum || !hasSpecial) {
            return { valid: false, msg: "Mật khẩu phải chứa chữ HOA, chữ thường, số và ký tự đặc biệt!" };
        }
        return { valid: true };
    },

    // 3. XSS Sanitization chống tấn công mã độc
    sanitizeHTML(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },

    // 4. Mã hóa AES-256-GCM cho tin nhắn & ảnh
    async getAESKey() {
        const secretKeyMaterial = "ChiDoiPhoneChat_Secret_Encryption_Key_2026";
        const enc = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey(
            "raw",
            enc.encode(secretKeyMaterial.padEnd(32, '0').substring(0, 32)),
            { name: "PBKDF2" },
            false,
            ["deriveKey"]
        );
        return crypto.subtle.deriveKey(
            {
                name: "PBKDF2",
                salt: enc.encode("ChiDoisaltStatic"),
                iterations: 100000,
                hash: "SHA-256"
            },
            keyMaterial,
            { name: "AES-GCM", length: 256 },
            false,
            ["encrypt", "decrypt"]
        );
    },

    async encryptAES256(plainText) {
        try {
            if (!plainText) return '';
            const key = await this.getAESKey();
            const iv = crypto.getRandomValues(new Uint8Array(12));
            const encoded = new TextEncoder().encode(plainText);
            const cipherBuffer = await crypto.subtle.encrypt(
                { name: "AES-GCM", iv: iv },
                key,
                encoded
            );
            
            const combined = new Uint8Array(iv.length + cipherBuffer.byteLength);
            combined.set(iv);
            combined.set(new Uint8Array(cipherBuffer), iv.length);

            return btoa(String.fromCharCode.apply(null, combined));
        } catch (e) {
            return plainText;
        }
    },

    async decryptAES256(cipherBase64) {
        try {
            if (!cipherBase64 || (!cipherBase64.includes('==') && cipherBase64.length < 20)) {
                return cipherBase64;
            }
            const key = await this.getAESKey();
            const binaryString = atob(cipherBase64);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }

            const iv = bytes.slice(0, 12);
            const cipherBuffer = bytes.slice(12);

            const decryptedBuffer = await crypto.subtle.decrypt(
                { name: "AES-GCM", iv: iv },
                key,
                cipherBuffer
            );
            return new TextDecoder().decode(decryptedBuffer);
        } catch (e) {
            return cipherBase64;
        }
    }
};
    
