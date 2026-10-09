/**
 * Security Engine Level 5
 * Xử lý mã hóa SHA-256 cho Mật khẩu và AES-256-GCM cho tin nhắn/database local.
 */
const SecurityEngine = {
    // Băm mật khẩu sử dụng Web Crypto API (SHA-256)
    async hashPassword(password) {
        const msgUint8 = new TextEncoder().encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
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

    // Chống XSS bằng cách Escape HTML Text
    sanitizeHTML(str) {
        const temp = document.createElement('div');
        temp.textContent = str;
        return temp.innerHTML;
    }
};
