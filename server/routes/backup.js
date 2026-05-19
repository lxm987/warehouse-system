const express = require('express');
const router = express.Router();
const { getDB, initSampleData } = require('../db');

// GET /api/backup/export
router.get('/export', (req, res) => {
    try {
        const db = getDB();
        const goods = db.prepare('SELECT id, name, category, spec, unit, warning_threshold AS warningThreshold FROM goods').all();
        const cards = db.prepare('SELECT * FROM cards').all();
        const outboundRecords = db.prepare('SELECT * FROM outbound_records').all();

        // Nest outbound records into their cards (matching frontend format)
        for (const card of cards) {
            card.outboundRecords = outboundRecords.filter(o => o.card_id === card.id);
        }
        // Remove flat outbound records
        const cardsClean = cards.map(c => {
            const { created_by, created_at, ...rest } = c;
            return rest;
        });

        const data = { goods, cards: cardsClean, ledger: [] };
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: '导出失败: ' + err.message });
    }
});

// POST /api/backup/restore
router.post('/restore', (req, res) => {
    try {
        const db = getDB();
        const { goods, cards } = req.body;

        if (!goods || !cards) {
            return res.status(400).json({ error: '无效的备份数据' });
        }

        // Clear existing data (order matters for FK)
        db.prepare('DELETE FROM outbound_records').run();
        db.prepare('DELETE FROM cards').run();
        db.prepare('DELETE FROM goods').run();

        // Restore goods
        const insertGoods = db.prepare('INSERT INTO goods (id, name, category, spec, unit, warning_threshold) VALUES (?, ?, ?, ?, ?, ?)');
        for (const g of goods) {
            insertGoods.run(g.id, g.name, g.category, g.spec || '', g.unit, g.warningThreshold || 10);
        }

        // Restore cards
        const insertCard = db.prepare(`INSERT INTO cards (id, batch_no, goods_id, goods_name, spec, unit, quantity, storage_location, inbound_date, inbound_operator, inbound_reason, inbound_remark)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
        const insertOutbound = db.prepare('INSERT INTO outbound_records (id, card_id, quantity, date, reason, operator, remark) VALUES (?, ?, ?, ?, ?, ?, ?)');

        for (const c of cards) {
            insertCard.run(c.id, c.batchNo, c.goodsId, c.goodsName, c.spec, c.unit, c.quantity, c.storageLocation || '', c.inboundDate, c.inboundOperator, c.inboundReason || '采购入库', c.inboundRemark || '');
            if (c.outboundRecords && Array.isArray(c.outboundRecords)) {
                for (const o of c.outboundRecords) {
                    insertOutbound.run(o.id, c.id, o.quantity, o.date, o.reason, o.operator, o.remark || '');
                }
            }
        }

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: '恢复失败: ' + err.message });
    }
});

// POST /api/backup/initialize-sample
router.post('/initialize-sample', (req, res) => {
    try {
        // Clear existing data first
        const db = getDB();
        db.prepare('DELETE FROM outbound_records').run();
        db.prepare('DELETE FROM cards').run();
        db.prepare('DELETE FROM goods').run();

        initSampleData();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: '初始化失败: ' + err.message });
    }
});

module.exports = router;
