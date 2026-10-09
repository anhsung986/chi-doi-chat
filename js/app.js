/**
 * SPA Router & State Orchestrator
 */
function router(viewName) {
    const views = ['welcome', 'register', 'login', 'chat-group', 'profile', 'settings'];
    views.forEach(v => {
        const el = document.getElementById(`view-${v}`);
        if (el) el.classList.add('hidden');
    });

    const target = document.getElementById(`view-${viewName}`);
    if (target) target.classList.remove('hidden');

    if (viewName === 'chat-group') {
        chat.loadHistory();
    } else if (viewName === 'profile') {
        loadProfileData();
    }
}

function updateUIState() {
    const user = db.getSession();
    const navLinks = document.getElementById('nav-links');

    if (user) {
        navLinks.classList.remove('hidden');
        navLinks.classList.add('flex');
    } else {
        navLinks.classList.add('hidden');
        navLinks.classList.remove('flex');
    }
}

function loadProfileData() {
    const user = db.getSession();
    if (!user) return;

    document.getElementById('prof-display-name').innerText = user.displayName;
    document.getElementById('prof-username').innerText = user.username;
    document.getElementById('prof-email').innerText = user.email;
    document.getElementById('prof-phone').innerText = user.phone;
    document.getElementById('prof-icon-input').value = user.icon || 'fa-solid fa-user-ninja';
}

// Khởi chạy ban đầu
window.addEventListener('DOMContentLoaded', () => {
    updateUIState();
    const user = db.getSession();
    if (user) {
        router('chat-group');
    } else {
        router('welcome');
    }
});
