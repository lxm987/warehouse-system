const express = require('express');
const router = express.Router();
const { getDB } = require('../db');
const { generateId } = require('../utils');

// GET /api/goods/categories
router.get('/categories', (req, res) => {
    try {
        const db = getDB();
        const rows = db.prepare('SELECT DISTINCT category FROM goods ORDER BY category').all();
        res.json(rows.map(r => r.category));
    } catch (err) {
        res.status(500).json({ error: '获取分类失败: ' + err.message });
    }
});

// GET /api/goods
router.get('/', (req, res) => {
    try {
        const db = getDB();
        const { keyword, category } = req.query;
        let sql = 'SELECT * FROM goods WHERE 1=1';
        const params = [];
        if (keyword) {
            sql += ' AND (name LIKE ? OR category LIKE ?)';
            params.push(`%${keyword}%`, `%${keyword}%`);
        }
        if (category) {
            sql += ' AND category = ?';
            params.push(category);
        }
        sql += ' ORDER BY created_at DESC';
        const goods = db.prepare(sql).all(...params);
        res.json(goods);
    } catch (err) {
        res.status(500).json({ error: '获取商品列表失败: ' + err.message });
    }
});

// GET /api/goods/:id
router.get('/:id', (req, res) => {
    try {
        const db = getDB();
        const goods = db.prepare('SELECT * FROM goods WHERE id = ?').get(req.params.id);
        if (!goods) {
            return res.status(404).json({ error: '商品不存在' });
        }
        res.json(goods);
    } catch (err) {
        res.status(500).json({ error: '获取商品失败: ' + err.message });
    }
});

// POST /api/goods
router.post('/', (req, res) => {
    try {
        const { name, category, spec, unit, warningThreshold } = req.body;

        if (!name || !category || !unit) {
            return res.status(400).json({ error: '商品名称、类别、单位为必填项' });
        }

        const db = getDB();
        const id = generateId();
        db.prepare(`INSERT INTO goods (id, name, category, spec, unit, warning_threshold, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?)`)
            .run(id, name, category, spec || '', unit, warningThreshold || 10, req.user.userId);

        const goods = db.prepare('SELECT * FROM goods WHERE id = ?').get(id);
        res.status(201).json(goods);
    } catch (err) {
        res.status(500).json({ error: '添加商品失败: ' + err.message });
    }
});

// PUT /api/goods/:id
router.put('/:id', (req, res) => {
    try {
        const { name, category, spec, unit, warningThreshold } = req.body;

        if (!name || !category || !unit) {
            return res.status(400).json({ error: '商品名称、类别、单位为必填项' });
        }

        const db = getDB();
        const goods = db.prepare('SELECT * FROM goods WHERE id = ?').get(req.params.id);
        if (!goods) {
            return res.status(404).json({ error: '商品不存在' });
        }

        db.prepare(`UPDATE goods SET name = ?, category = ?, spec = ?, unit = ?, warning_threshold = ?, updated_at = datetime('now','localtime')
            WHERE id = ?`)
            .run(name, category, spec || '', unit, warningThreshold || 10, req.params.id);

        // Also update denormalized data in cards
        db.prepare('UPDATE cards SET goods_name = ?, spec = ?, unit = ? WHERE goods_id = ?')
            .run(name, spec || '', unit, req.params.id);

        const updated = db.prepare('SELECT * FROM goods WHERE id = ?').get(req.params.id);
        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: '更新商品失败: ' + err.message });
    }
});

// DELETE /api/goods/:id
router.delete('/:id', (req, res) => {
    try {
        const db = getDB();
        const goods = db.prepare('SELECT * FROM goods WHERE id = ?').get(req.params.id);
        if (!goods) {
            return res.status(404).json({ error: '商品不存在' });
        }

        // FK CASCADE will delete related cards and outbound records
        db.prepare('DELETE FROM goods WHERE id = ?').run(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: '删除商品失败: ' + err.message });
    }
});

module.exports = router;
