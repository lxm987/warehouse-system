const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { getDB } = require('../db');

// GET /api/profile
router.get('/', (req, res) => {
    try {
        const db = getDB();
        const user = db.prepare('SELECT id, username, name, phone, email, security_question, created_at, updated_at, last_login_at FROM users WHERE id = ?').get(req.user.userId);
        if (!user) {
            return res.status(404).json({ error: '用户不存在' });
        }
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: '获取资料失败: ' + err.message });
    }
});

// PUT /api/profile
router.put('/', async (req, res) => {
    try {
        const db = getDB();
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.userId);
        if (!user) {
            return res.status(404).json({ error: '用户不存在' });
        }

        const { nickname } = req.body;
        const changes = [];

        if (nickname !== undefined && nickname !== user.username) {
            if (nickname.length < 2 || nickname.length > 20) {
                return res.status(400).json({ error: '昵称长度需为2-20个字符' });
            }
            if (!/^[a-zA-Z0-9_一-龥]+$/.test(nickname)) {
                return res.status(400).json({ error: '昵称只能包含字母、数字、下划线和中文' });
            }
            const existing = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(nickname, user.id);
            if (existing) {
                return res.status(400).json({ error: '昵称已存在' });
            }
            changes.push({ field: '昵称', oldValue: user.username, newValue: nickname });
            db.prepare('UPDATE users SET username = ? WHERE id = ?').run(nickname, user.id);
        }

        if (changes.length > 0) {
            db.prepare('UPDATE users SET updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(user.id);
            const insertLog = db.prepare('INSERT INTO modification_logs (user_id, field, old_value, new_value) VALUES (?, ?, ?, ?)');
            for (const c of changes) {
                insertLog.run(user.id, c.field, c.oldValue, c.newValue);
            }
        }

        const updated = db.prepare('SELECT id, username, name, phone, email FROM users WHERE id = ?').get(user.id);
        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: '更新失败: ' + err.message });
    }
});

// PUT /api/profile/security
router.put('/security', async (req, res) => {
    try {
        const db = getDB();
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.userId);
        if (!user) {
            return res.status(404).json({ error: '用户不存在' });
        }

        const { phone, email, nickname, answer } = req.body;

        if (!answer) {
            return res.status(400).json({ error: '请输入密保答案进行验证' });
        }
        const valid = await bcrypt.compare(answer, user.security_answer_hash);
        if (!valid) {
            return res.status(400).json({ error: '密保答案错误，验证失败' });
        }

        const changes = [];

        if (nickname !== undefined && nickname !== user.username) {
            if (nickname.length < 2 || nickname.length > 20) {
                return res.status(400).json({ error: '昵称长度需为2-20个字符' });
            }
            const existing = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(nickname, user.id);
            if (existing) {
                return res.status(400).json({ error: '昵称已存在' });
            }
            changes.push({ field: '昵称', oldValue: user.username, newValue: nickname });
            db.prepare('UPDATE users SET username = ? WHERE id = ?').run(nickname, user.id);
        }

        if (phone !== undefined && phone !== user.phone) {
            if (phone && !/^1[3-9]\d{9}$/.test(phone)) {
                return res.status(400).json({ error: '手机号格式不正确' });
            }
            changes.push({ field: 'phone', oldValue: user.phone || '(空)', newValue: phone || '(空)' });
            db.prepare('UPDATE users SET phone = ? WHERE id = ?').run(phone || '', user.id);
        }

        if (email !== undefined && email !== user.email) {
            if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                return res.status(400).json({ error: '邮箱格式不正确' });
            }
            changes.push({ field: 'email', oldValue: user.email || '(空)', newValue: email || '(空)' });
            db.prepare('UPDATE users SET email = ? WHERE id = ?').run(email || '', user.id);
        }

        if (changes.length === 0) {
            return res.status(400).json({ error: '没有需要修改的字段' });
        }

        db.prepare('UPDATE users SET updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(user.id);
        const insertLog = db.prepare('INSERT INTO modification_logs (user_id, field, old_value, new_value) VALUES (?, ?, ?, ?)');
        for (const c of changes) {
            insertLog.run(user.id, c.field, c.oldValue, c.newValue);
        }

        const updated = db.prepare('SELECT id, username, name, phone, email FROM users WHERE id = ?').get(user.id);
        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: '更新失败: ' + err.message });
    }
});

// PUT /api/profile/password
router.put('/password', async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body;

        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ error: '新密码长度不能少于6个字符' });
        }

        const db = getDB();
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.userId);
        if (!user) {
            return res.status(404).json({ error: '用户不存在' });
        }

        const valid = await bcrypt.compare(oldPassword, user.password_hash);
        if (!valid) {
            return res.status(400).json({ error: '原密码错误' });
        }

        const passwordHash = await bcrypt.hash(newPassword, 10);
        db.prepare('UPDATE users SET password_hash = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(passwordHash, user.id);

        db.prepare('INSERT INTO modification_logs (user_id, field, old_value, new_value) VALUES (?, ?, ?, ?)').run(user.id, 'password', '***', '***');

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: '修改密码失败: ' + err.message });
    }
});

// GET /api/profile/logs
router.get('/logs', (req, res) => {
    try {
        const db = getDB();
        const logs = db.prepare('SELECT field, old_value AS oldValue, new_value AS newValue, timestamp FROM modification_logs WHERE user_id = ? ORDER BY timestamp DESC').all(req.user.userId);
        res.json(logs);
    } catch (err) {
        res.status(500).json({ error: '获取日志失败: ' + err.message });
    }
});

module.exports = router;
