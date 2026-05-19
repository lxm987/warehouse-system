(function() {
    'use strict';

    const DB_NAME = 'WarehouseDB';
    const DB_VERSION = 3;
    const CACHE_TTL = 5 * 60 * 1000;

    const STORE_NAMES = {
        USERS: 'users',
        SESSIONS: 'sessions',
        LOGS: 'modification_logs'
    };

    let dbInstance = null;
    let cache = new Map();

    function getCacheKey(store, method, params) {
        return `${store}:${method}:${JSON.stringify(params)}`;
    }

    function getFromCache(key) {
        const entry = cache.get(key);
        if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
            return entry.data;
        }
        cache.delete(key);
        return null;
    }

    function setCache(key, data) {
        cache.set(key, { data, timestamp: Date.now() });
        if (cache.size > 100) {
            const oldest = cache.keys().next().value;
            cache.delete(oldest);
        }
    }

    function clearCache(store) {
        if (store) {
            for (const key of cache.keys()) {
                if (key.startsWith(store)) cache.delete(key);
            }
        } else {
            cache.clear();
        }
    }

    function openDatabase() {
        return new Promise((resolve, reject) => {
            if (dbInstance) {
                resolve(dbInstance);
                return;
            }

            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => {
                reject(new Error('无法打开数据库: ' + request.error.message));
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                if (!db.objectStoreNames.contains(STORE_NAMES.USERS)) {
                    const userStore = db.createObjectStore(STORE_NAMES.USERS, { keyPath: 'id', autoIncrement: true });
                    userStore.createIndex('username', 'username', { unique: true });
                    userStore.createIndex('email', 'email', { unique: false });
                    userStore.createIndex('phone', 'phone', { unique: false });
                    userStore.createIndex('createdAt', 'createdAt', { unique: false });
                } else {
                    const userStore = event.target.transaction.objectStore(STORE_NAMES.USERS);
                    if (!userStore.indexNames.contains('phone')) {
                        userStore.createIndex('phone', 'phone', { unique: false });
                    }
                }

                if (!db.objectStoreNames.contains(STORE_NAMES.SESSIONS)) {
                    const sessionStore = db.createObjectStore(STORE_NAMES.SESSIONS, { keyPath: 'id', autoIncrement: true });
                    sessionStore.createIndex('userId', 'userId', { unique: false });
                    sessionStore.createIndex('token', 'token', { unique: true });
                }

                if (!db.objectStoreNames.contains(STORE_NAMES.LOGS)) {
                    const logStore = db.createObjectStore(STORE_NAMES.LOGS, { keyPath: 'id', autoIncrement: true });
                    logStore.createIndex('userId', 'userId', { unique: false });
                    logStore.createIndex('timestamp', 'timestamp', { unique: false });
                }
            };

            request.onsuccess = (event) => {
                dbInstance = event.target.result;

                dbInstance.onversionchange = () => {
                    dbInstance.close();
                    dbInstance = null;
                };

                resolve(dbInstance);
            };
        });
    }

    function getStore(storeName, mode = 'readonly') {
        return openDatabase().then(db => {
            const transaction = db.transaction(storeName, mode);
            return transaction.objectStore(storeName);
        });
    }

    const Database = {

        async add(storeName, data) {
            const store = await getStore(storeName, 'readwrite');
            return new Promise((resolve, reject) => {
                const request = store.add(data);
                request.onsuccess = () => {
                    clearCache(storeName);
                    resolve(request.result);
                };
                request.onerror = () => reject(new Error(`添加数据失败: ${request.error.message}`));
            });
        },

        async get(storeName, id) {
            const cacheKey = getCacheKey(storeName, 'get', id);
            const cached = getFromCache(cacheKey);
            if (cached !== null) return cached;

            const store = await getStore(storeName);
            return new Promise((resolve, reject) => {
                const request = store.get(id);
                request.onsuccess = () => {
                    setCache(cacheKey, request.result || null);
                    resolve(request.result || null);
                };
                request.onerror = () => reject(new Error(`获取数据失败: ${request.error.message}`));
            });
        },

        async getAll(storeName) {
            const cacheKey = getCacheKey(storeName, 'getAll', '');
            const cached = getFromCache(cacheKey);
            if (cached !== null) return cached;

            const store = await getStore(storeName);
            return new Promise((resolve, reject) => {
                const request = store.getAll();
                request.onsuccess = () => {
                    setCache(cacheKey, request.result);
                    resolve(request.result);
                };
                request.onerror = () => reject(new Error(`获取所有数据失败: ${request.error.message}`));
            });
        },

        async update(storeName, data) {
            const store = await getStore(storeName, 'readwrite');
            return new Promise((resolve, reject) => {
                const request = store.put(data);
                request.onsuccess = () => {
                    clearCache(storeName);
                    resolve(request.result);
                };
                request.onerror = () => reject(new Error(`更新数据失败: ${request.error.message}`));
            });
        },

        async delete(storeName, id) {
            const store = await getStore(storeName, 'readwrite');
            return new Promise((resolve, reject) => {
                const request = store.delete(id);
                request.onsuccess = () => {
                    clearCache(storeName);
                    resolve(true);
                };
                request.onerror = () => reject(new Error(`删除数据失败: ${request.error.message}`));
            });
        },

        async findByIndex(storeName, indexName, value) {
            const cacheKey = getCacheKey(storeName, 'findByIndex', { indexName, value });
            const cached = getFromCache(cacheKey);
            if (cached !== null) return cached;

            const store = await getStore(storeName);
            return new Promise((resolve, reject) => {
                const index = store.index(indexName);
                const request = index.getAll(value);
                request.onsuccess = () => {
                    setCache(cacheKey, request.result);
                    resolve(request.result);
                };
                request.onerror = () => reject(new Error(`索引查询失败: ${request.error.message}`));
            });
        },

        async findOneByIndex(storeName, indexName, value) {
            const results = await this.findByIndex(storeName, indexName, value);
            return results.length > 0 ? results[0] : null;
        },

        async count(storeName) {
            const cacheKey = getCacheKey(storeName, 'count', '');
            const cached = getFromCache(cacheKey);
            if (cached !== null) return cached;

            const store = await getStore(storeName);
            return new Promise((resolve, reject) => {
                const request = store.count();
                request.onsuccess = () => {
                    setCache(cacheKey, request.result);
                    resolve(request.result);
                };
                request.onerror = () => reject(new Error(`计数失败: ${request.error.message}`));
            });
        },

        async clearStore(storeName) {
            const store = await getStore(storeName, 'readwrite');
            return new Promise((resolve, reject) => {
                const request = store.clear();
                request.onsuccess = () => {
                    clearCache(storeName);
                    resolve(true);
                };
                request.onerror = () => reject(new Error(`清空数据失败: ${request.error.message}`));
            });
        },

        async transaction(storeNames, mode, callback) {
            const db = await openDatabase();
            const transaction = db.transaction(storeNames, mode);
            const stores = {};
            storeNames.forEach(name => {
                stores[name] = transaction.objectStore(name);
            });

            return new Promise((resolve, reject) => {
                transaction.oncomplete = () => {
                    clearCache();
                    resolve(result);
                };
                transaction.onerror = () => reject(new Error(`事务失败: ${transaction.error.message}`));

                let result;
                try {
                    result = callback(stores);
                } catch (e) {
                    reject(e);
                }
            });
        },

        async getDatabaseInfo() {
            const db = await openDatabase();
            const info = {
                name: db.name,
                version: db.version,
                stores: []
            };
            for (const name of db.objectStoreNames) {
                const store = db.transaction(name).objectStore(name);
                const indexes = [];
                for (const idxName of store.indexNames) {
                    const idx = store.index(idxName);
                    indexes.push({ name: idx.name, keyPath: idx.keyPath, unique: idx.unique });
                }
                info.stores.push({ name, keyPath: store.keyPath, indexes, count: await this.count(name) });
            }
            return info;
        },

        close() {
            if (dbInstance) {
                dbInstance.close();
                dbInstance = null;
                cache.clear();
            }
        }
    };

    window.Database = Database;
    window.DB_STORES = STORE_NAMES;
})();