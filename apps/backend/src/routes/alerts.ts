import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest, requireWrite } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/rules', async (req: AuthRequest, res: Response): Promise<void> => {
  const rules = await prisma.alertRule.findMany({
    where: { workspaceId: req.workspaceId },
    include: { logs: { orderBy: { createdAt: 'desc' }, take: 5 } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(rules);
});

router.post('/rules', requireWrite, async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, metric, threshold, comparison, notifyEmail, enabled } = req.body;
  if (!name || metric == null || threshold == null) {
    res.status(400).json({ error: 'name, metric, threshold là bắt buộc' });
    return;
  }
  const rule = await prisma.alertRule.create({
    data: {
      name,
      metric,
      threshold: parseFloat(threshold),
      comparison: comparison || 'lt',
      notifyEmail,
      enabled: enabled !== false,
      workspaceId: req.workspaceId,
    },
  });
  res.status(201).json(rule);
});

router.patch('/rules/:id', requireWrite, async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params.id as string);
  const existing = await prisma.alertRule.findFirst({
    where: { id, workspaceId: req.workspaceId }
  });
  if (!existing) {
    res.status(404).json({ error: 'Không tìm thấy luật cảnh báo' });
    return;
  }
  const rule = await prisma.alertRule.update({ where: { id }, data: req.body });
  res.json(rule);
});

router.delete('/rules/:id', requireWrite, async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params.id as string);
  const existing = await prisma.alertRule.findFirst({
    where: { id, workspaceId: req.workspaceId }
  });
  if (!existing) {
    res.status(404).json({ error: 'Không tìm thấy luật cảnh báo' });
    return;
  }
  await prisma.alertRule.delete({ where: { id } });
  res.status(204).send();
});

router.get('/logs', async (req: AuthRequest, res: Response): Promise<void> => {
  const rules = await prisma.alertRule.findMany({
    where: { workspaceId: req.workspaceId },
    select: { id: true }
  });
  const ruleIds = rules.map((r) => r.id);
  const logs = ruleIds.length > 0
    ? await prisma.alertLog.findMany({
        where: { ruleId: { in: ruleIds } },
        include: { rule: { select: { name: true, metric: true } } },
        orderBy: { createdAt: 'desc' },
        take: 100,
      })
    : [];
  res.json(logs);
});

export default router;
