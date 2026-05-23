(function() {
    'use strict';

    const SESSION_KEY = 'warehouse_current_user';

    const Auth = {

        async register(data) {
            const result = await API.register(data);
            return result;
        },

        async login(email, password) {
            if (!email || !password) {
                throw new Error('请输入邮箱和密码');
            }
            const result = await API.login({ email, password });
            const session = {
                userId: result.user.userId,
                username: result.user.username,
                name: result.user.name,
                email: result.user.email
            };
            localStorage.setItem(SESSION_KEY, JSON.stringify(session));
            return session;
        },

        async logout() {
            await API.logout();
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
            return this.getCurrentUser() !== null;
        },

        async restore() {
            // 从 Supabase session 恢复
            const session = await API.getSession();
            if (!session) return null;

            const profile = await API.getProfile();
            const userSession = {
                userId: profile.id,
                username: profile.username,
                name: profile.name,
                email: profile.email
            };
            localStorage.setItem(SESSION_KEY, JSON.stringify(userSession));
            return userSession;
        },

        async getUserProfile(userId) {
            return await API.getProfile();
        },

        async updateProfile(userId, data) {
            const result = await API.updateProfile({ nickname: data.nickname, name: data.name, phone: data.phone });
            const session = this.getCurrentUser();
            if (session && session.userId === userId) {
                session.username = result.username;
                session.name = result.name;
                localStorage.setItem(SESSION_KEY, JSON.stringify(session));
            }
            return result;
        },

        async updateProfileWithSecurity(userId, data, password) {
            const result = await API.updateProfileSecurity({
                phone: data.phone,
                email: data.email,
                password: password
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
            // 由 API 层自动记录
        },

        async getModificationLogs(userId) {
            return await API.getModificationLogs();
        },

        async changePassword(userId, oldPassword, newPassword) {
            if (!newPassword || newPassword.length < 6) throw new Error('新密码长度不能少于6个字符');
            await API.changePassword({ oldPassword, newPassword });
            return true;
        },

        async getSecurityQuestion(username) {
            // Supabase 版使用邮箱重置密码，密保问题不再使用
            return null;
        },

        async verifySecurityAnswer(userId, answer) {
            return true;
        },

        async resetPassword(userId, securityAnswer, newPassword) {
            // 兼容旧接口
            throw new Error('请使用邮箱重置密码功能');
        },

        async sendPasswordResetEmail(email) {
            if (!email) throw new Error('请输入注册邮箱');
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('邮箱格式不正确');
            const result = await API.forgotStep1(email);
            return result;
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
