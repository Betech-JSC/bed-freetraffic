import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { runSeoAudit } from '../services/seoAuditService';
import { runPageSpeedAudit } from '../services/pagespeedAuditService';
import { authenticate, AuthRequest, requireWrite } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/audits', async (req: AuthRequest, res: Response): Promise<void> => {
  const audits = await prisma.seoAudit.findMany({
    where: { workspaceId: req.workspaceId },
    include: { issues: true },
    orderBy: { auditedAt: 'desc' },
    take: 50,
  });
  res.json(audits);
});

router.post('/audit', requireWrite, async (req: AuthRequest, res: Response): Promise<void> => {
  const { url } = req.body;
  if (!url) {
    res.status(400).json({ error: 'URL là bắt buộc' });
    return;
  }

  const maxPerDay = parseInt(process.env.MAX_SEO_AUDITS_PER_DAY || '20', 10);
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const todayCount = await prisma.seoAudit.count({
    where: { auditedAt: { gte: startOfDay }, workspaceId: req.workspaceId },
  });
  if (todayCount >= maxPerDay) {
    res.status(429).json({
      error: `Đã đạt giới hạn ${maxPerDay} lần audit/ngày (SRS OI-01). Thử lại ngày mai.`,
    });
    return;
  }

  const result = await runSeoAudit(url);
  const audit = await prisma.seoAudit.create({
    data: {
      url,
      score: result.score,
      technicalScore: result.technicalScore,
      contentScore: result.contentScore,
      uxScore: result.uxScore,
      issues: { create: result.issues },
      workspaceId: req.workspaceId,
    },
    include: { issues: true },
  });
  res.status(201).json(audit);
});

router.post('/pagespeed', requireWrite, async (req: AuthRequest, res: Response): Promise<void> => {
  const { url } = req.body;
  if (!url) {
    res.status(400).json({ error: 'URL là bắt buộc' });
    return;
  }

  try {
    const result = await runPageSpeedAudit(url);
    const audit = await prisma.seoAudit.create({
      data: {
        url,
        score: result.score,
        technicalScore: result.technicalScore,
        contentScore: result.contentScore,
        uxScore: result.uxScore,
        issues: { create: result.issues },
        workspaceId: req.workspaceId,
      },
      include: { issues: true },
    });
    res.status(201).json(audit);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'PageSpeed Audit thất bại' });
  }
});

router.get('/history', async (req: AuthRequest, res: Response): Promise<void> => {
  const url = (req.query.url as string)?.trim();
  if (!url) {
    res.status(400).json({ error: 'Tham số url là bắt buộc' });
    return;
  }
  const audits = await prisma.seoAudit.findMany({
    where: { url, workspaceId: req.workspaceId },
    include: { issues: true },
    orderBy: { auditedAt: 'asc' },
    take: 20,
  });
  res.json(audits);
});

router.get('/audits/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params.id as string);
  const audit = await prisma.seoAudit.findFirst({
    where: { id, workspaceId: req.workspaceId },
    include: { issues: true },
  });
  if (!audit) {
    res.status(404).json({ error: 'Không tìm thấy audit' });
    return;
  }
  res.json(audit);
});

export default router;
