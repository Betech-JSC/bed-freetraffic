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

router.use(authenticate);

router.get('/running', async (_req: AuthRequest, res: Response): Promise<void> => {
  const tests = await prisma.abTest.findMany({
    where: { status: 'RUNNING' },
    select: { id: true, name: true, templateAId: true, templateBId: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json(tests);
});

router.get('/', async (_req: AuthRequest, res: Response): Promise<void> => {
  const tests = await prisma.abTest.findMany({
    include: { templateA: true, templateB: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json(tests);
});

router.post('/', requireWrite, async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, templateAId, templateBId } = req.body;
  if (!name) {
    res.status(400).json({ error: 'name là bắt buộc' });
    return;
  }
  const test = await prisma.abTest.create({
    data: {
      name,
      templateAId: templateAId ? parseInt(templateAId) : null,
      templateBId: templateBId ? parseInt(templateBId) : null,
      status: 'RUNNING',
    },
    include: { templateA: true, templateB: true },
  });
  res.status(201).json(test);
});

router.post('/:id/impression', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params.id as string);
  const variant = (req.body.variant as string) || 'A';
  const test = await prisma.abTest.findUnique({ where: { id } });
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
  const test = await prisma.abTest.findUnique({ where: { id } });
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
  const test = await prisma.abTest.findUnique({ where: { id } });
  if (!test) {
    res.status(404).json({ error: 'Không tìm thấy' });
    return;
  }
  const scoreA =
    test.impressionsA > 0 ? test.clicksA / test.impressionsA : 0;
  const scoreB =
    test.impressionsB > 0 ? test.clicksB / test.impressionsB : 0;
  let winner: string;
  if (test.clicksA + test.clicksB > 0) {
    winner = scoreA > scoreB ? 'A' : scoreB > scoreA ? 'B' : 'tie';
  } else {
    winner =
      test.impressionsA > test.impressionsB
        ? 'A'
        : test.impressionsB > test.impressionsA
          ? 'B'
          : 'tie';
  }
  const updated = await prisma.abTest.update({
    where: { id },
    data: { status: 'COMPLETED', winner },
  });
  res.json(updated);
});

router.delete('/:id', requireWrite, async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params.id as string);
  await prisma.abTest.delete({ where: { id } });
  res.status(204).send();
});

export default router;
