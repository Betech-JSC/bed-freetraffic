import rateLimit from 'express-rate-limit';

/**
 * Global rate limiter for standard Dashboard API routes.
 * Limits each IP to 100 requests per minute.
 */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: 'Bạn đang gửi quá nhiều yêu cầu. Vui lòng thử lại sau 1 phút.',
  },
});

/**
 * Public spam prevention rate limiter.
 * Limits each IP to 5 requests per minute for sensitive public-facing endpoints
 * (such as form submission, AI chatbot widget message, and public checkout).
 */
export const publicSpamLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: 'Bạn đã gửi yêu cầu quá nhanh. Vui lòng thử lại sau 1 phút.',
  },
});
