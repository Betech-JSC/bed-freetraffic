import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { dispatchDueEmailCampaigns, sendEmailCampaign } from '../services/emailCampaignSend';
import { authenticate, AuthRequest, requireWrite } from '../middleware/auth';

const router = Router();

router.get('/track/open/:campaignId', async (req: Request, res: Response): Promise<void> => {
  const campaignId = parseInt(req.params.campaignId as string);
  try {
    await prisma.emailEvent.create({
      data: { campaignId, eventType: 'open', recipient: (req.query.r as string) || null },
    });
    await prisma.emailCampaign.update({
      where: { id: campaignId },
      data: { openCount: { increment: 1 } },
    });
  } catch {
    /* ignore */
  }
  const pixel = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  );
  res.setHeader('Content-Type', 'image/png');
  res.send(pixel);
});

router.get('/track/click/:campaignId', async (req: Request, res: Response): Promise<void> => {
  const campaignId = parseInt(req.params.campaignId as string);
  const target = (req.query.url as string) || '/';
  try {
    await prisma.emailEvent.create({
      data: { campaignId, eventType: 'click', recipient: (req.query.r as string) || null },
    });
    await prisma.emailCampaign.update({
      where: { id: campaignId },
      data: { clickCount: { increment: 1 } },
    });
  } catch {
    /* ignore */
  }
  res.redirect(target);
});

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

  const processed = await dispatchDueEmailCampaigns(20);
  res.json({ processed, message: `Đã gửi ${processed} chiến dịch email đến hạn` });
});

import { workspaceMiddleware } from '../middleware/workspace';

router.use(authenticate, workspaceMiddleware);

router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const campaigns = await prisma.emailCampaign.findMany({
    where: { workspaceId: req.workspaceId },
    orderBy: { createdAt: 'desc' }
  });
  res.json(campaigns);
});

router.post('/', requireWrite, async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, subject, htmlContent, recipients, scheduledAt } = req.body;
  if (!name || !subject || !htmlContent || !recipients) {
    res.status(400).json({ error: 'name, subject, htmlContent, recipients là bắt buộc' });
    return;
  }
  const campaign = await prisma.emailCampaign.create({
    data: {
      name,
      subject,
      htmlContent,
      recipients: typeof recipients === 'string' ? recipients : recipients.join(','),
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      status: scheduledAt ? 'SCHEDULED' : 'DRAFT',
      workspaceId: req.workspaceId,
    },
  });
  res.status(201).json(campaign);
});

router.post('/:id/send', requireWrite, async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params.id as string);
  const campaign = await prisma.emailCampaign.findFirst({
    where: { id, workspaceId: req.workspaceId }
  });
  if (!campaign) {
    res.status(404).json({ error: 'Không tìm thấy chiến dịch' });
    return;
  }

  try {
    const result = await sendEmailCampaign(id);
    if (result.status === 'FAILED') {
      res.status(400).json({
        error: result.errors[0] || 'Không gửi được email nào. Kiểm tra SMTP trong Cài đặt.',
        sent: 0,
        total: result.total,
        errors: result.errors,
      });
      return;
    }
    res.json({
      message: `Đã gửi ${result.sent}/${result.total} email`,
      sent: result.sent,
      total: result.total,
      errors: result.errors.length ? result.errors : undefined,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Gửi thất bại';
    res.status(400).json({ error: msg });
  }
});

router.patch('/:id', requireWrite, async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params.id as string);
  const existing = await prisma.emailCampaign.findFirst({
    where: { id, workspaceId: req.workspaceId }
  });
  if (!existing) {
    res.status(404).json({ error: 'Không tìm thấy' });
    return;
  }
  if (existing.status === 'SENT') {
    res.status(400).json({ error: 'Chiến dịch đã gửi, không thể sửa' });
    return;
  }

  const { name, subject, htmlContent, recipients, scheduledAt } = req.body;
  const data: Record<string, unknown> = {};
  if (name != null) data.name = String(name).trim();
  if (subject != null) data.subject = String(subject).trim();
  if (htmlContent != null) data.htmlContent = String(htmlContent);
  if (recipients != null) {
    data.recipients =
      typeof recipients === 'string' ? recipients : (recipients as string[]).join(',');
  }
  if (scheduledAt !== undefined) {
    if (scheduledAt === null || scheduledAt === '') {
      data.scheduledAt = null;
      data.status = 'DRAFT';
    } else {
      data.scheduledAt = new Date(scheduledAt);
      data.status = 'SCHEDULED';
    }
  }

  const updated = await prisma.emailCampaign.update({ where: { id }, data });
  res.json(updated);
});

router.delete('/:id', requireWrite, async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params.id as string);
  const existing = await prisma.emailCampaign.findFirst({
    where: { id, workspaceId: req.workspaceId }
  });
  if (!existing) {
    res.status(404).json({ error: 'Không tìm thấy' });
    return;
  }
  await prisma.emailCampaign.delete({ where: { id } });
  res.status(204).send();
});

export default router;
