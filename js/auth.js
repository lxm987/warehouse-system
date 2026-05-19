(function() {
    'use strict';

    const SESSION_KEY = 'warehouse_current_user';

    const Auth = {

        async register(data) {
            const result = await API.register(data);
            return result;
        },

        async login(credential, password, method) {
            if (!credential || !password) {
                throw new Error('请输入登录凭证和密码');
            }

            const result = await API.login({ credential, password, method });

            API.setToken(result.token);

            const session = {
                userId: result.user.userId,
                username: result.user.username,
                name: result.user.name
            };
            localStorage.setItem(SESSION_KEY, JSON.stringify(session));

            return session;
        },

        logout() {
            API.clearToken();
            localStorage.removeItem(SESSION_KEY);
        },

        getCurrentUser() {
            try {
                const data = localStorage.getItem(SESSION_KEY);
                return data ? JSON.parse(data) : null;
            } catch {
                return null;
            }
        },

        isLoggedIn() {
            return API.getToken() !== null && this.getCurrentUser() !== null;
        },

        async restore() {
            const profile = await API.getProfile();
            const session = {
                userId: profile.id,
                username: profile.username,
                name: profile.name
            };
            localStorage.setItem(SESSION_KEY, JSON.stringify(session));
            return session;
        },

        async getUserProfile(userId) {
            const profile = await API.getProfile();
            return {
                id: profile.id,
                username: profile.username,
                name: profile.name,
                phone: profile.phone,
                email: profile.email,
                securityQuestion: profile.security_question,
                createdAt: profile.created_at,
                updatedAt: profile.updated_at,
                lastLoginAt: profile.last_login_at
            };
        },

        async updateProfile(userId, data) {
            const result = await API.updateProfile({ nickname: data.nickname });
            const session = this.getCurrentUser();
            if (session && session.userId === userId) {
                session.username = result.username;
                session.name = result.name;
                localStorage.setItem(SESSION_KEY, JSON.stringify(session));
            }
            return result;
        },

        async updateProfileWithSecurity(userId, data, securityAnswer) {
            const result = await API.updateProfileSecurity({
                nickname: data.nickname,
                phone: data.phone,
                email: data.email,
                answer: securityAnswer
            });
            const session = this.getCurrentUser();
            if (session && session.userId === userId) {
                session.username = result.username;
                session.name = result.name;
                localStorage.setItem(SESSION_KEY, JSON.stringify(session));
            }
            return result;
        },

        async addModificationLog(userId, field, oldValue, newValue) {
            // Handled server-side, no client call needed
        },

        async getModificationLogs(userId) {
            return await API.getModificationLogs();
        },

        async changePassword(userId, oldPassword, newPassword) {
            await API.changePassword({ oldPassword, newPassword });
            return true;
        },

        async getSecurityQuestion(username) {
            const result = await API.forgotStep1(username);
            if (!result) return null;
            return { question: result.question, userId: result.userId };
        },

        async verifySecurityAnswer(userId, answer) {
            // Verification done server-side during reset
            return true;
        },

        async resetPassword(userId, securityAnswer, newPassword) {
            await API.forgotReset({ userId, answer: securityAnswer, newPassword });
            return true;
        },

        async getAllUsers() {
            return [];
        },

        async deleteUser(userId) {
            return true;
        }
    };

    window.Auth = Auth;
})();
