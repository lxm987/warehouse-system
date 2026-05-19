const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'warehouse.db');
let db;

function initDB() {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            name TEXT NOT NULL,
            phone TEXT DEFAULT '',
            email TEXT DEFAULT '',
            security_question TEXT NOT NULL,
            security_answer_hash TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now', 'localtime')),
            updated_at TEXT DEFAULT (datetime('now', 'localtime')),
            last_login_at TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
        CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

        CREATE TABLE IF NOT EXISTS goods (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            spec TEXT DEFAULT '',
            unit TEXT NOT NULL,
            warning_threshold INTEGER DEFAULT 10,
            created_by INTEGER REFERENCES users(id),
            created_at TEXT DEFAULT (datetime('now', 'localtime')),
            updated_at TEXT DEFAULT (datetime('now', 'localtime'))
        );

        CREATE TABLE IF NOT EXISTS cards (
            id TEXT PRIMARY KEY,
            batch_no TEXT NOT NULL,
            goods_id TEXT NOT NULL REFERENCES goods(id) ON DELETE CASCADE,
            goods_name TEXT NOT NULL,
            spec TEXT DEFAULT '',
            unit TEXT DEFAULT '',
            quantity INTEGER NOT NULL,
            storage_location TEXT DEFAULT '',
            inbound_date TEXT NOT NULL,
            inbound_operator TEXT NOT NULL,
            inbound_reason TEXT DEFAULT '采购入库',
            inbound_remark TEXT DEFAULT '',
            created_by INTEGER REFERENCES users(id),
            created_at TEXT DEFAULT (datetime('now', 'localtime'))
        );
        CREATE INDEX IF NOT EXISTS idx_cards_goods_id ON cards(goods_id);
        CREATE INDEX IF NOT EXISTS idx_cards_batch_no ON cards(batch_no);

        CREATE TABLE IF NOT EXISTS outbound_records (
            id TEXT PRIMARY KEY,
            card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
            quantity INTEGER NOT NULL,
            date TEXT NOT NULL,
            reason TEXT NOT NULL,
            operator TEXT NOT NULL,
            remark TEXT DEFAULT '',
            created_by INTEGER REFERENCES users(id),
            created_at TEXT DEFAULT (datetime('now', 'localtime'))
        );
        CREATE INDEX IF NOT EXISTS idx_outbound_card_id ON outbound_records(card_id);
        CREATE INDEX IF NOT EXISTS idx_outbound_date ON outbound_records(date);

        CREATE TABLE IF NOT EXISTS modification_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            field TEXT NOT NULL,
            old_value TEXT NOT NULL,
            new_value TEXT NOT NULL,
            timestamp TEXT DEFAULT (datetime('now', 'localtime'))
        );
        CREATE INDEX IF NOT EXISTS idx_logs_user_id ON modification_logs(user_id);
    `);

    return db;
}

function getDB() { return db; }

function initSampleData() {
    const goodsCount = db.prepare('SELECT COUNT(*) AS cnt FROM goods').get();
    if (goodsCount.cnt > 0) return;

    const { generateId, generateBatchNo } = require('./utils');

    const goods = [
        { id: 'g001', name: '苹果', category: '食品', spec: '红富士', unit: '斤', warningThreshold: 50 },
        { id: 'g002', name: '大米', category: '食品', spec: '五常大米', unit: '袋', warningThreshold: 20 },
        { id: 'g003', name: '笔记本电脑', category: '电子产品', spec: 'MacBook Pro 14寸', unit: '台', warningThreshold: 5 },
        { id: 'g004', name: '打印机', category: '办公用品', spec: 'HP LaserJet', unit: '台', warningThreshold: 3 },
        { id: 'g005', name: '食用油', category: '食品', spec: '金龙鱼 5L', unit: '桶', warningThreshold: 30 }
    ];

    const insertGoods = db.prepare('INSERT OR IGNORE INTO goods (id, name, category, spec, unit, warning_threshold) VALUES (?, ?, ?, ?, ?, ?)');
    for (const g of goods) {
        insertGoods.run(g.id, g.name, g.category, g.spec, g.unit, g.warningThreshold);
    }

    const insertCard = db.prepare(`INSERT OR IGNORE INTO cards (id, batch_no, goods_id, goods_name, spec, unit, quantity, storage_location, inbound_date, inbound_operator, inbound_reason, inbound_remark)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const insertOutbound = db.prepare('INSERT OR IGNORE INTO outbound_records (id, card_id, quantity, date, reason, operator, remark) VALUES (?, ?, ?, ?, ?, ?, ?)');

    const cards = [
        { id: 'c001', batchNo: '20240115001', goodsId: 'g001', goodsName: '苹果', spec: '红富士', unit: '斤', quantity: 500, location: 'A区-1层-01架', date: '2024-01-15', operator: '张三', reason: '采购入库', remark: '春节备货',
            outbounds: [
                { id: 'o001', quantity: 100, date: '2024-01-18', reason: '销售', operator: '李四', remark: '批发' },
                { id: 'o002', quantity: 50, date: '2024-01-20', reason: '销售', operator: '李四', remark: '零售' }
            ]
        },
        { id: 'c002', batchNo: '20240116001', goodsId: 'g001', goodsName: '苹果', spec: '红富士', unit: '斤', quantity: 300, location: 'A区-1层-02架', date: '2024-01-16', operator: '张三', reason: '采购入库', remark: '',
            outbounds: [
                { id: 'o003', quantity: 80, date: '2024-01-19', reason: '销售', operator: '李四', remark: '' }
            ]
        },
        { id: 'c003', batchNo: '20240114001', goodsId: 'g002', goodsName: '大米', spec: '五常大米', unit: '袋', quantity: 100, location: 'B区-2层-03架', date: '2024-01-14', operator: '王五', reason: '采购入库', remark: '批量采购',
            outbounds: [
                { id: 'o004', quantity: 30, date: '2024-01-17', reason: '销售', operator: '李四', remark: '食堂采购' }
            ]
        },
        { id: 'c004', batchNo: '20240113001', goodsId: 'g003', goodsName: '笔记本电脑', spec: 'MacBook Pro 14寸', unit: '台', quantity: 10, location: 'C区-1层-01架', date: '2024-01-13', operator: '赵六', reason: '采购入库', remark: '公司采购',
            outbounds: [
                { id: 'o005', quantity: 2, date: '2024-01-15', reason: '领用', operator: '赵六', remark: '部门领用' }
            ]
        },
        { id: 'c005', batchNo: '20240112001', goodsId: 'g005', goodsName: '食用油', spec: '金龙鱼 5L', unit: '桶', quantity: 50, location: 'B区-1层-05架', date: '2024-01-12', operator: '张三', reason: '采购入库', remark: '',
            outbounds: []
        }
    ];

    for (const c of cards) {
        insertCard.run(c.id, c.batchNo, c.goodsId, c.goodsName, c.spec, c.unit, c.quantity, c.location, c.date, c.operator, c.reason, c.remark);
        for (const o of c.outbounds) {
            insertOutbound.run(o.id, c.id, o.quantity, o.date, o.reason, o.operator, o.remark);
        }
    }
}

module.exports = { initDB, getDB, initSampleData };
