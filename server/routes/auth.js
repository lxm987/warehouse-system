const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { getDB } = require('../db');
const { generateToken } = require('../middleware/auth');

// POST /api/auth/register
router.post('/register', async (req, res) => {
    try {
        const { username, password, name, phone, email, securityQuestion, securityAnswer } = req.body;

        if (!username || !password || !name) {
            return res.status(400).json({ error: '昵称、密码、姓名为必填项' });
        }
        if (username.length < 2 || username.length > 20) {
            return res.status(400).json({ error: '昵称长度需为2-20个字符' });
        }
        if (!/^[a-zA-Z0-9_一-龥]+$/.test(username)) {
            return res.status(400).json({ error: '昵称只能包含字母、数字、下划线和中文' });
        }
        if (password.length < 6) {
            return res.status(400).json({ error: '密码长度不能少于6个字符' });
        }
        if (!securityQuestion || !securityAnswer) {
            return res.status(400).json({ error: '请选择密保问题并填写答案' });
        }
        if (phone && !/^1[3-9]\d{9}$/.test(phone)) {
            return res.status(400).json({ error: '手机号格式不正确' });
        }
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ error: '邮箱格式不正确' });
        }

        const db = getDB();

        const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
        if (existingUser) {
            return res.status(400).json({ error: '昵称已存在' });
        }

        if (email) {
            const existingEmail = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
            if (existingEmail) {
                return res.status(400).json({ error: '邮箱已被注册' });
            }
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const securityAnswerHash = await bcrypt.hash(securityAnswer, 10);

        const result = db.prepare(`INSERT INTO users (username, password_hash, name, phone, email, security_question, security_answer_hash)
            VALUES (?, ?, ?, ?, ?, ?, ?)`).run(username, passwordHash, name, phone || '', email || '', securityQuestion, securityAnswerHash);

        res.status(201).json({ id: result.lastInsertRowid, username, name });
    } catch (err) {
        res.status(500).json({ error: '注册失败: ' + err.message });
    }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { credential, password, method } = req.body;

        if (!credential || !password) {
            return res.status(400).json({ error: '请输入登录凭证和密码' });
        }

        const db = getDB();
        let user;

        if (method === 'email') {
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(credential)) {
                return res.status(400).json({ error: '邮箱格式不正确' });
            }
            user = db.prepare('SELECT * FROM users WHERE email = ?').get(credential);
        } else {
            if (!/^1[3-9]\d{9}$/.test(credential)) {
                return res.status(400).json({ error: '手机号格式不正确' });
            }
            user = db.prepare('SELECT * FROM users WHERE phone = ?').get(credential);
        }

        if (!user) {
            return res.status(400).json({ error: '手机号或邮箱未注册' });
        }

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
            return res.status(400).json({ error: '密码错误' });
        }

        db.prepare('UPDATE users SET last_login_at = datetime(\'now\',\'localtime\'), updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(user.id);

        const token = generateToken(user);
        res.json({
            token,
            user: { userId: user.id, username: user.username, name: user.name }
        });
    } catch (err) {
        res.status(500).json({ error: '登录失败: ' + err.message });
    }
});

// POST /api/auth/forgot-step1
router.post('/forgot-step1', (req, res) => {
    try {
        const { username } = req.body;
        if (!username) {
            return res.status(400).json({ error: '请输入昵称' });
        }

        const db = getDB();
        const user = db.prepare('SELECT id, security_question FROM users WHERE username = ?').get(username);
        if (!user) {
            return res.status(400).json({ error: '昵称不存在' });
        }

        res.json({ question: user.security_question, userId: user.id });
    } catch (err) {
        res.status(500).json({ error: '操作失败: ' + err.message });
    }
});

// POST /api/auth/forgot-reset
router.post('/forgot-reset', async (req, res) => {
    try {
        const { userId, answer, newPassword } = req.body;

        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ error: '新密码长度不能少于6个字符' });
        }

        const db = getDB();
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
        if (!user) {
            return res.status(400).json({ error: '用户不存在' });
        }

        const valid = await bcrypt.compare(answer, user.security_answer_hash);
        if (!valid) {
            return res.status(400).json({ error: '密保答案错误' });
        }

        const passwordHash = await bcrypt.hash(newPassword, 10);
        db.prepare('UPDATE users SET password_hash = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(passwordHash, userId);

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: '重置密码失败: ' + err.message });
    }
});

module.exports = router;
