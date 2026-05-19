const express = require('express');
const cors = require('cors');
const path = require('path');
const os = require('os');
const { initDB, initSampleData } = require('./db');
const { authMiddleware } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Auth routes (no JWT required)
app.use('/api/auth', require('./routes/auth'));

// Protected routes
app.use('/api/profile', authMiddleware, require('./routes/profile'));
app.use('/api/goods', authMiddleware, require('./routes/goods'));
app.use('/api/cards', authMiddleware, require('./routes/cards'));
app.use('/api/ledger', authMiddleware, require('./routes/ledger'));
app.use('/api/backup', authMiddleware, require('./routes/backup'));

// Serve frontend static files
app.use(express.static(path.join(__dirname, '..')));

// Fallback to index.html for SPA
app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// Initialize database
initDB();
initSampleData();

app.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('  ==========================================');
    console.log('   仓库进销存管理系统 - 服务已启动');
    console.log('  ==========================================');
    console.log('');
    console.log(`  本地访问: http://localhost:${PORT}`);
    console.log('');
    console.log('  局域网访问（其他电脑输入以下地址）:');

    const interfaces = os.networkInterfaces();
    const seen = new Set();
    for (const [name, nets] of Object.entries(interfaces)) {
        for (const net of nets) {
            if (net.family === 'IPv4' && !net.internal && !seen.has(net.address)) {
                seen.add(net.address);
                console.log(`    http://${net.address}:${PORT}`);
            }
        }
    }

    console.log('');
    console.log('  按 Ctrl+C 停止服务');
    console.log('');
});
