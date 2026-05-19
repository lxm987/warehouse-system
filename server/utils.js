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

module.exports = { generateId, generateBatchNo };
