(function() {
    'use strict';

    const API_BASE = '/api';
    const TOKEN_KEY = 'warehouse_token';

    function getToken() {
        try {
            const raw = localStorage.getItem(TOKEN_KEY);
            if (!raw) return null;
            const data = JSON.parse(raw);
            if (data.expiresAt && Date.now() > data.expiresAt) {
                localStorage.removeItem(TOKEN_KEY);
                return null;
            }
            return data.token;
        } catch {
            localStorage.removeItem(TOKEN_KEY);
            return null;
        }
    }

    async function request(method, path, body = null) {
        const headers = { 'Content-Type': 'application/json' };
        const token = getToken();
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const options = { method, headers };
        if (body && method !== 'GET') {
            options.body = JSON.stringify(body);
        }

        const response = await fetch(API_BASE + path, options);

        if (response.status === 401) {
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem('warehouse_current_user');
            window.location.reload();
            throw new Error('登录已过期');
        }

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(data.error || `请求失败 (${response.status})`);
        }

        return data;
    }

    const API = {
        // Auth
        register: (data) => request('POST', '/auth/register', data),
        login: (data) => request('POST', '/auth/login', data),
        forgotStep1: (username) => request('POST', '/auth/forgot-step1', { username }),
        forgotReset: (data) => request('POST', '/auth/forgot-reset', data),

        // Profile
        getProfile: () => request('GET', '/profile'),
        updateProfile: (data) => request('PUT', '/profile', data),
        updateProfileSecurity: (data) => request('PUT', '/profile/security', data),
        changePassword: (data) => request('PUT', '/profile/password', data),
        getModificationLogs: () => request('GET', '/profile/logs'),

        // Goods
        getGoods: (params = {}) => {
            const qs = new URLSearchParams();
            for (const [k, v] of Object.entries(params)) {
                if (v) qs.append(k, v);
            }
            const s = qs.toString();
            return request('GET', '/goods' + (s ? '?' + s : ''));
        },
        getGoodsById: (id) => request('GET', '/goods/' + id),
        createGoods: (data) => request('POST', '/goods', data),
        updateGoods: (id, data) => request('PUT', '/goods/' + id, data),
        deleteGoods: (id) => request('DELETE', '/goods/' + id),
        getCategories: () => request('GET', '/goods/categories'),

        // Cards
        getCards: (params = {}) => {
            const qs = new URLSearchParams();
            for (const [k, v] of Object.entries(params)) {
                if (v) qs.append(k, v);
            }
            const s = qs.toString();
            return request('GET', '/cards' + (s ? '?' + s : ''));
        },
        getCardById: (id) => request('GET', '/cards/' + id),
        createCard: (data) => request('POST', '/cards', data),
        deleteCard: (id) => request('DELETE', '/cards/' + id),
        addOutbound: (cardId, data) => request('POST', '/cards/' + cardId + '/outbound', data),

        // Ledger
        getLedger: (params = {}) => {
            const qs = new URLSearchParams();
            for (const [k, v] of Object.entries(params)) {
                if (v) qs.append(k, v);
            }
            const s = qs.toString();
            return request('GET', '/ledger' + (s ? '?' + s : ''));
        },
        getLedgerSummary: () => request('GET', '/ledger/summary'),
        getLowStock: () => request('GET', '/ledger/low-stock'),
        getStockSummary: () => request('GET', '/ledger/stock-summary'),

        // Backup
        exportBackup: () => request('GET', '/backup/export'),
        restoreBackup: (data) => request('POST', '/backup/restore', data),
        initializeSample: () => request('POST', '/backup/initialize-sample'),

        // Token management
        setToken: function(token) {
            const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
            localStorage.setItem(TOKEN_KEY, JSON.stringify({ token, expiresAt }));
        },

        clearToken: function() {
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem('warehouse_current_user');
        },

        getToken: getToken
    };

    window.API = API;
})();
