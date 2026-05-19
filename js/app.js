(function() {
    'use strict';

    // ==================== ID 生成 ====================
    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    function generateBatchNo() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const random = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
        return `${year}${month}${day}${random}`;
    }

    // ==================== 商品管理模块 ====================
    async function getAllGoods() {
        return await API.getGoods();
    }

    async function getGoodsById(id) {
        return await API.getGoodsById(id);
    }

    async function addGoods(data) {
        return await API.createGoods(data);
    }

    async function updateGoods(id, data) {
        return await API.updateGoods(id, data);
    }

    async function deleteGoods(id) {
        return await API.deleteGoods(id);
    }

    async function getCategories() {
        return await API.getCategories();
    }

    async function searchGoods(keyword, category = '') {
        return await API.getGoods({ keyword, category });
    }

    // ==================== 保管卡片模块 ====================
    async function getAllCards() {
        return await API.getCards();
    }

    async function getCardById(id) {
        return await API.getCardById(id);
    }

    async function getCardsByGoodsId(goodsId) {
        return await API.getCards({ goodsId });
    }

    function getTotalOutbound(card) {
        if (!card.outboundRecords || !Array.isArray(card.outboundRecords)) {
            return 0;
        }
        return card.outboundRecords.reduce((sum, record) => sum + record.quantity, 0);
    }

    function getCurrentStock(card) {
        const totalOutbound = getTotalOutbound(card);
        return card.quantity - totalOutbound;
    }

    async function addCard(data) {
        return await API.createCard(data);
    }

    async function addOutboundRecord(cardId, data) {
        return await API.addOutbound(cardId, data);
    }

    async function deleteCard(id) {
        return await API.deleteCard(id);
    }

    async function searchCards(keyword = '', goodsId = '') {
        return await API.getCards({ keyword, goodsId });
    }

    async function getCardStatus(card) {
        const currentStock = getCurrentStock(card);
        if (currentStock === 0) return 'out-of-stock';
        const goods = await getGoodsById(card.goods_id || card.goodsId);
        if (goods && currentStock <= goods.warning_threshold) return 'low-stock';
        return 'in-stock';
    }

    // ==================== 保管账模块 ====================
    async function getLedger(params = {}) {
        return await API.getLedger(params);
    }

    async function getLedgerSummary() {
        return await API.getLedgerSummary();
    }

    async function getLowStockItems() {
        return await API.getLowStock();
    }

    // ==================== 应用主控制器 ====================
    class WarehouseApp {
        constructor() {
            this.currentCardId = null;
        }

        async init() {
            this.setupNavigation();
            this.setupGoodsEvents();
            this.setupCardsEvents();
            this.setupInboundEvents();
            this.setupOutboundEvents();
            this.setupReportsEvents();
            this.setupBackupEvents();
            await this.initializeDataIfEmpty();
            await this.updateUI();
        }

        async initializeDataIfEmpty() {
            try {
                const goods = await API.getGoods();
                if (goods.length === 0) {
                    await API.initializeSample();
                }
            } catch (e) {
                console.error('初始化数据失败:', e);
            }
        }

        setupNavigation() {
            const navBtns = document.querySelectorAll('.nav-btn');
            navBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    const sectionId = btn.dataset.section;
                    this.showSection(sectionId);
                });
            });
        }

        async showSection(sectionId) {
            document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.section').forEach(section => section.classList.remove('active'));

            const btn = document.querySelector(`[data-section="${sectionId}"]`);
            const section = document.getElementById(sectionId);
            if (btn) btn.classList.add('active');
            if (section) section.classList.add('active');

            try {
                if (sectionId === 'cards') {
                    await this.refreshCardsFilter();
                } else if (sectionId === 'reports') {
                    await this.renderStockSummary();
                }
            } catch (e) {
                console.error('切换模块失败:', e);
            }
        }

        setupGoodsEvents() {
            document.getElementById('goods-search').addEventListener('input', () => this.renderGoodsTable());
            document.getElementById('goods-category-filter').addEventListener('change', () => this.renderGoodsTable());

            document.getElementById('goods-form').addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveGoods();
            });
        }

        setupCardsEvents() {
            document.getElementById('cards-search').addEventListener('input', () => this.renderCardsTable());
            document.getElementById('cards-goods-filter').addEventListener('change', () => this.renderCardsTable());
        }

        setupInboundEvents() {
            document.getElementById('inbound-form').addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleInbound();
            });

            document.getElementById('inbound-goods').addEventListener('change', async (e) => {
                const goodsId = e.target.value;
                if (goodsId) {
                    try {
                        const goods = await getGoodsById(goodsId);
                        if (goods) {
                            document.getElementById('inbound-spec').value = goods.spec || '';
                            document.getElementById('inbound-unit').value = goods.unit || '';
                        }
                    } catch (err) { /* ignore */ }
                } else {
                    document.getElementById('inbound-spec').value = '';
                    document.getElementById('inbound-unit').value = '';
                }
            });

            document.getElementById('inbound-date').valueAsDate = new Date();
            document.getElementById('inbound-batch').value = generateBatchNo();
        }

        setupOutboundEvents() {
            document.getElementById('outbound-form').addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleOutbound();
            });

            document.getElementById('outbound-goods').addEventListener('change', async (e) => {
                const goodsId = e.target.value;
                await this.updateOutboundBatchOptions(goodsId);
                document.getElementById('outbound-batch').value = '';
                document.getElementById('outbound-current-stock').value = '';
            });

            document.getElementById('outbound-batch').addEventListener('change', (e) => {
                const batchValue = e.target.value;
                if (batchValue) {
                    const [cardId, currentStock] = batchValue.split('|');
                    document.getElementById('outbound-current-stock').value = currentStock;
                    this.currentCardId = cardId;
                }
            });

            document.getElementById('outbound-date').valueAsDate = new Date();
        }

        setupReportsEvents() {
            const tabBtns = document.querySelectorAll('.tab-btn');
            tabBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    const tabId = btn.dataset.tab;
                    this.showReportTab(tabId);
                });
            });
        }

        setupBackupEvents() {
            document.getElementById('restore-file').addEventListener('change', (e) => {
                this.handleRestore(e.target.files[0]);
            });
        }

        async updateUI() {
            try {
                await this.updateGoodsFilter();
                await this.renderGoodsTable();
                await this.renderCardsTable();
                await this.renderLedger();
                await this.updateInboundGoodsOptions();
                await this.updateOutboundGoodsOptions();
            } catch (e) {
                console.error('更新界面失败:', e);
            }
        }

        async updateGoodsFilter() {
            try {
                const categories = await getCategories();
                const select = document.getElementById('goods-category-filter');
                select.innerHTML = '<option value="">全部分类</option>';
                categories.forEach(cat => {
                    const option = document.createElement('option');
                    option.value = cat;
                    option.textContent = cat;
                    select.appendChild(option);
                });
            } catch (e) { /* ignore */ }
        }

        async refreshCardsFilter() {
            try {
                const goods = await getAllGoods();
                const select = document.getElementById('cards-goods-filter');
                select.innerHTML = '<option value="">全部商品</option>';
                goods.forEach(g => {
                    const option = document.createElement('option');
                    option.value = g.id;
                    option.textContent = g.name;
                    select.appendChild(option);
                });
            } catch (e) { /* ignore */ }
        }

        async updateInboundGoodsOptions() {
            try {
                const goods = await getAllGoods();
                const select = document.getElementById('inbound-goods');
                select.innerHTML = '<option value="">请选择商品</option>';
                goods.forEach(g => {
                    const option = document.createElement('option');
                    option.value = g.id;
                    option.textContent = `${g.name} (${g.spec || '-'})`;
                    select.appendChild(option);
                });
            } catch (e) { /* ignore */ }
        }

        async updateOutboundGoodsOptions() {
            try {
                const goods = await getAllGoods();
                const select = document.getElementById('outbound-goods');
                select.innerHTML = '<option value="">请选择商品</option>';
                goods.forEach(g => {
                    const option = document.createElement('option');
                    option.value = g.id;
                    option.textContent = `${g.name} (${g.spec || '-'})`;
                    select.appendChild(option);
                });
            } catch (e) { /* ignore */ }
        }

        async updateOutboundBatchOptions(goodsId) {
            try {
                const cards = await getCardsByGoodsId(goodsId);
                const select = document.getElementById('outbound-batch');
                select.innerHTML = '<option value="">请选择批次</option>';

                cards.forEach(card => {
                    const currentStock = getCurrentStock(card);
                    if (currentStock > 0) {
                        const option = document.createElement('option');
                        option.value = `${card.id}|${currentStock}`;
                        option.textContent = `${card.batch_no || card.batchNo} - 剩余${currentStock}${card.unit || ''}`;
                        select.appendChild(option);
                    }
                });
            } catch (e) { /* ignore */ }
        }

        async renderGoodsTable() {
            try {
                const keyword = document.getElementById('goods-search').value;
                const category = document.getElementById('goods-category-filter').value;
                const goods = await searchGoods(keyword, category);
                const tbody = document.getElementById('goods-table-body');

                if (goods.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">暂无商品数据</td></tr>';
                    return;
                }

                tbody.innerHTML = goods.map(g => `
                    <tr>
                        <td>${g.id}</td>
                        <td>${g.name}</td>
                        <td>${g.category}</td>
                        <td>${g.spec || '-'}</td>
                        <td>${g.unit}</td>
                        <td>${g.warning_threshold != null ? g.warning_threshold : g.warningThreshold}</td>
                        <td>
                            <button class="btn btn-sm btn-primary" onclick="window.App.showGoodsModal('${g.id}')">编辑</button>
                            <button class="btn btn-sm btn-danger" onclick="window.App.deleteGoodsConfirm('${g.id}')">删除</button>
                        </td>
                    </tr>
                `).join('');
            } catch (e) {
                console.error('渲染商品表失败:', e);
            }
        }

        async renderCardsTable() {
            try {
                const keyword = document.getElementById('cards-search').value;
                const goodsId = document.getElementById('cards-goods-filter').value;
                const cards = await searchCards(keyword, goodsId);
                const tbody = document.getElementById('cards-table-body');

                if (cards.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="11" style="text-align: center;">暂无保管卡片数据</td></tr>';
                    return;
                }

                const rows = await Promise.all(cards.map(async card => {
                    const currentStock = getCurrentStock(card);
                    const totalOutbound = getTotalOutbound(card);
                    const status = await getCardStatus(card);
                    const statusText = status === 'in-stock' ? '有库存' : status === 'low-stock' ? '库存不足' : '已出清';
                    const goodsName = card.goods_name || card.goodsName;
                    const batchNo = card.batch_no || card.batchNo;
                    const spec = card.spec || '-';
                    const unit = card.unit || '';
                    const location = card.storage_location || card.storageLocation || '-';
                    const inboundDate = card.inbound_date || card.inboundDate;

                    return `
                        <tr>
                            <td>${batchNo}</td>
                            <td>${goodsName}</td>
                            <td>${spec}</td>
                            <td>${unit}</td>
                            <td>${card.quantity}</td>
                            <td>${totalOutbound}</td>
                            <td>${currentStock}</td>
                            <td>${inboundDate}</td>
                            <td>${location}</td>
                            <td><span class="status ${status}">${statusText}</span></td>
                            <td>
                                <button class="btn btn-sm btn-primary" onclick="window.App.viewCardDetail('${card.id}')">详情</button>
                            </td>
                        </tr>
                    `;
                }));

                tbody.innerHTML = rows.join('');
            } catch (e) {
                console.error('渲染卡片表失败:', e);
            }
        }

        async renderLedger() {
            try {
                const keyword = document.getElementById('ledger-search').value;
                const category = document.getElementById('ledger-category-filter').value;
                const ledger = await getLedger({ keyword, category });
                const summary = await getLedgerSummary();

                document.getElementById('total-goods').textContent = summary.totalGoods;
                document.getElementById('total-batches').textContent = summary.totalBatches;
                document.getElementById('total-stock').textContent = summary.totalStock;
                document.getElementById('warning-count').textContent = summary.warningCount;

                const categories = await getCategories();
                const select = document.getElementById('ledger-category-filter');
                select.innerHTML = '<option value="">全部分类</option>';
                categories.forEach(cat => {
                    const option = document.createElement('option');
                    option.value = cat;
                    option.textContent = cat;
                    select.appendChild(option);
                });

                const tbody = document.getElementById('ledger-table-body');

                if (ledger.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="10" style="text-align: center;">暂无保管账数据</td></tr>';
                    return;
                }

                tbody.innerHTML = ledger.map(item => {
                    const threshold = item.warningThreshold != null ? item.warningThreshold : 10;
                    const isWarning = item.currentStock <= threshold;
                    const warningStatus = isWarning ? '<span class="status low-stock">预警</span>' : '正常';
                    const goodsId = item.goodsId;

                    return `
                        <tr ${isWarning ? 'class="warning"' : ''}>
                            <td>${goodsId}</td>
                            <td>${item.goodsName}</td>
                            <td>${item.category}</td>
                            <td>${item.spec || '-'}</td>
                            <td>${item.unit || '-'}</td>
                            <td>${item.totalInbound}</td>
                            <td>${item.totalOutbound}</td>
                            <td>${item.currentStock}</td>
                            <td>${item.batchCount}</td>
                            <td>${warningStatus}</td>
                        </tr>
                    `;
                }).join('');
            } catch (e) {
                console.error('渲染保管账失败:', e);
            }
        }

        async showGoodsModal(id = null) {
            const modal = document.getElementById('goods-modal');
            const title = document.getElementById('goods-modal-title');

            if (id) {
                try {
                    const goods = await getGoodsById(id);
                    if (goods) {
                        title.textContent = '编辑商品';
                        document.getElementById('goods-id').value = goods.id;
                        document.getElementById('goods-name').value = goods.name;
                        document.getElementById('goods-category').value = goods.category;
                        document.getElementById('goods-spec').value = goods.spec || '';
                        document.getElementById('goods-unit').value = goods.unit;
                        document.getElementById('goods-warning').value = goods.warning_threshold != null ? goods.warning_threshold : goods.warningThreshold;
                    }
                } catch (e) {
                    this.showToast('获取商品信息失败', 'error');
                    return;
                }
            } else {
                title.textContent = '新增商品';
                document.getElementById('goods-form').reset();
                document.getElementById('goods-id').value = '';
                document.getElementById('goods-warning').value = 10;
            }

            modal.classList.add('active');
        }

        closeGoodsModal() {
            document.getElementById('goods-modal').classList.remove('active');
            document.getElementById('goods-form').reset();
        }

        async saveGoods() {
            const id = document.getElementById('goods-id').value;
            const data = {
                name: document.getElementById('goods-name').value,
                category: document.getElementById('goods-category').value,
                spec: document.getElementById('goods-spec').value,
                unit: document.getElementById('goods-unit').value,
                warningThreshold: parseInt(document.getElementById('goods-warning').value) || 10
            };

            try {
                if (id) {
                    await updateGoods(id, data);
                } else {
                    await addGoods(data);
                }
                this.showToast(id ? '商品更新成功' : '商品添加成功', 'success');
                this.closeGoodsModal();
                await this.updateUI();
            } catch (e) {
                this.showToast(e.message || '操作失败', 'error');
            }
        }

        async deleteGoodsConfirm(id) {
            if (confirm('确定要删除该商品吗？删除后相关的保管卡片也将被删除！')) {
                try {
                    await deleteGoods(id);
                    this.showToast('商品删除成功', 'success');
                    await this.updateUI();
                } catch (e) {
                    this.showToast(e.message || '删除失败', 'error');
                }
            }
        }

        async viewCardDetail(cardId) {
            try {
                const card = await getCardById(cardId);
                if (!card) return;

                const currentStock = getCurrentStock(card);
                const totalOutbound = getTotalOutbound(card);
                const batchNo = card.batch_no || card.batchNo;
                const goodsName = card.goods_name || card.goodsName;
                const spec = card.spec || '-';
                const unit = card.unit || '';
                const location = card.storage_location || card.storageLocation || '-';
                const inboundDate = card.inbound_date || card.inboundDate;
                const inboundOperator = card.inbound_operator || card.inboundOperator;

                const content = `
                    <div class="card-header">
                        <div class="card-title">保管卡片</div>
                        <div class="card-subtitle">批次号：${batchNo}</div>
                    </div>
                    <div class="card-info-grid">
                        <div class="info-row">
                            <div class="info-item">
                                <span class="label">商品名称</span>
                                <span class="value">${goodsName}</span>
                            </div>
                            <div class="info-item">
                                <span class="label">规格</span>
                                <span class="value">${spec}</span>
                            </div>
                            <div class="info-item">
                                <span class="label">单位</span>
                                <span class="value">${unit}</span>
                            </div>
                        </div>
                        <div class="info-row">
                            <div class="info-item">
                                <span class="label">入库数量</span>
                                <span class="value">${card.quantity}</span>
                            </div>
                            <div class="info-item">
                                <span class="label">累计出库</span>
                                <span class="value">${totalOutbound}</span>
                            </div>
                            <div class="info-item">
                                <span class="label">当前库存</span>
                                <span class="value highlight">${currentStock}</span>
                            </div>
                        </div>
                        <div class="info-row">
                            <div class="info-item">
                                <span class="label">入库日期</span>
                                <span class="value">${inboundDate}</span>
                            </div>
                            <div class="info-item">
                                <span class="label">库存地点</span>
                                <span class="value">${location}</span>
                            </div>
                            <div class="info-item">
                                <span class="label">入库经手人</span>
                                <span class="value">${inboundOperator}</span>
                            </div>
                        </div>
                    </div>
                    <div class="outbound-section">
                        <div class="section-header">
                            <h4>出库记录</h4>
                            <span>共 ${card.outboundRecords ? card.outboundRecords.length : 0} 条</span>
                        </div>
                        <div class="outbound-table-container">
                            ${card.outboundRecords && card.outboundRecords.length > 0 ? `
                                <table class="outbound-table">
                                    <thead>
                                        <tr>
                                            <th>日期</th>
                                            <th>数量</th>
                                            <th>原因</th>
                                            <th>经手人</th>
                                            <th>备注</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${card.outboundRecords.map(record => `
                                            <tr>
                                                <td>${record.date}</td>
                                                <td>${record.quantity}</td>
                                                <td>${record.reason}</td>
                                                <td>${record.operator}</td>
                                                <td>${record.remark || '-'}</td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            ` : `
                                <div class="empty-state">暂无出库记录</div>
                            `}
                        </div>
                    </div>
                `;

                document.getElementById('card-detail-content').innerHTML = content;
                document.getElementById('card-detail-modal').classList.add('active');
            } catch (e) {
                this.showToast(e.message || '获取卡片详情失败', 'error');
            }
        }

        closeCardDetailModal() {
            document.getElementById('card-detail-modal').classList.remove('active');
        }

        async handleInbound() {
            const data = {
                goodsId: document.getElementById('inbound-goods').value,
                batchNo: document.getElementById('inbound-batch').value,
                quantity: parseInt(document.getElementById('inbound-quantity').value),
                inboundDate: document.getElementById('inbound-date').value,
                storageLocation: document.getElementById('inbound-storage-location').value,
                inboundOperator: document.getElementById('inbound-operator').value,
                inboundReason: document.getElementById('inbound-reason').value,
                inboundRemark: document.getElementById('inbound-remark').value
            };

            try {
                await addCard(data);
                this.showToast('入库成功', 'success');
                this.resetInboundForm();
                await this.updateUI();
            } catch (e) {
                this.showToast(e.message, 'error');
            }
        }

        resetInboundForm() {
            document.getElementById('inbound-form').reset();
            document.getElementById('inbound-date').valueAsDate = new Date();
            document.getElementById('inbound-batch').value = generateBatchNo();
            document.getElementById('inbound-spec').value = '';
            document.getElementById('inbound-unit').value = '';
        }

        async handleOutbound() {
            const data = {
                quantity: parseInt(document.getElementById('outbound-quantity').value),
                date: document.getElementById('outbound-date').value,
                reason: document.getElementById('outbound-reason').value,
                operator: document.getElementById('outbound-operator').value,
                remark: document.getElementById('outbound-remark').value
            };

            if (!this.currentCardId) {
                this.showToast('请选择批次', 'error');
                return;
            }

            try {
                await addOutboundRecord(this.currentCardId, data);
                this.showToast('出库成功', 'success');
                this.resetOutboundForm();
                await this.updateUI();
            } catch (e) {
                this.showToast(e.message, 'error');
            }
        }

        resetOutboundForm() {
            document.getElementById('outbound-form').reset();
            document.getElementById('outbound-date').valueAsDate = new Date();
            document.getElementById('outbound-current-stock').value = '';
            this.currentCardId = null;
        }

        async showReportTab(tabId) {
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

            const btn = document.querySelector(`[data-tab="${tabId}"]`);
            const tab = document.getElementById(tabId);
            if (btn) btn.classList.add('active');
            if (tab) tab.classList.add('active');

            try {
                if (tabId === 'stock-summary') {
                    await this.renderStockSummary();
                } else if (tabId === 'inbound-detail') {
                    await this.renderInboundDetail();
                } else if (tabId === 'outbound-detail') {
                    await this.renderOutboundDetail();
                } else if (tabId === 'low-stock') {
                    await this.renderLowStock();
                }
            } catch (e) {
                console.error('切换报表失败:', e);
            }
        }

        async renderStockSummary() {
            try {
                const ledger = await API.getStockSummary();
                const tbody = document.getElementById('stock-summary-body');

                if (ledger.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">暂无数据</td></tr>';
                    return;
                }

                tbody.innerHTML = ledger.map(item => `
                    <tr>
                        <td>${item.goodsName}</td>
                        <td>${item.category}</td>
                        <td>${item.spec || '-'}</td>
                        <td>${item.unit || '-'}</td>
                        <td>${item.totalInbound}</td>
                        <td>${item.totalOutbound}</td>
                        <td>${item.currentStock}</td>
                    </tr>
                `).join('');
            } catch (e) {
                console.error('渲染库存汇总失败:', e);
            }
        }

        async renderInboundDetail(startDate = '', endDate = '') {
            try {
                const cards = await getAllCards();
                let filtered = cards;

                if (startDate) {
                    const s = startDate;
                    filtered = filtered.filter(c => (c.inbound_date || c.inboundDate) >= s);
                }
                if (endDate) {
                    const e = endDate;
                    filtered = filtered.filter(c => (c.inbound_date || c.inboundDate) <= e);
                }

                const tbody = document.getElementById('inbound-detail-body');

                if (filtered.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center;">暂无数据</td></tr>';
                    return;
                }

                tbody.innerHTML = filtered.map(card => `
                    <tr>
                        <td>${card.batch_no || card.batchNo}</td>
                        <td>${card.goods_name || card.goodsName}</td>
                        <td>${card.spec || '-'}</td>
                        <td>${card.quantity}</td>
                        <td>${card.inbound_date || card.inboundDate}</td>
                        <td>${card.storage_location || card.storageLocation || '-'}</td>
                        <td>${card.inbound_operator || card.inboundOperator}</td>
                        <td>${card.inbound_reason || card.inboundReason}</td>
                    </tr>
                `).join('');
            } catch (e) {
                console.error('渲染入库明细失败:', e);
            }
        }

        async renderOutboundDetail(startDate = '', endDate = '') {
            try {
                const cards = await getAllCards();
                const allOutbound = [];

                cards.forEach(card => {
                    if (card.outboundRecords && card.outboundRecords.length > 0) {
                        card.outboundRecords.forEach(record => {
                            allOutbound.push({
                                ...record,
                                batchNo: card.batch_no || card.batchNo,
                                goodsName: card.goods_name || card.goodsName,
                                spec: card.spec || '',
                                unit: card.unit || ''
                            });
                        });
                    }
                });

                let filtered = allOutbound;
                if (startDate) {
                    const s = startDate;
                    filtered = filtered.filter(r => r.date >= s);
                }
                if (endDate) {
                    const e = endDate;
                    filtered = filtered.filter(r => r.date <= e);
                }

                const tbody = document.getElementById('outbound-detail-body');

                if (filtered.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center;">暂无数据</td></tr>';
                    return;
                }

                tbody.innerHTML = filtered.map(record => `
                    <tr>
                        <td>${record.batchNo}</td>
                        <td>${record.goodsName}</td>
                        <td>${record.spec || '-'}</td>
                        <td>${record.quantity}${record.unit}</td>
                        <td>${record.date}</td>
                        <td>${record.reason}</td>
                        <td>${record.operator}</td>
                        <td>${record.remark || '-'}</td>
                    </tr>
                `).join('');
            } catch (e) {
                console.error('渲染出库明细失败:', e);
            }
        }

        async renderLowStock() {
            try {
                const lowStockItems = await getLowStockItems();
                const tbody = document.getElementById('low-stock-body');

                if (lowStockItems.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">暂无库存预警商品</td></tr>';
                    return;
                }

                tbody.innerHTML = lowStockItems.map(item => `
                    <tr class="warning">
                        <td>${item.goodsName}</td>
                        <td>${item.category}</td>
                        <td>${item.spec || '-'}</td>
                        <td>${item.unit || '-'}</td>
                        <td>${item.currentStock}</td>
                        <td>${item.warningThreshold}</td>
                        <td>${item.difference}</td>
                    </tr>
                `).join('');
            } catch (e) {
                console.error('渲染预警报表失败:', e);
            }
        }

        showToast(message, type = 'success') {
            const toast = document.getElementById('toast');
            toast.textContent = message;
            toast.className = `toast ${type} show`;
            setTimeout(() => {
                toast.classList.remove('show');
            }, 3000);
        }

        async backupData() {
            try {
                const data = await API.exportBackup();
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `warehouse_backup_${new Date().toISOString().split('T')[0]}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                this.showToast('备份成功', 'success');
            } catch (e) {
                this.showToast('备份失败: ' + e.message, 'error');
            }
        }

        async handleRestore(file) {
            if (!file) return;

            try {
                const text = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = (e) => resolve(e.target.result);
                    reader.onerror = reject;
                    reader.readAsText(file);
                });

                const data = JSON.parse(text);
                if (confirm('确定要恢复数据吗？这将覆盖当前所有数据！')) {
                    await API.restoreBackup(data);
                    this.showToast('恢复成功', 'success');
                    await this.updateUI();
                }
            } catch (e) {
                this.showToast(e.message || '无效的备份文件', 'error');
            }
        }

        async initializeData() {
            if (confirm('确定要初始化数据吗？这将清空所有现有数据！')) {
                try {
                    await API.initializeSample();
                    this.showToast('初始化成功', 'success');
                    await this.updateUI();
                } catch (e) {
                    this.showToast('初始化失败: ' + e.message, 'error');
                }
            }
        }

        async exportToExcel(reportType) {
            try {
                let table, filename, headers;

                switch (reportType) {
                    case 'stock-summary':
                        await this.renderStockSummary();
                        table = document.getElementById('stock-summary-body');
                        filename = '库存汇总报表';
                        headers = ['商品名称', '类别', '规格', '单位', '总入库量', '累计出库量', '当前库存'];
                        break;
                    case 'inbound-detail':
                        table = document.getElementById('inbound-detail-body');
                        filename = '入库明细报表';
                        headers = ['批次号', '商品名称', '规格', '入库数量', '入库日期', '库存地点', '经手人', '入库原因'];
                        break;
                    case 'outbound-detail':
                        table = document.getElementById('outbound-detail-body');
                        filename = '出库明细报表';
                        headers = ['批次号', '商品名称', '规格', '出库数量', '出库日期', '出库原因', '经手人', '备注'];
                        break;
                    case 'low-stock':
                        await this.renderLowStock();
                        table = document.getElementById('low-stock-body');
                        filename = '库存预警报表';
                        headers = ['商品名称', '类别', '规格', '单位', '当前库存', '预警阈值', '差额'];
                        break;
                    default:
                        return;
                }

                const rows = table.querySelectorAll('tr');
                let csv = headers.join('\t') + '\n';

                rows.forEach(row => {
                    const cells = row.querySelectorAll('td');
                    const rowData = Array.from(cells).map(cell => {
                        const text = cell.textContent.trim();
                        return text.includes('\t') ? `"${text}"` : text;
                    });
                    csv += rowData.join('\t') + '\n';
                });

                const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                this.showToast('导出成功', 'success');
            } catch (e) {
                this.showToast('导出失败: ' + e.message, 'error');
            }
        }
    }

    // ==================== 初始化应用 ====================
    window.App = new WarehouseApp();

    // 暴露全局函数供 onclick 调用
    window.showGoodsModal = (id) => window.App.showGoodsModal(id);
    window.closeGoodsModal = () => window.App.closeGoodsModal();
    window.viewCardDetail = (cardId) => window.App.viewCardDetail(cardId);
    window.closeCardDetailModal = () => window.App.closeCardDetailModal();
    window.resetInboundForm = () => window.App.resetInboundForm();
    window.resetOutboundForm = () => window.App.resetOutboundForm();
    window.backupData = () => window.App.backupData();
    window.initializeData = () => window.App.initializeData();
    window.exportToExcel = (reportType) => window.App.exportToExcel(reportType);
    window.filterInboundReport = () => {
        const startDate = document.getElementById('inbound-start-date').value;
        const endDate = document.getElementById('inbound-end-date').value;
        window.App.renderInboundDetail(startDate, endDate);
    };
    window.filterOutboundReport = () => {
        const startDate = document.getElementById('outbound-start-date').value;
        const endDate = document.getElementById('outbound-end-date').value;
        window.App.renderOutboundDetail(startDate, endDate);
    };
})();
