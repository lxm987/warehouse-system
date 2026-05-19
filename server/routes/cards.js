const express = require('express');
const router = express.Router();
const { getDB } = require('../db');
const { generateId } = require('../utils');

// GET /api/cards
router.get('/', (req, res) => {
    try {
        const db = getDB();
        const { keyword, goodsId } = req.query;
        let sql = 'SELECT * FROM cards WHERE 1=1';
        const params = [];
        if (keyword) {
            sql += ' AND (goods_name LIKE ? OR batch_no LIKE ?)';
            params.push(`%${keyword}%`, `%${keyword}%`);
        }
        if (goodsId) {
            sql += ' AND goods_id = ?';
            params.push(goodsId);
        }
        sql += ' ORDER BY created_at DESC';
        const cards = db.prepare(sql).all(...params);
        res.json(cards);
    } catch (err) {
        res.status(500).json({ error: '获取卡片列表失败: ' + err.message });
    }
});

// GET /api/cards/:id
router.get('/:id', (req, res) => {
    try {
        const db = getDB();
        const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(req.params.id);
        if (!card) {
            return res.status(404).json({ error: '卡片不存在' });
        }
        const outboundRecords = db.prepare('SELECT * FROM outbound_records WHERE card_id = ? ORDER BY date DESC').all(card.id);
        res.json({ ...card, outboundRecords });
    } catch (err) {
        res.status(500).json({ error: '获取卡片失败: ' + err.message });
    }
});

// POST /api/cards
router.post('/', (req, res) => {
    try {
        const { goodsId, batchNo, quantity, inboundDate, storageLocation, inboundOperator, inboundReason, inboundRemark } = req.body;

        if (!goodsId || !batchNo || !quantity || !inboundDate || !inboundOperator) {
            return res.status(400).json({ error: '商品、批次号、数量、日期、经手人为必填项' });
        }

        const db = getDB();
        const goods = db.prepare('SELECT * FROM goods WHERE id = ?').get(goodsId);
        if (!goods) {
            return res.status(400).json({ error: '商品不存在' });
        }

        const id = generateId();
        db.prepare(`INSERT INTO cards (id, batch_no, goods_id, goods_name, spec, unit, quantity, storage_location, inbound_date, inbound_operator, inbound_reason, inbound_remark, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(id, batchNo, goodsId, goods.name, goods.spec, goods.unit, parseInt(quantity), storageLocation || '', inboundDate, inboundOperator, inboundReason || '采购入库', inboundRemark || '', req.user.userId);

        const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(id);
        res.status(201).json({ ...card, outboundRecords: [] });
    } catch (err) {
        res.status(500).json({ error: '入库失败: ' + err.message });
    }
});

// DELETE /api/cards/:id
router.delete('/:id', (req, res) => {
    try {
        const db = getDB();
        const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(req.params.id);
        if (!card) {
            return res.status(404).json({ error: '卡片不存在' });
        }
        db.prepare('DELETE FROM cards WHERE id = ?').run(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: '删除卡片失败: ' + err.message });
    }
});

// POST /api/cards/:id/outbound
router.post('/:id/outbound', (req, res) => {
    try {
        const db = getDB();
        const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(req.params.id);
        if (!card) {
            return res.status(404).json({ error: '卡片不存在' });
        }

        const { quantity, date, reason, operator, remark } = req.body;
        const outQty = parseInt(quantity);
        if (!outQty || outQty <= 0) {
            return res.status(400).json({ error: '出库数量必须大于0' });
        }

        // Calculate current stock
        const outboundSum = db.prepare('SELECT COALESCE(SUM(quantity), 0) AS total FROM outbound_records WHERE card_id = ?').get(card.id);
        const currentStock = card.quantity - outboundSum.total;

        if (outQty > currentStock) {
            return res.status(400).json({ error: '出库数量超过当前库存' });
        }

        const id = generateId();
        db.prepare('INSERT INTO outbound_records (id, card_id, quantity, date, reason, operator, remark, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
            .run(id, card.id, outQty, date, reason, operator, remark || '', req.user.userId);

        const updatedCard = db.prepare('SELECT * FROM cards WHERE id = ?').get(card.id);
        const outboundRecords = db.prepare('SELECT * FROM outbound_records WHERE card_id = ? ORDER BY date DESC').all(card.id);
        res.json({ ...updatedCard, outboundRecords });
    } catch (err) {
        res.status(500).json({ error: '出库失败: ' + err.message });
    }
});

module.exports = router;
