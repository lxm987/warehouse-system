-- ==========================================
-- 仓库进销存管理系统 - Supabase 建表脚本
-- 在 Supabase SQL Editor 中执行
-- ==========================================

-- 用户资料表（关联 auth.users）
CREATE TABLE IF NOT EXISTS profiles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    phone TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 商品表
CREATE TABLE IF NOT EXISTS goods (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    spec TEXT DEFAULT '',
    unit TEXT NOT NULL,
    warning_threshold INTEGER DEFAULT 10,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 保管卡片表
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
    outbound_records JSONB DEFAULT '[]'::jsonb,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 修改记录表
CREATE TABLE IF NOT EXISTS modification_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    field TEXT NOT NULL,
    old_value TEXT NOT NULL,
    new_value TEXT NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- Row Level Security (RLS)
-- ==========================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE goods ENABLE ROW LEVEL SECURITY;
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE modification_logs ENABLE ROW LEVEL SECURITY;

-- profiles: 所有人可读，只能修改自己的
CREATE POLICY "允许读取所有用户资料" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "允许创建自己的资料" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "允许更新自己的资料" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- goods: 所有登录用户可读写
CREATE POLICY "允许读取商品" ON goods FOR SELECT TO authenticated USING (true);
CREATE POLICY "允许新增商品" ON goods FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "允许更新商品" ON goods FOR UPDATE TO authenticated USING (true);
CREATE POLICY "允许删除商品" ON goods FOR DELETE TO authenticated USING (true);

-- cards: 所有登录用户可读写
CREATE POLICY "允许读取卡片" ON cards FOR SELECT TO authenticated USING (true);
CREATE POLICY "允许新增卡片" ON cards FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "允许更新卡片" ON cards FOR UPDATE TO authenticated USING (true);
CREATE POLICY "允许删除卡片" ON cards FOR DELETE TO authenticated USING (true);

-- modification_logs: 所有人可读，只能创建自己的
CREATE POLICY "允许读取所有修改记录" ON modification_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "允许创建自己的记录" ON modification_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- ==========================================
-- 示例数据（可选）
-- ==========================================

INSERT INTO goods (id, name, category, spec, unit, warning_threshold) VALUES
    ('g001', '苹果', '食品', '红富士', '斤', 50),
    ('g002', '大米', '食品', '五常大米', '袋', 20),
    ('g003', '笔记本电脑', '电子产品', 'MacBook Pro 14寸', '台', 5),
    ('g004', '打印机', '办公用品', 'HP LaserJet', '台', 3),
    ('g005', '食用油', '食品', '金龙鱼 5L', '桶', 30)
ON CONFLICT (id) DO NOTHING;

INSERT INTO cards (id, batch_no, goods_id, goods_name, spec, unit, quantity, storage_location, inbound_date, inbound_operator, inbound_reason, inbound_remark, outbound_records) VALUES
    ('c001', '20240115001', 'g001', '苹果', '红富士', '斤', 500, 'A区-1层-01架', '2024-01-15', '张三', '采购入库', '春节备货',
     '[{"id":"o001","quantity":100,"date":"2024-01-18","reason":"销售","operator":"李四","remark":"批发"},{"id":"o002","quantity":50,"date":"2024-01-20","reason":"销售","operator":"李四","remark":"零售"}]'),
    ('c002', '20240116001', 'g001', '苹果', '红富士', '斤', 300, 'A区-1层-02架', '2024-01-16', '张三', '采购入库', '',
     '[{"id":"o003","quantity":80,"date":"2024-01-19","reason":"销售","operator":"李四","remark":""}]'),
    ('c003', '20240114001', 'g002', '大米', '五常大米', '袋', 100, 'B区-2层-03架', '2024-01-14', '王五', '采购入库', '批量采购',
     '[{"id":"o004","quantity":30,"date":"2024-01-17","reason":"销售","operator":"李四","remark":"食堂采购"}]'),
    ('c004', '20240113001', 'g003', '笔记本电脑', 'MacBook Pro 14寸', '台', 10, 'C区-1层-01架', '2024-01-13', '赵六', '采购入库', '公司采购',
     '[{"id":"o005","quantity":2,"date":"2024-01-15","reason":"领用","operator":"赵六","remark":"部门领用"}]'),
    ('c005', '20240112001', 'g005', '食用油', '金龙鱼 5L', '桶', 50, 'B区-1层-05架', '2024-01-12', '张三', '采购入库', '',
     '[]'::jsonb)
ON CONFLICT (id) DO NOTHING;
