import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest, requireWrite } from '../middleware/auth';

const router = Router();

router.get('/track/click/:id', async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  const variant = (req.query.variant as string) === 'B' ? 'B' : 'A';
  const target = (req.query.url as string) || '/';

  try {
    const test = await prisma.abTest.findUnique({ where: { id } });
    if (test?.status === 'RUNNING') {
      await prisma.abTest.update({
        where: { id },
        data: variant === 'B' ? { clicksB: { increment: 1 } } : { clicksA: { increment: 1 } },
      });
    }
  } catch {
    /* ignore */
  }

  res.redirect(target);
});

import { workspaceMiddleware } from '../middleware/workspace';

router.use(authenticate, workspaceMiddleware);

router.get('/running', async (req: AuthRequest, res: Response): Promise<void> => {
  const tests = await prisma.abTest.findMany({
    where: { status: 'RUNNING', workspaceId: req.workspaceId },
    select: { id: true, name: true, templateAId: true, templateBId: true, landingPageAId: true, landingPageBId: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json(tests);
});

router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const tests = await prisma.abTest.findMany({
    where: { workspaceId: req.workspaceId },
    include: { templateA: true, templateB: true, landingPageA: true, landingPageB: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json(tests);
});

router.post('/', requireWrite, async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, templateAId, templateBId, landingPageAId, landingPageBId } = req.body;
  if (!name) {
    res.status(400).json({ error: 'name là bắt buộc' });
    return;
  }
  const test = await prisma.abTest.create({
    data: {
      name,
      templateAId: templateAId ? parseInt(templateAId) : null,
      templateBId: templateBId ? parseInt(templateBId) : null,
      landingPageAId: landingPageAId ? parseInt(landingPageAId) : null,
      landingPageBId: landingPageBId ? parseInt(landingPageBId) : null,
      status: 'RUNNING',
      workspaceId: req.workspaceId,
    },
    include: { templateA: true, templateB: true, landingPageA: true, landingPageB: true },
  });
  res.status(201).json(test);
});

router.post('/:id/impression', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params.id as string);
  const variant = (req.body.variant as string) || 'A';
  const test = await prisma.abTest.findFirst({
    where: { id, workspaceId: req.workspaceId }
  });
  if (!test || test.status !== 'RUNNING') {
    res.status(400).json({ error: 'Test không hợp lệ' });
    return;
  }
  const updated = await prisma.abTest.update({
    where: { id },
    data: variant === 'B' ? { impressionsB: { increment: 1 } } : { impressionsA: { increment: 1 } },
  });
  res.json(updated);
});

router.post('/:id/click', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params.id as string);
  const variant = (req.body.variant as string) || 'A';
  const test = await prisma.abTest.findFirst({
    where: { id, workspaceId: req.workspaceId }
  });
  if (!test || test.status !== 'RUNNING') {
    res.status(400).json({ error: 'Test không hợp lệ' });
    return;
  }
  const updated = await prisma.abTest.update({
    where: { id },
    data: variant === 'B' ? { clicksB: { increment: 1 } } : { clicksA: { increment: 1 } },
  });
  res.json(updated);
});

router.post('/:id/complete', requireWrite, async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params.id as string);
  const test = await prisma.abTest.findFirst({
    where: { id, workspaceId: req.workspaceId }
  });
  if (!test) {
    res.status(404).json({ error: 'Không tìm thấy' });
    return;
  }

  const clicksA = test.clicksA;
  const clicksB = test.clicksB;
  const impressionsA = test.impressionsA;
  const impressionsB = test.impressionsB;

  const scoreA = impressionsA > 0 ? clicksA / impressionsA : 0;
  const scoreB = impressionsB > 0 ? clicksB / impressionsB : 0;

  const totalConversions = clicksA + clicksB;
  const totalImpressions = impressionsA + impressionsB;
  const totalNonConversions = totalImpressions - totalConversions;

  let isSignificant = false;
  let chiSquare = 0;

  if (impressionsA > 0 && impressionsB > 0 && totalConversions > 0 && totalNonConversions > 0) {
    const o11 = clicksA;
    const o12 = impressionsA - clicksA;
    const o21 = clicksB;
    const o22 = impressionsB - clicksB;
    
    const numerator = totalImpressions * Math.pow(o11 * o22 - o12 * o21, 2);
    const denominator = impressionsA * impressionsB * totalConversions * totalNonConversions;
    
    if (denominator > 0) {
      chiSquare = numerator / denominator;
      // Critical value for alpha = 0.05 (df = 1) is 3.841
      if (chiSquare > 3.841) {
        isSignificant = true;
      }
    }
  }

  let winner: string;
  if (isSignificant) {
    winner = scoreA > scoreB ? 'A' : 'B';
  } else {
    winner = 'tie';
  }

  const updated = await prisma.abTest.update({
    where: { id },
    data: { status: 'COMPLETED', winner },
  });
  res.json(updated);
});

router.delete('/:id', requireWrite, async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params.id as string);
  const existing = await prisma.abTest.findFirst({
    where: { id, workspaceId: req.workspaceId }
  });
  if (!existing) {
    res.status(404).json({ error: 'Không tìm thấy test A/B' });
    return;
  }
  await prisma.abTest.delete({ where: { id } });
  res.status(204).send();
});

export default router;
