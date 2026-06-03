/** Tăng khi đổi API quan trọng — frontend có thể kiểm tra qua GET /api/health */
export const API_VERSION = '2026-06-03.1';

export const API_FEATURES = [
  'backlinks-scan',
  'backlinks-crud',
  'schedules-recurrence',
  'reports-pdf-xlsx',
  'email-campaigns',
  'auth-2fa',
] as const;
