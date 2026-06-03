import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest, requireWrite } from '../middleware/auth';
import { imageUpload, uploadedImageUrl } from '../lib/upload';
import {
  dispatchDueSchedules,
  executeContentSchedule,
  getChannelConnectionStatus,
} from '../services/scheduleDispatch';

const router = Router();

router.post('/dispatch-due', async (req: Request, res: Response): Promise<void> => {
  const secret = (req.headers['x-cron-secret'] as string) || (req.query.secret as string);
  if (process.env.CRON_SECRET) {
    if (secret !== process.env.CRON_SECRET) {
      res.status(401).json({ error: 'Cron secret không hợp lệ' });
      return;
    }
  } else if (process.env.NODE_ENV === 'production') {
    res.status(503).json({ error: 'Chưa cấu hình CRON_SECRET trên server' });
    return;
  }

  const processed = await dispatchDueSchedules(20);
  res.json({ processed, message: `Đã xử lý ${processed} lịch đến hạn` });
});

router.use(authenticate);

router.get('/channels-status', async (_req: AuthRequest, res: Response): Promise<void> => {
  res.json(await getChannelConnectionStatus());
});

router.get('/', async (_req: AuthRequest, res: Response): Promise<void> => {
  const items = await prisma.contentSchedule.findMany({ orderBy: { scheduledAt: 'desc' } });
  res.json(items);
});

async function createSchedule(req: AuthRequest, res: Response): Promise<void> {
  try {
    const body = req.body ?? {};
    const { title, content, platforms, urlTarget, recipients, scheduledAt, repeatRule, repeatUntil, abTestId, cronExpression } =
      body;

    if (!title?.trim() || !content?.trim() || !platforms || !scheduledAt) {
      res.status(400).json({ error: 'Tiêu đề, nội dung, kênh gửi và thời gian là bắt buộc' });
      return;
    }

    const platformStr =
      typeof platforms === 'string' ? platforms : Array.isArray(platforms) ? platforms.join(',') : '';

    if (!platformStr.trim()) {
      res.status(400).json({ error: 'Chọn ít nhất một kênh: Facebook, Email hoặc Zalo' });
      return;
    }

    if (platformStr.includes('email') && !recipients?.trim() && !process.env.SCHEDULE_EMAIL_RECIPIENTS) {
      res.status(400).json({
        error: 'Kênh Email cần danh sách người nhận (email1@x.com, email2@x.com)',
      });
      return;
    }

    const scheduledDate = new Date(scheduledAt);
    if (Number.isNaN(scheduledDate.getTime())) {
      res.status(400).json({ error: 'Ngày giờ không hợp lệ' });
      return;
    }

    const imageUrl = req.file ? uploadedImageUrl(req.file.filename) : body.imageUrl || null;

    let repeatUntilDate: Date | null = null;
    if (repeatUntil) {
      repeatUntilDate = new Date(repeatUntil);
      if (Number.isNaN(repeatUntilDate.getTime())) {
        res.status(400).json({ error: 'repeatUntil không hợp lệ' });
        return;
      }
    }

    const rule =
      repeatRule && ['daily', 'weekly', 'cron'].includes(String(repeatRule).toLowerCase())
        ? String(repeatRule).toLowerCase()
        : null;

    const item = await prisma.contentSchedule.create({
      data: {
        title: String(title).trim(),
        content: String(content).trim(),
        imageUrl: imageUrl || null,
        platforms: platformStr,
        urlTarget: urlTarget?.trim() || null,
        recipients: recipients?.trim() || null,
        scheduledAt: scheduledDate,
        repeatRule: rule,
        cronExpression: rule === 'cron' ? (cronExpression ? String(cronExpression).trim() : null) : null,
        repeatUntil: repeatUntilDate,
        abTestId: abTestId ? parseInt(String(abTestId), 10) : null,
        status: body.status === 'DRAFT' ? 'DRAFT' : 'PENDING',
      },
    });
    res.status(201).json(item);
  } catch (error) {
    console.error('POST /schedules:', error);
    const msg = error instanceof Error ? error.message : 'Không tạo được lịch';
    res.status(500).json({ error: msg });
  }
}

router.post('/', (req: AuthRequest, res: Response, next) => {
  const contentType = req.headers['content-type'] || '';

  if (contentType.includes('multipart/form-data')) {
    imageUpload.single('image')(req, res, (err: unknown) => {
      if (err) {
        const msg = err instanceof Error ? err.message : 'Lỗi upload ảnh';
        res.status(400).json({ error: msg });
        return;
      }
      requireWrite(req, res, () => {
        void createSchedule(req, res);
      });
    });
    return;
  }

  requireWrite(req, res, () => {
    void createSchedule(req, res);
  });
});

router.post('/:id/send-now', requireWrite, async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  const item = await prisma.contentSchedule.findUnique({ where: { id } });
  if (!item) {
    res.status(404).json({ error: 'Không tìm thấy lịch' });
    return;
  }
  if (item.status === 'SENDING') {
    res.status(409).json({ error: 'Lịch đang được gửi' });
    return;
  }

  try {
    const result = await executeContentSchedule(item);
    const updated = await prisma.contentSchedule.findUnique({ where: { id } });
    res.json({ ...result, schedule: updated });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Gửi thất bại';
    res.status(500).json({ error: msg });
  }
});

router.patch('/:id', requireWrite, async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  const existing = await prisma.contentSchedule.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: 'Không tìm thấy lịch' });
    return;
  }
  if (!['PENDING', 'FAILED', 'DRAFT'].includes(existing.status)) {
    res.status(400).json({ error: 'Chỉ sửa lịch ở trạng thái Nháp, Chờ gửi hoặc Lỗi' });
    return;
  }

  const body = req.body ?? {};
  const data: Record<string, unknown> = {};

  if (body.title != null) data.title = String(body.title).trim();
  if (body.content != null) data.content = String(body.content).trim();
  if (body.abTestId !== undefined) {
    data.abTestId = body.abTestId ? parseInt(String(body.abTestId), 10) : null;
  }
  if (body.repeatRule !== undefined) {
    const r = body.repeatRule ? String(body.repeatRule).toLowerCase() : null;
    data.repeatRule = r && ['daily', 'weekly', 'cron'].includes(r) ? r : null;
  }
  if (body.cronExpression !== undefined) {
    data.cronExpression = body.cronExpression ? String(body.cronExpression).trim() : null;
  }
  if (body.repeatUntil !== undefined) {
    if (!body.repeatUntil) data.repeatUntil = null;
    else {
      const d = new Date(body.repeatUntil);
      if (Number.isNaN(d.getTime())) {
        res.status(400).json({ error: 'repeatUntil không hợp lệ' });
        return;
      }
      data.repeatUntil = d;
    }
  }
  if (body.platforms != null) {
    const platformStr =
      typeof body.platforms === 'string'
        ? body.platforms
        : Array.isArray(body.platforms)
          ? body.platforms.join(',')
          : '';
    if (!platformStr.trim()) {
      res.status(400).json({ error: 'Chọn ít nhất một kênh' });
      return;
    }
    data.platforms = platformStr;
  }
  if (body.urlTarget !== undefined) data.urlTarget = body.urlTarget?.trim() || null;
  if (body.recipients !== undefined) data.recipients = body.recipients?.trim() || null;
  if (body.scheduledAt != null) {
    const scheduledDate = new Date(body.scheduledAt);
    if (Number.isNaN(scheduledDate.getTime())) {
      res.status(400).json({ error: 'Ngày giờ không hợp lệ' });
      return;
    }
    data.scheduledAt = scheduledDate;
  }

  if (Object.keys(data).length === 0) {
    res.status(400).json({ error: 'Không có trường nào để cập nhật' });
    return;
  }

  data.status = body.status === 'DRAFT' ? 'DRAFT' : 'PENDING';
  data.errorMessage = null;
  data.channelResults = null;

  const item = await prisma.contentSchedule.update({ where: { id }, data });
  res.json(item);
});

router.delete('/:id', requireWrite, async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  await prisma.contentSchedule.delete({ where: { id } });
  res.status(204).send();
});

export default router;
