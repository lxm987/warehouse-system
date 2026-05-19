const express = require('express');
const router = express.Router();
const { getDB } = require('../db');

// GET /api/ledger/summary
router.get('/summary', (req, res) => {
    try {
        const db = getDB();
        const totalGoods = db.prepare('SELECT COUNT(*) AS cnt FROM goods').get().cnt;
        const totalBatches = db.prepare('SELECT COUNT(*) AS cnt FROM cards').get().cnt;

        // Total current stock across all cards
        const stockResult = db.prepare(`
            SELECT COALESCE(SUM(c.quantity), 0) -
                   COALESCE((SELECT SUM(o.quantity) FROM outbound_records o WHERE o.card_id = c.id), 0) AS stock
            FROM cards c
        `).all();
        const totalStock = stockResult.reduce((sum, r) => sum + r.stock, 0);

        // Warning count
        const warningCount = db.prepare(`
            SELECT COUNT(*) AS cnt FROM goods g
            WHERE (SELECT COALESCE(SUM(c.quantity), 0) -
                          COALESCE((SELECT SUM(o.quantity) FROM outbound_records o WHERE o.card_id = c.id), 0)
                   FROM cards c WHERE c.goods_id = g.id) <= g.warning_threshold
              AND EXISTS (SELECT 1 FROM cards c WHERE c.goods_id = g.id)
        `).get().cnt;

        res.json({ totalGoods, totalBatches, totalStock, warningCount });
    } catch (err) {
        res.status(500).json({ error: '获取汇总失败: ' + err.message });
    }
});

// GET /api/ledger/low-stock
router.get('/low-stock', (req, res) => {
    try {
        const db = getDB();
        const items = db.prepare(`
            SELECT
                g.id AS goodsId,
                g.name AS goodsName,
                g.category,
                g.spec,
                g.unit,
                g.warning_threshold AS warningThreshold,
                COALESCE(SUM(c.quantity), 0) -
                COALESCE((SELECT COALESCE(SUM(o.quantity), 0) FROM outbound_records o WHERE o.card_id = c.id), 0) AS currentStock,
                g.warning_threshold -
                (COALESCE(SUM(c.quantity), 0) -
                COALESCE((SELECT COALESCE(SUM(o.quantity), 0) FROM outbound_records o WHERE o.card_id = c.id), 0)) AS difference
            FROM goods g
            LEFT JOIN cards c ON c.goods_id = g.id
            GROUP BY g.id
            HAVING currentStock <= g.warning_threshold
        `).all();
        res.json(items);
    } catch (err) {
        res.status(500).json({ error: '获取预警列表失败: ' + err.message });
    }
});

// GET /api/ledger
router.get('/', (req, res) => {
    try {
        const db = getDB();
        const { keyword, category } = req.query;
        let sql = `
            SELECT
                g.id AS goodsId,
                g.name AS goodsName,
                g.category,
                g.spec,
                g.unit,
                g.warning_threshold AS warningThreshold,
                COALESCE(SUM(c.quantity), 0) AS totalInbound,
                COALESCE((SELECT COALESCE(SUM(o.quantity), 0) FROM outbound_records o
                          JOIN cards c2 ON o.card_id = c2.id
                          WHERE c2.goods_id = g.id), 0) AS totalOutbound,
                COALESCE(SUM(c.quantity), 0) -
                COALESCE((SELECT COALESCE(SUM(o.quantity), 0) FROM outbound_records o
                          JOIN cards c2 ON o.card_id = c2.id
                          WHERE c2.goods_id = g.id), 0) AS currentStock,
                COUNT(c.id) AS batchCount
            FROM goods g
            LEFT JOIN cards c ON c.goods_id = g.id
            WHERE 1=1
        `;
        const params = [];
        if (keyword) {
            sql += ' AND g.name LIKE ?';
            params.push(`%${keyword}%`);
        }
        if (category) {
            sql += ' AND g.category = ?';
            params.push(category);
        }
        sql += ' GROUP BY g.id ORDER BY g.category, g.name';

        const ledger = db.prepare(sql).all(...params);
        res.json(ledger);
    } catch (err) {
        res.status(500).json({ error: '获取保管账失败: ' + err.message });
    }
});

// GET /api/ledger/stock-summary (alias for reports)
router.get('/stock-summary', (req, res) => {
    try {
        const db = getDB();
        const ledger = db.prepare(`
            SELECT
                g.name AS goodsName,
                g.category,
                g.spec,
                g.unit,
                COALESCE(SUM(c.quantity), 0) AS totalInbound,
                COALESCE((SELECT COALESCE(SUM(o.quantity), 0) FROM outbound_records o
                          JOIN cards c2 ON o.card_id = c2.id
                          WHERE c2.goods_id = g.id), 0) AS totalOutbound,
                COALESCE(SUM(c.quantity), 0) -
                COALESCE((SELECT COALESCE(SUM(o.quantity), 0) FROM outbound_records o
                          JOIN cards c2 ON o.card_id = c2.id
                          WHERE c2.goods_id = g.id), 0) AS currentStock
            FROM goods g
            LEFT JOIN cards c ON c.goods_id = g.id
            GROUP BY g.id ORDER BY g.category, g.name
        `).all();
        res.json(ledger);
    } catch (err) {
        res.status(500).json({ error: '获取报表失败: ' + err.message });
    }
});

module.exports = router;
