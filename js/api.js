(function() {
    'use strict';

    const TOKEN_KEY = 'warehouse_token';

    // ==================== Storage helpers ====================

    function ld(key) {
        try { const d = localStorage.getItem(key); return d ? JSON.parse(d) : null; } catch { return null; }
    }
    function sv(key, val) {
        try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch { return false; }
    }

    const K = {
        USERS: 'wh_users',
        GOODS: 'wh_goods',
        CARDS: 'wh_cards',
        LEDGER: 'wh_ledger',
        LOGS: 'wh_logs',
        ID_SEQ: 'wh_id_seq'
    };

    function nextId() {
        const seq = (ld(K.ID_SEQ) || 0) + 1;
        sv(K.ID_SEQ, seq);
        return seq;
    }
    function gid() { return 'g' + String(nextId()).padStart(3, '0'); }
    function cid() { return 'c' + String(nextId()).padStart(3, '0'); }
    function oid() { return 'o' + String(nextId()).padStart(3, '0'); }
    function now() { return new Date().toISOString().replace('T', ' ').slice(0, 19); }

    // ==================== Crypto ====================

    async function sha256(text) {
        const encoder = new TextEncoder();
        const data = encoder.encode(text);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    function genToken() {
        const arr = new Uint8Array(32);
        crypto.getRandomValues(arr);
        return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
    }

    // ==================== Token ====================

    function getToken() {
        try {
            const raw = localStorage.getItem(TOKEN_KEY);
            if (!raw) return null;
            const data = JSON.parse(raw);
            if (data.expiresAt && Date.now() > data.expiresAt) {
                localStorage.removeItem(TOKEN_KEY);
                localStorage.removeItem('warehouse_current_user');
                return null;
            }
            return data.token;
        } catch {
            localStorage.removeItem(TOKEN_KEY);
            return null;
        }
    }

    function getUserIdFromToken() {
        const raw = localStorage.getItem(TOKEN_KEY);
        if (!raw) return null;
        try {
            const data = JSON.parse(raw);
            return data.userId || null;
        } catch { return null; }
    }

    // ==================== Sample data ====================

    function seedSampleData() {
        const goods = [
            { id: 'g001', name: '苹果', category: '食品', spec: '红富士', unit: '斤', warning_threshold: 50, created_at: '2024-01-10 08:00:00', updated_at: '2024-01-10 08:00:00' },
            { id: 'g002', name: '大米', category: '食品', spec: '五常大米', unit: '袋', warning_threshold: 20, created_at: '2024-01-10 08:00:00', updated_at: '2024-01-10 08:00:00' },
            { id: 'g003', name: '笔记本电脑', category: '电子产品', spec: 'MacBook Pro 14寸', unit: '台', warning_threshold: 5, created_at: '2024-01-10 08:00:00', updated_at: '2024-01-10 08:00:00' },
            { id: 'g004', name: '打印机', category: '办公用品', spec: 'HP LaserJet', unit: '台', warning_threshold: 3, created_at: '2024-01-10 08:00:00', updated_at: '2024-01-10 08:00:00' },
            { id: 'g005', name: '食用油', category: '食品', spec: '金龙鱼 5L', unit: '桶', warning_threshold: 30, created_at: '2024-01-10 08:00:00', updated_at: '2024-01-10 08:00:00' }
        ];
        sv(K.GOODS, goods);

        const cards = [
            { id: 'c001', batch_no: '20240115001', goods_id: 'g001', goods_name: '苹果', spec: '红富士', unit: '斤', quantity: 500, storage_location: 'A区-1层-01架', inbound_date: '2024-01-15', inbound_operator: '张三', inbound_reason: '采购入库', inbound_remark: '春节备货', created_at: '2024-01-15 08:00:00',
                outboundRecords: [
                    { id: 'o001', quantity: 100, date: '2024-01-18', reason: '销售', operator: '李四', remark: '批发' },
                    { id: 'o002', quantity: 50, date: '2024-01-20', reason: '销售', operator: '李四', remark: '零售' }
                ] },
            { id: 'c002', batch_no: '20240116001', goods_id: 'g001', goods_name: '苹果', spec: '红富士', unit: '斤', quantity: 300, storage_location: 'A区-1层-02架', inbound_date: '2024-01-16', inbound_operator: '张三', inbound_reason: '采购入库', inbound_remark: '', created_at: '2024-01-16 08:00:00',
                outboundRecords: [
                    { id: 'o003', quantity: 80, date: '2024-01-19', reason: '销售', operator: '李四', remark: '' }
                ] },
            { id: 'c003', batch_no: '20240114001', goods_id: 'g002', goods_name: '大米', spec: '五常大米', unit: '袋', quantity: 100, storage_location: 'B区-2层-03架', inbound_date: '2024-01-14', inbound_operator: '王五', inbound_reason: '采购入库', inbound_remark: '批量采购', created_at: '2024-01-14 08:00:00',
                outboundRecords: [
                    { id: 'o004', quantity: 30, date: '2024-01-17', reason: '销售', operator: '李四', remark: '食堂采购' }
                ] },
            { id: 'c004', batch_no: '20240113001', goods_id: 'g003', goods_name: '笔记本电脑', spec: 'MacBook Pro 14寸', unit: '台', quantity: 10, storage_location: 'C区-1层-01架', inbound_date: '2024-01-13', inbound_operator: '赵六', inbound_reason: '采购入库', inbound_remark: '公司采购', created_at: '2024-01-13 08:00:00',
                outboundRecords: [
                    { id: 'o005', quantity: 2, date: '2024-01-15', reason: '领用', operator: '赵六', remark: '部门领用' }
                ] },
            { id: 'c005', batch_no: '20240112001', goods_id: 'g005', goods_name: '食用油', spec: '金龙鱼 5L', unit: '桶', quantity: 50, storage_location: 'B区-1层-05架', inbound_date: '2024-01-12', inbound_operator: '张三', inbound_reason: '采购入库', inbound_remark: '', created_at: '2024-01-12 08:00:00',
                outboundRecords: [] }
        ];
        sv(K.CARDS, cards);
    }

    function calcLedger() {
        const cards = ld(K.CARDS) || [];
        const goods = ld(K.GOODS) || [];
        const ledgerMap = {};
        goods.forEach(g => {
            ledgerMap[g.id] = { goods_id: g.id, goods_name: g.name, category: g.category, spec: g.spec, unit: g.unit, total_inbound: 0, total_outbound: 0, current_stock: 0, batch_count: 0 };
        });
        cards.forEach(card => {
            const l = ledgerMap[card.goods_id];
            if (l) {
                l.total_inbound += card.quantity;
                l.batch_count++;
                let out = 0;
                if (card.outboundRecords && Array.isArray(card.outboundRecords)) {
                    card.outboundRecords.forEach(r => { out += r.quantity; });
                }
                l.total_outbound += out;
                l.current_stock += (card.quantity - out);
            }
        });
        const ledger = Object.values(ledgerMap);
        sv(K.LEDGER, ledger);
        return ledger;
    }

    // ==================== API ====================

    const API = {
        // ---------- Auth ----------

        async register(data) {
            const { username, password, name, phone, email, securityQuestion, securityAnswer } = data;
            if (!username || !password || !name) throw new Error('昵称、密码、姓名为必填项');
            if (username.length < 2 || username.length > 20) throw new Error('昵称长度需为2-20个字符');
            if (password.length < 6) throw new Error('密码长度不能少于6个字符');
            if (!securityQuestion || !securityAnswer) throw new Error('请选择密保问题并填写答案');

            const users = ld(K.USERS) || [];
            if (users.find(u => u.username === username)) throw new Error('昵称已存在');

            const id = nextId();
            const passwordHash = await sha256(password);
            const answerHash = await sha256(securityAnswer);
            const ts = now();

            const user = { id, username, password_hash: passwordHash, name, phone: phone || '', email: email || '', security_question: securityQuestion, security_answer_hash: answerHash, created_at: ts, updated_at: ts, last_login_at: null };
            users.push(user);
            sv(K.USERS, users);
            return { id, username, name };
        },

        async login(data) {
            const { credential, password, method } = data;
            if (!credential || !password) throw new Error('请输入登录凭证和密码');

            const users = ld(K.USERS) || [];
            let user;
            if (method === 'email') {
                user = users.find(u => u.email === credential);
            } else {
                user = users.find(u => u.phone === credential);
            }
            if (!user) throw new Error('手机号或邮箱未注册');

            const hash = await sha256(password);
            if (hash !== user.password_hash) throw new Error('密码错误');

            user.last_login_at = now();
            sv(K.USERS, users);

            const token = genToken();
            this.setToken(token, user.id);

            return { token, user: { userId: user.id, username: user.username, name: user.name } };
        },

        async forgotStep1(username) {
            const users = ld(K.USERS) || [];
            const user = users.find(u => u.username === username);
            if (!user) throw new Error('昵称不存在');
            return { question: user.security_question, userId: user.id };
        },

        async forgotReset(data) {
            const { userId, answer, newPassword } = data;
            if (!newPassword || newPassword.length < 6) throw new Error('新密码长度不能少于6个字符');

            const users = ld(K.USERS) || [];
            const user = users.find(u => u.id === userId);
            if (!user) throw new Error('用户不存在');

            const hash = await sha256(answer);
            if (hash !== user.security_answer_hash) throw new Error('密保答案错误');

            user.password_hash = await sha256(newPassword);
            user.updated_at = now();
            sv(K.USERS, users);
            return { success: true };
        },

        // ---------- Profile ----------

        async getProfile() {
            const userId = getUserIdFromToken();
            if (!userId) throw new Error('未登录');
            const users = ld(K.USERS) || [];
            const user = users.find(u => u.id === userId);
            if (!user) throw new Error('用户不存在');
            const { password_hash, security_answer_hash, ...profile } = user;
            return profile;
        },

        async updateProfile(data) {
            const userId = getUserIdFromToken();
            if (!userId) throw new Error('未登录');
            const users = ld(K.USERS) || [];
            const user = users.find(u => u.id === userId);
            if (!user) throw new Error('用户不存在');

            if (data.nickname !== undefined) user.username = data.nickname;
            if (data.name !== undefined) user.name = data.name;
            user.updated_at = now();
            sv(K.USERS, users);
            return { username: user.username, name: user.name };
        },

        async updateProfileSecurity(data) {
            const userId = getUserIdFromToken();
            if (!userId) throw new Error('未登录');
            const users = ld(K.USERS) || [];
            const user = users.find(u => u.id === userId);
            if (!user) throw new Error('用户不存在');

            const hash = await sha256(data.answer);
            if (hash !== user.security_answer_hash) throw new Error('密保答案错误');

            const oldPhone = user.phone;
            const oldEmail = user.email;

            if (data.phone !== undefined) user.phone = data.phone;
            if (data.email !== undefined) user.email = data.email;
            user.updated_at = now();
            sv(K.USERS, users);

            // Add modification logs
            const logs = ld(K.LOGS) || [];
            const ts = now();
            if (data.phone !== undefined && data.phone !== oldPhone) {
                logs.push({ id: nextId(), user_id: userId, field: 'phone', old_value: oldPhone, new_value: data.phone, timestamp: ts });
            }
            if (data.email !== undefined && data.email !== oldEmail) {
                logs.push({ id: nextId(), user_id: userId, field: 'email', old_value: oldEmail, new_value: data.email, timestamp: ts });
            }
            sv(K.LOGS, logs);

            return { username: user.username, name: user.name };
        },

        async changePassword(data) {
            const userId = getUserIdFromToken();
            if (!userId) throw new Error('未登录');
            const users = ld(K.USERS) || [];
            const user = users.find(u => u.id === userId);
            if (!user) throw new Error('用户不存在');

            const oldHash = await sha256(data.oldPassword);
            if (oldHash !== user.password_hash) throw new Error('原密码错误');
            if (!data.newPassword || data.newPassword.length < 6) throw new Error('新密码长度不能少于6个字符');

            user.password_hash = await sha256(data.newPassword);
            user.updated_at = now();
            sv(K.USERS, users);

            const logs = ld(K.LOGS) || [];
            logs.push({ id: nextId(), user_id: userId, field: 'password', old_value: '***', new_value: '***', timestamp: now() });
            sv(K.LOGS, logs);

            return { success: true };
        },

        async getModificationLogs() {
            const userId = getUserIdFromToken();
            if (!userId) throw new Error('未登录');
            const logs = ld(K.LOGS) || [];
            return logs.filter(l => l.user_id === userId).sort((a, b) => b.id - a.id);
        },

        // ---------- Goods ----------

        async getGoods(params = {}) {
            let goods = ld(K.GOODS) || [];
            if (params.keyword) {
                const kw = params.keyword.toLowerCase();
                goods = goods.filter(g => g.name.toLowerCase().includes(kw) || g.category.toLowerCase().includes(kw));
            }
            if (params.category) {
                goods = goods.filter(g => g.category === params.category);
            }
            return goods.sort((a, b) => b.id.localeCompare(a.id));
        },

        async getGoodsById(id) {
            const goods = ld(K.GOODS) || [];
            const g = goods.find(g => g.id === id);
            if (!g) throw new Error('商品不存在');
            return g;
        },

        async createGoods(data) {
            const { name, category, spec, unit, warningThreshold } = data;
            if (!name || !category || !unit) throw new Error('商品名称、类别、单位为必填项');
            const goods = ld(K.GOODS) || [];
            const id = gid();
            const ts = now();
            const g = { id, name, category, spec: spec || '', unit, warning_threshold: warningThreshold || 10, created_by: getUserIdFromToken(), created_at: ts, updated_at: ts };
            goods.push(g);
            sv(K.GOODS, goods);
            return g;
        },

        async updateGoods(id, data) {
            const { name, category, spec, unit, warningThreshold } = data;
            if (!name || !category || !unit) throw new Error('商品名称、类别、单位为必填项');
            const goods = ld(K.GOODS) || [];
            const idx = goods.findIndex(g => g.id === id);
            if (idx === -1) throw new Error('商品不存在');

            goods[idx].name = name;
            goods[idx].category = category;
            goods[idx].spec = spec || '';
            goods[idx].unit = unit;
            goods[idx].warning_threshold = warningThreshold || 10;
            goods[idx].updated_at = now();
            sv(K.GOODS, goods);

            // Update denormalized data in cards
            const cards = ld(K.CARDS) || [];
            let changed = false;
            cards.forEach(c => {
                if (c.goods_id === id) {
                    c.goods_name = name;
                    c.spec = spec || '';
                    c.unit = unit;
                    changed = true;
                }
            });
            if (changed) sv(K.CARDS, cards);

            return goods[idx];
        },

        async deleteGoods(id) {
            const goods = ld(K.GOODS) || [];
            const idx = goods.findIndex(g => g.id === id);
            if (idx === -1) throw new Error('商品不存在');
            goods.splice(idx, 1);
            sv(K.GOODS, goods);

            // Cascade delete cards and outbound records
            let cards = ld(K.CARDS) || [];
            cards = cards.filter(c => c.goods_id !== id);
            sv(K.CARDS, cards);

            return { success: true };
        },

        async getCategories() {
            const goods = ld(K.GOODS) || [];
            const cats = [...new Set(goods.map(g => g.category))];
            return cats.sort();
        },

        // ---------- Cards ----------

        async getCards(params = {}) {
            let cards = ld(K.CARDS) || [];
            if (params.keyword) {
                const kw = params.keyword.toLowerCase();
                cards = cards.filter(c => c.goods_name.toLowerCase().includes(kw) || (c.batch_no || '').toLowerCase().includes(kw));
            }
            if (params.goodsId) {
                cards = cards.filter(c => c.goods_id === params.goodsId);
            }
            return cards.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
        },

        async getCardById(id) {
            const cards = ld(K.CARDS) || [];
            const card = cards.find(c => c.id === id);
            if (!card) throw new Error('卡片不存在');
            return card;
        },

        async createCard(data) {
            const { goodsId, batchNo, quantity, inboundDate, storageLocation, inboundOperator, inboundReason, inboundRemark } = data;
            if (!goodsId || !batchNo || !quantity || !inboundDate || !inboundOperator) throw new Error('商品、批次号、数量、日期、经手人为必填项');

            const goods = ld(K.GOODS) || [];
            const g = goods.find(g => g.id === goodsId);
            if (!g) throw new Error('商品不存在');

            const cards = ld(K.CARDS) || [];
            const card = {
                id: cid(),
                batch_no: batchNo,
                goods_id: goodsId,
                goods_name: g.name,
                spec: g.spec,
                unit: g.unit,
                quantity: parseInt(quantity),
                storage_location: storageLocation || '',
                inbound_date: inboundDate,
                inbound_operator: inboundOperator,
                inbound_reason: inboundReason || '采购入库',
                inbound_remark: inboundRemark || '',
                outboundRecords: [],
                created_by: getUserIdFromToken(),
                created_at: now()
            };
            cards.push(card);
            sv(K.CARDS, cards);
            return card;
        },

        async deleteCard(id) {
            let cards = ld(K.CARDS) || [];
            const idx = cards.findIndex(c => c.id === id);
            if (idx === -1) throw new Error('卡片不存在');
            cards.splice(idx, 1);
            sv(K.CARDS, cards);
            return { success: true };
        },

        async addOutbound(cardId, data) {
            const cards = ld(K.CARDS) || [];
            const card = cards.find(c => c.id === cardId);
            if (!card) throw new Error('卡片不存在');

            const totalOut = card.outboundRecords ? card.outboundRecords.reduce((s, r) => s + r.quantity, 0) : 0;
            const currentStock = card.quantity - totalOut;
            if (parseInt(data.quantity) > currentStock) throw new Error('出库数量超过当前库存');

            if (!card.outboundRecords) card.outboundRecords = [];
            card.outboundRecords.push({
                id: oid(),
                quantity: parseInt(data.quantity),
                date: data.date,
                reason: data.reason,
                operator: data.operator,
                remark: data.remark || ''
            });
            sv(K.CARDS, cards);
            return card;
        },

        // ---------- Ledger ----------

        async getLedger(params = {}) {
            let ledger = calcLedger();
            if (params.keyword) {
                const kw = params.keyword.toLowerCase();
                ledger = ledger.filter(l => l.goods_name.toLowerCase().includes(kw));
            }
            if (params.category) {
                ledger = ledger.filter(l => l.category === params.category);
            }
            return ledger;
        },

        async getLedgerSummary() {
            const ledger = calcLedger();
            const cards = ld(K.CARDS) || [];
            const lowStock = await this.getLowStock();
            return {
                total_goods: ledger.length,
                total_batches: cards.length,
                total_stock: ledger.reduce((s, l) => s + l.current_stock, 0),
                warning_count: lowStock.length
            };
        },

        async getLowStock() {
            const ledger = calcLedger();
            const goods = ld(K.GOODS) || [];
            const goodsMap = {};
            goods.forEach(g => { goodsMap[g.id] = g; });
            return ledger.filter(l => {
                const g = goodsMap[l.goods_id];
                return g && l.current_stock <= g.warning_threshold;
            }).map(l => {
                const g = goodsMap[l.goods_id];
                return { ...l, warning_threshold: g ? g.warning_threshold : 0, difference: g ? g.warning_threshold - l.current_stock : 0 };
            });
        },

        async getStockSummary() {
            return calcLedger();
        },

        // ---------- Backup ----------

        async exportBackup() {
            return {
                goods: ld(K.GOODS) || [],
                cards: ld(K.CARDS) || [],
                users: ld(K.USERS) || [],
                logs: ld(K.LOGS) || [],
                exported_at: now()
            };
        },

        async restoreBackup(data) {
            if (data.goods) sv(K.GOODS, data.goods);
            if (data.cards) sv(K.CARDS, data.cards);
            if (data.users) sv(K.USERS, data.users);
            if (data.logs) sv(K.LOGS, data.logs);
            // Reset id sequence
            let maxId = 0;
            const allIds = [
                ...(data.goods || []).map(g => parseInt(g.id.replace('g', '')) || 0),
                ...(data.cards || []).map(c => parseInt(c.id.replace('c', '')) || 0)
            ];
            allIds.forEach(id => { if (id > maxId) maxId = id; });
            sv(K.ID_SEQ, maxId);
            calcLedger();
            return { success: true };
        },

        async initializeSample() {
            sv(K.GOODS, []);
            sv(K.CARDS, []);
            sv(K.LEDGER, []);
            sv(K.ID_SEQ, 5);
            seedSampleData();
            calcLedger();
            return { success: true };
        },

        // ---------- Token management ----------

        setToken: function(token, userId) {
            const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
            localStorage.setItem(TOKEN_KEY, JSON.stringify({ token, expiresAt, userId }));
        },

        clearToken: function() {
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem('warehouse_current_user');
        },

        getToken: getToken
    };

    window.API = API;

    // Initialize: seed sample data if no goods exist
    if (!ld(K.GOODS) || ld(K.GOODS).length === 0) {
        seedSampleData();
        calcLedger();
    }
})();
