import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest, requireWrite } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/groups', async (_req: AuthRequest, res: Response): Promise<void> => {
  const groups = await prisma.keywordGroup.findMany({
    include: { _count: { select: { keywords: true } } },
    orderBy: { name: 'asc' },
  });
  res.json(groups);
});

router.post('/groups', requireWrite, async (req: AuthRequest, res: Response): Promise<void> => {
  const { name } = req.body;
  if (!name) {
    res.status(400).json({ error: 'Tên nhóm là bắt buộc' });
    return;
  }
  const group = await prisma.keywordGroup.create({ data: { name } });
  res.status(201).json(group);
});

router.get('/', async (_req: AuthRequest, res: Response): Promise<void> => {
  const keywords = await prisma.seoKeyword.findMany({
    include: { channel: true, group: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json(keywords);
});

router.get('/:id/history', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params.id as string);
  const history = await prisma.keywordRankHistory.findMany({
    where: { keywordId: id },
    orderBy: { recordedAt: 'desc' },
    take: 90,
  });
  res.json(history);
});

router.post('/', requireWrite, async (req: AuthRequest, res: Response): Promise<void> => {
  const { keyword, url, currentPosition, searchVolume, channelId, groupId } = req.body;

  if (!keyword) {
    res.status(400).json({ error: 'Từ khóa là bắt buộc' });
    return;
  }

  const seoKeyword = await prisma.seoKeyword.create({
    data: {
      keyword,
      url,
      currentPosition: currentPosition ? parseInt(currentPosition) : null,
      searchVolume: searchVolume ? parseInt(searchVolume) : null,
      channelId: channelId ? parseInt(channelId) : null,
      groupId: groupId ? parseInt(groupId) : null,
    },
    include: { channel: true, group: true },
  });

  if (seoKeyword.currentPosition != null) {
    await prisma.keywordRankHistory.create({
      data: {
        keywordId: seoKeyword.id,
        position: seoKeyword.currentPosition,
        source: 'manual',
      },
    });
  }

  res.status(201).json(seoKeyword);
});

router.patch('/:id', requireWrite, async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params.id as string);
  const { currentPosition, ...rest } = req.body;

  const seoKeyword = await prisma.seoKeyword.update({
    where: { id },
    data: {
      ...rest,
      currentPosition: currentPosition != null ? parseInt(currentPosition) : undefined,
      channelId: rest.channelId != null ? parseInt(rest.channelId) : undefined,
      groupId: rest.groupId != null ? parseInt(rest.groupId) : undefined,
    },
    include: { channel: true, group: true },
  });

  if (currentPosition != null) {
    await prisma.keywordRankHistory.create({
      data: {
        keywordId: id,
        position: parseInt(currentPosition),
        source: 'manual',
      },
    });
  }

  res.json(seoKeyword);
});

router.delete('/:id', requireWrite, async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params.id as string);
  await prisma.seoKeyword.delete({ where: { id } });
  res.status(204).send();
});

export default router;
