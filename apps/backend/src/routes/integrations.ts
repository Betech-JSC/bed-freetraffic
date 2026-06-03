import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/mailchimp/status', (_req: AuthRequest, res: Response): void => {
  const key = process.env.MAILCHIMP_API_KEY;
  const server = process.env.MAILCHIMP_SERVER_PREFIX;
  res.json({
    configured: !!(key && server),
    provider: 'Mailchimp',
    message: key && server
      ? 'Mailchimp API key đã cấu hình — gửi email campaign vẫn dùng SMTP mặc định; đồng bộ list đầy đủ sẽ có ở bản sau.'
      : 'Thêm MAILCHIMP_API_KEY và MAILCHIMP_SERVER_PREFIX vào .env để bật tích hợp (OI-02). Hiện dùng SMTP trong Cài đặt.',
  });
});

export default router;
