(function() {
    'use strict';

    // ==================== 配置（替换为你的 Supabase 信息） ====================
    const SUPABASE_URL = 'https://eutkthmdhyvobpnymbjx.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_kAoNdDLgj9AybwRPrOlEzg_E-mcrX6t';

    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // ==================== 工具函数 ====================

    function gid() {
        return 'g' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
    }
    function cid() {
        return 'c' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
    }
    function oid() {
        return 'o' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
    }
    function now() { return new Date().toISOString(); }

    // ==================== API ====================

    const API = {
        // ---------- Auth ----------

        async register(data) {
            const { username, password, name, phone, email } = data;
            if (!email || !password || !name) throw new Error('邮箱、密码、姓名为必填项');
            if (!username || username.length < 2 || username.length > 20) throw new Error('昵称长度需为2-20个字符');
            if (password.length < 6) throw new Error('密码长度不能少于6个字符');

            // Step 1: 注册 Supabase Auth 用户
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: { name, username, phone: phone || '' }
                }
            });
            if (authError) {
                if (authError.message.includes('already registered') || authError.message.includes('already exists')) {
                    throw new Error('该邮箱已被注册');
                }
                throw new Error('注册失败: ' + authError.message);
            }
            if (!authData.user) throw new Error('注册失败，请稍后重试');

            // Step 2: 创建用户资料
            const { error: profileError } = await supabase.from('profiles').insert({
                user_id: authData.user.id,
                username,
                name,
                phone: phone || ''
            });
            if (profileError) {
                // 回滚：删除 auth 用户
                await supabase.auth.admin?.deleteUser(authData.user.id);
                if (profileError.message.includes('duplicate key') || profileError.message.includes('unique')) {
                    throw new Error('昵称已存在');
                }
                throw new Error('创建资料失败: ' + profileError.message);
            }

            return {
                id: authData.user.id,
                username,
                name
            };
        },

        async login(data) {
            const { email, password } = data;
            if (!email || !password) throw new Error('请输入邮箱和密码');

            const { data: authData, error } = await supabase.auth.signInWithPassword({
                email,
                password
            });
            if (error) {
                if (error.message.includes('Invalid login')) {
                    throw new Error('邮箱或密码错误');
                }
                if (error.message.includes('Email not confirmed')) {
                    throw new Error('邮箱未验证，请先验证邮箱');
                }
                throw new Error('登录失败: ' + error.message);
            }
            if (!authData.user) throw new Error('登录失败');

            // 获取用户资料
            const { data: profile } = await supabase.from('profiles')
                .select('*').eq('user_id', authData.user.id).single();

            return {
                token: authData.session.access_token,
                user: {
                    userId: authData.user.id,
                    username: profile ? profile.username : authData.user.user_metadata.username,
                    name: profile ? profile.name : authData.user.user_metadata.name,
                    email: authData.user.email
                }
            };
        },

        async forgotStep1(email) {
            if (!email) throw new Error('请输入注册邮箱');
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: window.location.origin + '/?reset=true'
            });
            if (error) {
                if (error.message.includes('User not found')) throw new Error('该邮箱未注册');
                throw new Error('发送失败: ' + error.message);
            }
            return { success: true, message: '密码重置邮件已发送，请检查邮箱' };
        },

        async forgotReset(data) {
            // 通过 Supabase 重置密码邮件中的链接处理
            // 用户点击邮件链接后会用新的 access token 登录，然后在此更新密码
            const { newPassword } = data;
            if (!newPassword || newPassword.length < 6) throw new Error('新密码长度不能少于6个字符');
            const { error } = await supabase.auth.updateUser({ password: newPassword });
            if (error) throw new Error('重置密码失败: ' + error.message);
            return { success: true };
        },

        async logout() {
            await supabase.auth.signOut();
        },

        async getSession() {
            const { data } = await supabase.auth.getSession();
            return data.session;
        },

        // ---------- Profile ----------

        async getProfile() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('未登录');

            const { data: profile, error } = await supabase.from('profiles')
                .select('*').eq('user_id', user.id).single();

            const meta = user.user_metadata;
            return {
                id: user.id,
                username: profile ? profile.username : (meta ? meta.username : ''),
                name: profile ? profile.name : (meta ? meta.name : ''),
                email: user.email,
                phone: profile ? profile.phone : (meta ? meta.phone : ''),
                created_at: user.created_at,
                updated_at: profile ? profile.updated_at : user.updated_at,
                last_login_at: user.last_sign_in_at
            };
        },

        async updateProfile(data) {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('未登录');

            const updates = {};
            if (data.name !== undefined) updates.name = data.name;
            if (data.phone !== undefined) updates.phone = data.phone;

            if (Object.keys(updates).length > 0) {
                const { error } = await supabase.from('profiles').update(updates).eq('user_id', user.id);
                if (error) throw new Error('更新失败: ' + error.message);
            }

            // 同时更新 auth metadata
            if (data.nickname !== undefined || data.name !== undefined) {
                await supabase.auth.updateUser({
                    data: { username: data.nickname || user.user_metadata.username, name: data.name || user.user_metadata.name }
                });
            }

            const { data: profile } = await supabase.from('profiles').select('*').eq('user_id', user.id).single();
            return {
                username: profile ? profile.username : user.user_metadata.username,
                name: profile ? profile.name : user.user_metadata.name
            };
        },

        async updateProfileSecurity(data) {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('未登录');

            // 验证当前密码
            if (!data.password) throw new Error('请输入密码以验证身份');
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email: user.email,
                password: data.password
            });
            if (signInError) throw new Error('密码错误');

            const updates = {};
            const logs = [];
            const oldProfile = await supabase.from('profiles').select('phone').eq('user_id', user.id).single();

            if (data.phone !== undefined) {
                updates.phone = data.phone;
                const oldPhone = oldProfile.data ? oldProfile.data.phone : '';
                if (data.phone !== oldPhone) {
                    logs.push({ user_id: user.id, field: 'phone', old_value: oldPhone || '(空)', new_value: data.phone || '(空)' });
                }
            }

            if (Object.keys(updates).length > 0) {
                await supabase.from('profiles').update(updates).eq('user_id', user.id);
            }

            if (logs.length > 0) {
                await supabase.from('modification_logs').insert(logs);
            }

            const { data: profile } = await supabase.from('profiles').select('*').eq('user_id', user.id).single();
            return {
                username: profile ? profile.username : user.user_metadata.username,
                name: profile ? profile.name : user.user_metadata.name
            };
        },

        async changePassword(data) {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('未登录');

            // Supabase 要求先验证身份
            const { error: verifyError } = await supabase.auth.signInWithPassword({
                email: user.email,
                password: data.oldPassword
            });
            if (verifyError) throw new Error('原密码错误');

            const { error } = await supabase.auth.updateUser({ password: data.newPassword });
            if (error) throw new Error('修改密码失败: ' + error.message);

            await supabase.from('modification_logs').insert({
                user_id: user.id, field: 'password', old_value: '***', new_value: '***'
            });

            return { success: true };
        },

        async getModificationLogs() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('未登录');

            const { data, error } = await supabase.from('modification_logs')
                .select('*').eq('user_id', user.id).order('id', { ascending: false });
            if (error) throw new Error('获取日志失败: ' + error.message);
            return data || [];
        },

        // ---------- Goods ----------

        async getGoods(params = {}) {
            let query = supabase.from('goods').select('*');
            if (params.keyword) {
                query = query.or(`name.ilike.%${params.keyword}%,category.ilike.%${params.keyword}%`);
            }
            if (params.category) {
                query = query.eq('category', params.category);
            }
            query = query.order('created_at', { ascending: false });
            const { data, error } = await query;
            if (error) throw new Error('获取商品失败: ' + error.message);
            return data || [];
        },

        async getGoodsById(id) {
            const { data, error } = await supabase.from('goods').select('*').eq('id', id).single();
            if (error || !data) throw new Error('商品不存在');
            return data;
        },

        async createGoods(data) {
            const { name, category, spec, unit, warningThreshold } = data;
            if (!name || !category || !unit) throw new Error('商品名称、类别、单位为必填项');

            const { data: { user } } = await supabase.auth.getUser();
            const g = {
                id: gid(), name, category,
                spec: spec || '', unit,
                warning_threshold: warningThreshold || 10,
                created_by: user ? user.id : null
            };

            const { data: created, error } = await supabase.from('goods').insert(g).select().single();
            if (error) throw new Error('添加商品失败: ' + error.message);
            return created;
        },

        async updateGoods(id, data) {
            const { name, category, spec, unit, warningThreshold } = data;
            if (!name || !category || !unit) throw new Error('商品名称、类别、单位为必填项');

            const updates = {
                name, category, spec: spec || '', unit,
                warning_threshold: warningThreshold || 10,
                updated_at: now()
            };

            const { data: updated, error } = await supabase.from('goods').update(updates).eq('id', id).select().single();
            if (error) throw new Error('更新商品失败: ' + error.message);

            // 同步更新卡片中的冗余字段
            await supabase.from('cards').update({ goods_name: name, spec: spec || '', unit }).eq('goods_id', id);

            return updated;
        },

        async deleteGoods(id) {
            const { error } = await supabase.from('goods').delete().eq('id', id);
            if (error) throw new Error('删除商品失败: ' + error.message);
            return { success: true };
        },

        async getCategories() {
            const { data, error } = await supabase.from('goods').select('category');
            if (error) throw new Error('获取分类失败: ' + error.message);
            const cats = [...new Set((data || []).map(g => g.category))];
            return cats.sort();
        },

        // ---------- Cards ----------

        async getCards(params = {}) {
            let query = supabase.from('cards').select('*');
            if (params.keyword) {
                query = query.or(`goods_name.ilike.%${params.keyword}%,batch_no.ilike.%${params.keyword}%`);
            }
            if (params.goodsId) {
                query = query.eq('goods_id', params.goodsId);
            }
            query = query.order('created_at', { ascending: false });
            const { data, error } = await query;
            if (error) throw new Error('获取卡片失败: ' + error.message);
            return data || [];
        },

        async getCardById(id) {
            const { data, error } = await supabase.from('cards').select('*').eq('id', id).single();
            if (error || !data) throw new Error('卡片不存在');
            return data;
        },

        async createCard(data) {
            const { goodsId, batchNo, quantity, inboundDate, storageLocation, inboundOperator, inboundReason, inboundRemark } = data;
            if (!goodsId || !batchNo || !quantity || !inboundDate || !inboundOperator) {
                throw new Error('商品、批次号、数量、日期、经手人为必填项');
            }

            // 查找商品信息
            const { data: goods } = await supabase.from('goods').select('*').eq('id', goodsId).single();
            if (!goods) throw new Error('商品不存在');

            const { data: { user } } = await supabase.auth.getUser();
            const card = {
                id: cid(),
                batch_no: batchNo,
                goods_id: goodsId,
                goods_name: goods.name,
                spec: goods.spec,
                unit: goods.unit,
                quantity: parseInt(quantity),
                storage_location: storageLocation || '',
                inbound_date: inboundDate,
                inbound_operator: inboundOperator,
                inbound_reason: inboundReason || '采购入库',
                inbound_remark: inboundRemark || '',
                outbound_records: [],
                created_by: user ? user.id : null
            };

            const { data: created, error } = await supabase.from('cards').insert(card).select().single();
            if (error) throw new Error('创建卡片失败: ' + error.message);
            return created;
        },

        async deleteCard(id) {
            const { error } = await supabase.from('cards').delete().eq('id', id);
            if (error) throw new Error('删除卡片失败: ' + error.message);
            return { success: true };
        },

        async addOutbound(cardId, data) {
            // 先获取当前卡片
            const { data: card, error: fetchError } = await supabase.from('cards').select('*').eq('id', cardId).single();
            if (fetchError || !card) throw new Error('卡片不存在');

            const records = card.outbound_records || [];
            const totalOut = records.reduce((s, r) => s + r.quantity, 0);
            const currentStock = card.quantity - totalOut;
            if (parseInt(data.quantity) > currentStock) throw new Error('出库数量超过当前库存');

            records.push({
                id: oid(),
                quantity: parseInt(data.quantity),
                date: data.date,
                reason: data.reason,
                operator: data.operator,
                remark: data.remark || ''
            });

            const { error } = await supabase.from('cards').update({ outbound_records: records }).eq('id', cardId);
            if (error) throw new Error('出库失败: ' + error.message);

            const { data: updated } = await supabase.from('cards').select('*').eq('id', cardId).single();
            return updated;
        },

        // ---------- Ledger ----------

        async getLedger(params = {}) {
            const { data: goods, error: gError } = await supabase.from('goods').select('*');
            if (gError) throw new Error('获取数据失败');

            const { data: cards, error: cError } = await supabase.from('cards').select('*');
            if (cError) throw new Error('获取数据失败');

            const ledgerMap = {};
            (goods || []).forEach(g => {
                ledgerMap[g.id] = {
                    goods_id: g.id, goods_name: g.name, category: g.category,
                    spec: g.spec, unit: g.unit, total_inbound: 0,
                    total_outbound: 0, current_stock: 0, batch_count: 0
                };
            });

            (cards || []).forEach(card => {
                const l = ledgerMap[card.goods_id];
                if (l) {
                    l.total_inbound += card.quantity;
                    l.batch_count++;
                    const records = card.outbound_records || [];
                    let out = 0;
                    records.forEach(r => { out += r.quantity; });
                    l.total_outbound += out;
                    l.current_stock += (card.quantity - out);
                }
            });

            let ledger = Object.values(ledgerMap);
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
            const ledger = await this.getLedger();
            const { data: cards } = await supabase.from('cards').select('id');
            const lowStock = await this.getLowStock();
            return {
                total_goods: ledger.length,
                total_batches: (cards || []).length,
                total_stock: ledger.reduce((s, l) => s + l.current_stock, 0),
                warning_count: lowStock.length
            };
        },

        async getLowStock() {
            const { data: goods } = await supabase.from('goods').select('*');
            const { data: cards } = await supabase.from('cards').select('*');

            const goodsMap = {};
            (goods || []).forEach(g => { goodsMap[g.id] = g; });

            const stockMap = {};
            (cards || []).forEach(card => {
                if (!stockMap[card.goods_id]) {
                    stockMap[card.goods_id] = 0;
                }
                const records = card.outbound_records || [];
                let out = 0;
                records.forEach(r => { out += r.quantity; });
                stockMap[card.goods_id] += (card.quantity - out);
            });

            return (goods || []).filter(g => {
                const stock = stockMap[g.id] || 0;
                return stock <= g.warning_threshold;
            }).map(g => {
                const stock = stockMap[g.id] || 0;
                return {
                    goods_id: g.id, goods_name: g.name, category: g.category,
                    spec: g.spec, unit: g.unit, current_stock: stock,
                    warning_threshold: g.warning_threshold,
                    difference: g.warning_threshold - stock
                };
            });
        },

        async getStockSummary() {
            return await this.getLedger();
        },

        // ---------- Backup ----------

        async exportBackup() {
            const [goods, cards] = await Promise.all([
                supabase.from('goods').select('*'),
                supabase.from('cards').select('*')
            ]);

            return {
                goods: goods.data || [],
                cards: cards.data || [],
                exported_at: new Date().toISOString()
            };
        },

        async restoreBackup(data) {
            if (!data.goods || !data.cards) throw new Error('无效的备份文件');

            // 清空现有数据
            await supabase.from('cards').delete().neq('id', '');
            await supabase.from('goods').delete().neq('id', '');

            // 恢复数据
            if (data.goods.length > 0) {
                await supabase.from('goods').insert(data.goods);
            }
            if (data.cards.length > 0) {
                await supabase.from('cards').insert(data.cards);
            }

            return { success: true };
        },

        async initializeSample() {
            await supabase.from('cards').delete().neq('id', '');
            await supabase.from('goods').delete().neq('id', '');

            const goods = [
                { id: 'g001', name: '苹果', category: '食品', spec: '红富士', unit: '斤', warning_threshold: 50 },
                { id: 'g002', name: '大米', category: '食品', spec: '五常大米', unit: '袋', warning_threshold: 20 },
                { id: 'g003', name: '笔记本电脑', category: '电子产品', spec: 'MacBook Pro 14寸', unit: '台', warning_threshold: 5 },
                { id: 'g004', name: '打印机', category: '办公用品', spec: 'HP LaserJet', unit: '台', warning_threshold: 3 },
                { id: 'g005', name: '食用油', category: '食品', spec: '金龙鱼 5L', unit: '桶', warning_threshold: 30 }
            ];

            const cards = [
                { id: 'c001', batch_no: '20240115001', goods_id: 'g001', goods_name: '苹果', spec: '红富士', unit: '斤', quantity: 500, storage_location: 'A区-1层-01架', inbound_date: '2024-01-15', inbound_operator: '张三', inbound_reason: '采购入库', inbound_remark: '春节备货', outbound_records: [{ id: 'o001', quantity: 100, date: '2024-01-18', reason: '销售', operator: '李四', remark: '批发' }, { id: 'o002', quantity: 50, date: '2024-01-20', reason: '销售', operator: '李四', remark: '零售' }] },
                { id: 'c002', batch_no: '20240116001', goods_id: 'g001', goods_name: '苹果', spec: '红富士', unit: '斤', quantity: 300, storage_location: 'A区-1层-02架', inbound_date: '2024-01-16', inbound_operator: '张三', inbound_reason: '采购入库', inbound_remark: '', outbound_records: [{ id: 'o003', quantity: 80, date: '2024-01-19', reason: '销售', operator: '李四', remark: '' }] },
                { id: 'c003', batch_no: '20240114001', goods_id: 'g002', goods_name: '大米', spec: '五常大米', unit: '袋', quantity: 100, storage_location: 'B区-2层-03架', inbound_date: '2024-01-14', inbound_operator: '王五', inbound_reason: '采购入库', inbound_remark: '批量采购', outbound_records: [{ id: 'o004', quantity: 30, date: '2024-01-17', reason: '销售', operator: '李四', remark: '食堂采购' }] },
                { id: 'c004', batch_no: '20240113001', goods_id: 'g003', goods_name: '笔记本电脑', spec: 'MacBook Pro 14寸', unit: '台', quantity: 10, storage_location: 'C区-1层-01架', inbound_date: '2024-01-13', inbound_operator: '赵六', inbound_reason: '采购入库', inbound_remark: '公司采购', outbound_records: [{ id: 'o005', quantity: 2, date: '2024-01-15', reason: '领用', operator: '赵六', remark: '部门领用' }] },
                { id: 'c005', batch_no: '20240112001', goods_id: 'g005', goods_name: '食用油', spec: '金龙鱼 5L', unit: '桶', quantity: 50, storage_location: 'B区-1层-05架', inbound_date: '2024-01-12', inbound_operator: '张三', inbound_reason: '采购入库', inbound_remark: '', outbound_records: [] }
            ];

            await supabase.from('goods').insert(goods);
            await supabase.from('cards').insert(cards);
            return { success: true };
        },

        // ---------- Token / Session ----------

        setToken: function(token) {
            // Supabase 自动管理 session，此方法保留兼容性
        },

        clearToken: function() {
            // Supabase 自动管理
        },

        getToken: function() {
            // Supabase 自动管理
            return null;
        }
    };

    window.API = API;
})();
