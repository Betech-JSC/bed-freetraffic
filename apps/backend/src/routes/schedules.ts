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

router.get('/channels-status', async (req: AuthRequest, res: Response): Promise<void> => {
  res.json(await getChannelConnectionStatus(req.workspaceId));
});

router.get('/golden-hour', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const workspaceId = req.workspaceId;

    // 1. Lấy dữ liệu Email Clicks & Opens
    const campaigns = await prisma.emailCampaign.findMany({
      where: { workspaceId },
      select: { id: true }
    });
    const campaignIds = campaigns.map(c => c.id);
    const emailEvents = campaignIds.length > 0
      ? await prisma.emailEvent.findMany({
          where: { campaignId: { in: campaignIds } },
          select: { createdAt: true, eventType: true }
        })
      : [];

    // 2. Lấy dữ liệu Form Submissions
    const submissions = await prisma.formSubmission.findMany({
      where: { workspaceId },
      select: { createdAt: true }
    });

    // 3. Lấy dữ liệu Chat Sessions
    const chats = await prisma.chatSession.findMany({
      where: { workspaceId },
      select: { createdAt: true }
    });

    const totalInteractions = emailEvents.length + submissions.length + chats.length;

    if (totalInteractions < 5) {
      res.json({
        recommendedHours: [9, 12, 20],
        isFallback: true,
        message: 'Dữ liệu tương tác thưa thớt. Sử dụng khung giờ vàng mặc định (9:00, 12:00, 20:00).'
      });
      return;
    }

    const hourWeights = Array(24).fill(0);

    emailEvents.forEach(e => {
      const hr = new Date(e.createdAt).getHours();
      const weight = e.eventType === 'click' ? 3 : 1;
      hourWeights[hr] += weight;
    });

    submissions.forEach(s => {
      const hr = new Date(s.createdAt).getHours();
      hourWeights[hr] += 4; // Form submission thể hiện tương tác rất mạnh
    });

    chats.forEach(c => {
      const hr = new Date(c.createdAt).getHours();
      hourWeights[hr] += 2; // Tương tác chat
    });

    const sorted = hourWeights
      .map((weight, hour) => ({ hour, weight }))
      .sort((a, b) => b.weight - a.weight);

    const recommendedHours = sorted.slice(0, 3).map(h => h.hour);

    res.json({
      recommendedHours,
      isFallback: false,
      message: `Khung giờ vàng được đề xuất dựa trên phân tích ${totalInteractions} lượt tương tác tổng hợp (Email, Form, Chat).`
    });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi phân tích giờ vàng' });
  }
});

router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const items = await prisma.contentSchedule.findMany({
    where: { workspaceId: req.workspaceId },
    orderBy: { scheduledAt: 'desc' }
  });
  res.json(items);
});

async function createSchedule(req: AuthRequest, res: Response): Promise<void> {
  try {
    const body = req.body ?? {};
    const {
      title,
      content,
      platforms,
      targetConnectionsJson,
      urlTarget,
      recipients,
      scheduledAt,
      repeatRule,
      repeatUntil,
      abTestId,
      cronExpression,
      overlayText,
      overlayWatermark,
      overlayPosition,
      overlayFontSize,
      autopilot,
    } = body;

    if (!title?.trim() || !content?.trim() || !platforms || (!scheduledAt && !autopilot)) {
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

    let scheduledDate = new Date(scheduledAt);
    if (autopilot) {
      // 1. Calculate best hour weights based on unified events
      let topHour = 9; // Default
      try {
        const campaigns = await prisma.emailCampaign.findMany({
          where: { workspaceId: req.workspaceId },
          select: { id: true }
        });
        const campaignIds = campaigns.map(c => c.id);
        const emailEvents = campaignIds.length > 0
          ? await prisma.emailEvent.findMany({
              where: { campaignId: { in: campaignIds } },
              select: { createdAt: true, eventType: true }
            })
          : [];
        const submissions = await prisma.formSubmission.findMany({
          where: { workspaceId: req.workspaceId },
          select: { createdAt: true }
        });
        const chats = await prisma.chatSession.findMany({
          where: { workspaceId: req.workspaceId },
          select: { createdAt: true }
        });

        const hourWeights = Array(24).fill(0);
        emailEvents.forEach(e => { hourWeights[new Date(e.createdAt).getHours()] += e.eventType === 'click' ? 3 : 1; });
        submissions.forEach(s => { hourWeights[new Date(s.createdAt).getHours()] += 4; });
        chats.forEach(c => { hourWeights[new Date(c.createdAt).getHours()] += 2; });

        let maxWeight = -1;
        for (let h = 0; h < 24; h++) {
          if (hourWeights[h] > maxWeight) {
            maxWeight = hourWeights[h];
            topHour = h;
          }
        }
      } catch (err) {
        console.error('Lỗi khi tính giờ vàng cho Autopilot:', err);
      }

      // 2. Find closest pending schedule to place this after it
      const latestSchedule = await prisma.contentSchedule.findFirst({
        where: { workspaceId: req.workspaceId, status: 'PENDING' },
        orderBy: { scheduledAt: 'desc' }
      });

      let baseDate = new Date();
      if (latestSchedule && latestSchedule.scheduledAt > baseDate) {
        baseDate = new Date(latestSchedule.scheduledAt);
        baseDate.setDate(baseDate.getDate() + 1);
      } else {
        baseDate.setHours(baseDate.getHours() + 2);
      }

      baseDate.setHours(topHour, 0, 0, 0);

      if (baseDate.getTime() < Date.now() + 60 * 60 * 1000) {
        baseDate.setDate(baseDate.getDate() + 1);
        baseDate.setHours(topHour, 0, 0, 0);
      }

      scheduledDate = baseDate;
    } else {
      if (Number.isNaN(scheduledDate.getTime())) {
        res.status(400).json({ error: 'Ngày giờ không hợp lệ' });
        return;
      }
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
        targetConnectionsJson: targetConnectionsJson ? String(targetConnectionsJson).trim() : null,
        urlTarget: urlTarget?.trim() || null,
        recipients: recipients?.trim() || null,
        scheduledAt: scheduledDate,
        repeatRule: rule,
        cronExpression: rule === 'cron' ? (cronExpression ? String(cronExpression).trim() : null) : null,
        repeatUntil: repeatUntilDate,
        abTestId: abTestId ? parseInt(String(abTestId), 10) : null,
        overlayText: overlayText ? String(overlayText).trim() : null,
        overlayWatermark: overlayWatermark ? String(overlayWatermark).trim() : null,
        overlayPosition: overlayPosition ? String(overlayPosition).trim() : 'bottom-right',
        overlayFontSize: overlayFontSize ? parseInt(String(overlayFontSize), 10) : 32,
        status: body.status === 'DRAFT' ? 'DRAFT' : 'PENDING',
        workspaceId: req.workspaceId,
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
  const item = await prisma.contentSchedule.findFirst({
    where: { id, workspaceId: req.workspaceId }
  });
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
  const existing = await prisma.contentSchedule.findFirst({
    where: { id, workspaceId: req.workspaceId }
  });
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
  if (body.targetConnectionsJson !== undefined) {
    data.targetConnectionsJson = body.targetConnectionsJson ? String(body.targetConnectionsJson).trim() : null;
  }
  if (body.urlTarget !== undefined) data.urlTarget = body.urlTarget?.trim() || null;
  if (body.recipients !== undefined) data.recipients = body.recipients?.trim() || null;
  if (body.overlayText !== undefined) data.overlayText = body.overlayText ? String(body.overlayText).trim() : null;
  if (body.overlayWatermark !== undefined) data.overlayWatermark = body.overlayWatermark ? String(body.overlayWatermark).trim() : null;
  if (body.overlayPosition !== undefined) data.overlayPosition = body.overlayPosition ? String(body.overlayPosition).trim() : 'bottom-right';
  if (body.overlayFontSize !== undefined) {
    data.overlayFontSize = body.overlayFontSize ? parseInt(String(body.overlayFontSize), 10) : 32;
  }
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
  const existing = await prisma.contentSchedule.findFirst({
    where: { id, workspaceId: req.workspaceId }
  });
  if (!existing) {
    res.status(404).json({ error: 'Không tìm thấy lịch' });
    return;
  }
  await prisma.contentSchedule.delete({ where: { id } });
  res.status(204).send();
});

export default router;
