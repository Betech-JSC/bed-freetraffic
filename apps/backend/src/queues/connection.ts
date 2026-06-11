import { ConnectionOptions } from 'bullmq';
import dotenv from 'dotenv';

dotenv.config();

export const useRedis = process.env.USE_REDIS === 'true' ||
  (!!(process.env.REDIS_URL || process.env.REDIS_HOST) && process.env.USE_REDIS !== 'false');

const redisHostOrUrl = process.env.REDIS_URL || process.env.REDIS_HOST || '127.0.0.1';
const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);

export const connection: ConnectionOptions = (redisHostOrUrl.startsWith('redis://') || redisHostOrUrl.startsWith('rediss://'))
  ? {
      url: redisHostOrUrl,
      maxRetriesPerRequest: null,
      retryStrategy(times) {
        // Progressive retry delay (starts at 1s, maxes at 30s) to avoid log spam
        return Math.min(times * 1000, 30000);
      }
    }
  : {
      host: redisHostOrUrl,
      port: redisPort,
      maxRetriesPerRequest: null,
      retryStrategy(times) {
        // Progressive retry delay (starts at 1s, maxes at 30s) to avoid log spam
        return Math.min(times * 1000, 30000);
      }
    };

const loggedErrors = new Set<string>();

export function logRedisError(prefix: string, err: any) {
  if (!useRedis) return;
  const msg = err.message || String(err);
  const cacheKey = `${prefix}:${msg}`;
  if (!loggedErrors.has(cacheKey)) {
    console.error(`[${prefix}] Lỗi kết nối Redis: ${msg}`);
    loggedErrors.add(cacheKey);
    
    // Clear from cache after 5 minutes to allow future logs if the error persists
    setTimeout(() => {
      loggedErrors.delete(cacheKey);
    }, 5 * 60 * 1000);
  }
}

