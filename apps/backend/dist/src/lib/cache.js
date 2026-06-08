"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cache = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
class MemoryCache {
    store = new Map();
    gcInterval = null;
    constructor() {
        // Run GC every 5 minutes to clean up expired entries
        this.gcInterval = setInterval(() => {
            this.runGc();
        }, 5 * 60 * 1000);
        if (this.gcInterval && typeof this.gcInterval.unref === 'function') {
            this.gcInterval.unref();
        }
    }
    runGc() {
        const now = Date.now();
        for (const [key, item] of this.store.entries()) {
            if (now > item.expiresAt) {
                this.store.delete(key);
            }
        }
    }
    async get(key) {
        const item = this.store.get(key);
        if (!item)
            return null;
        if (Date.now() > item.expiresAt) {
            this.store.delete(key);
            return null;
        }
        return item.value;
    }
    async set(key, value, ttlSeconds = 300) {
        const expiresAt = Date.now() + ttlSeconds * 1000;
        this.store.set(key, { value, expiresAt });
    }
    async del(key) {
        this.store.delete(key);
    }
    async flush() {
        this.store.clear();
    }
}
class RedisCache {
    client;
    constructor(urlOrHost) {
        if (urlOrHost.startsWith('redis://') || urlOrHost.startsWith('rediss://')) {
            this.client = new ioredis_1.default(urlOrHost, {
                maxRetriesPerRequest: 1,
                lazyConnect: true,
            });
        }
        else {
            const port = parseInt(process.env.REDIS_PORT || '6379', 10);
            this.client = new ioredis_1.default({
                host: urlOrHost,
                port,
                maxRetriesPerRequest: 1,
                lazyConnect: true,
            });
        }
        this.client.on('error', (err) => {
            console.warn('[Redis Cache] Connection error:', err.message);
        });
    }
    async get(key) {
        try {
            const raw = await this.client.get(key);
            if (!raw)
                return null;
            return JSON.parse(raw);
        }
        catch (err) {
            console.error('[Redis Cache] GET error:', err);
            return null;
        }
    }
    async set(key, value, ttlSeconds = 300) {
        try {
            const serialized = JSON.stringify(value);
            await this.client.set(key, serialized, 'EX', ttlSeconds);
        }
        catch (err) {
            console.error('[Redis Cache] SET error:', err);
        }
    }
    async del(key) {
        try {
            await this.client.del(key);
        }
        catch (err) {
            console.error('[Redis Cache] DEL error:', err);
        }
    }
    async flush() {
        try {
            await this.client.flushdb();
        }
        catch (err) {
            console.error('[Redis Cache] FLUSH error:', err);
        }
    }
}
let cacheInstance;
const redisHostOrUrl = process.env.REDIS_URL || process.env.REDIS_HOST;
if (redisHostOrUrl) {
    console.log('[Cache] Initializing Redis cache...');
    cacheInstance = new RedisCache(redisHostOrUrl);
}
else {
    console.log('[Cache] Redis configuration not found. Initializing in-memory fallback cache...');
    cacheInstance = new MemoryCache();
}
exports.cache = cacheInstance;
