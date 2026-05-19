const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'warehouse_jwt_secret_2024';

function authMiddleware(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ error: '未登录，请先登录' });
    }
    try {
        const token = header.split(' ')[1];
        const payload = jwt.verify(token, JWT_SECRET);
        req.user = { userId: payload.userId, username: payload.username, name: payload.name };
        next();
    } catch {
        return res.status(401).json({ error: '登录已过期，请重新登录' });
    }
}

function generateToken(user) {
    return jwt.sign(
        { userId: user.id, username: user.username, name: user.name },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
}

module.exports = { authMiddleware, generateToken, JWT_SECRET };
