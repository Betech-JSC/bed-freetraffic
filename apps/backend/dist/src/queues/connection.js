"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connection = exports.useRedis = void 0;
exports.logRedisError = logRedisError;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.useRedis = process.env.USE_REDIS === 'true' ||
    (!!(process.env.REDIS_URL || process.env.REDIS_HOST) && process.env.USE_REDIS !== 'false');
const redisHostOrUrl = process.env.REDIS_URL || process.env.REDIS_HOST || '127.0.0.1';
const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
exports.connection = (redisHostOrUrl.startsWith('redis://') || redisHostOrUrl.startsWith('rediss://'))
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
const loggedErrors = new Set();
function logRedisError(prefix, err) {
    if (!exports.useRedis)
        return;
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
