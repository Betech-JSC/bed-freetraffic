import Redis from 'ioredis';

export interface ICache {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  flush(): Promise<void>;
}

class MemoryCache implements ICache {
  private store = new Map<string, { value: any; expiresAt: number }>();

  async get<T>(key: string): Promise<T | null> {
    const item = this.store.get(key);
    if (!item) return null;
    if (Date.now() > item.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return item.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds = 300): Promise<void> {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.store.set(key, { value, expiresAt });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async flush(): Promise<void> {
    this.store.clear();
  }
}

class RedisCache implements ICache {
  private client: Redis;

  constructor(urlOrHost: string) {
    if (urlOrHost.startsWith('redis://') || urlOrHost.startsWith('rediss://')) {
      this.client = new Redis(urlOrHost, {
        maxRetriesPerRequest: 1,
        lazyConnect: true,
      });
    } else {
      const port = parseInt(process.env.REDIS_PORT || '6379', 10);
      this.client = new Redis({
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

  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.client.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch (err) {
      console.error('[Redis Cache] GET error:', err);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds = 300): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      await this.client.set(key, serialized, 'EX', ttlSeconds);
    } catch (err) {
      console.error('[Redis Cache] SET error:', err);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (err) {
      console.error('[Redis Cache] DEL error:', err);
    }
  }

  async flush(): Promise<void> {
    try {
      await this.client.flushdb();
    } catch (err) {
      console.error('[Redis Cache] FLUSH error:', err);
    }
  }
}

let cacheInstance: ICache;

const redisHostOrUrl = process.env.REDIS_URL || process.env.REDIS_HOST;

if (redisHostOrUrl) {
  console.log('[Cache] Initializing Redis cache...');
  cacheInstance = new RedisCache(redisHostOrUrl);
} else {
  console.log('[Cache] Redis configuration not found. Initializing in-memory fallback cache...');
  cacheInstance = new MemoryCache();
}

export const cache = cacheInstance;
