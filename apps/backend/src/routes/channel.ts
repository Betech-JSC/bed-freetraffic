import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest, requireWrite } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', async (_req: AuthRequest, res: Response): Promise<void> => {
  const channels = await prisma.channel.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(channels);
});

router.post('/', requireWrite, async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, type, url, apiConfig, connectionStatus } = req.body;

  if (!name || !type) {
    res.status(400).json({ error: 'Tên và loại kênh là bắt buộc' });
    return;
  }

  const channel = await prisma.channel.create({
    data: {
      name,
      type,
      url,
      status: 'ACTIVE',
      apiConfig: apiConfig ? JSON.stringify(apiConfig) : null,
      connectionStatus: connectionStatus || 'DISCONNECTED',
    },
  });

  res.status(201).json(channel);
});

router.put('/:id', requireWrite, async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params.id as string);
  const { name, type, url, status, apiConfig, connectionStatus } = req.body;

  const channel = await prisma.channel.update({
    where: { id },
    data: {
      name,
      type,
      url,
      status,
      connectionStatus,
      apiConfig: apiConfig != null ? JSON.stringify(apiConfig) : undefined,
    },
  });

  res.json(channel);
});

router.post('/:id/test', requireWrite, async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params.id as string);
  const channel = await prisma.channel.findUnique({ where: { id } });
  if (!channel) {
    res.status(404).json({ error: 'Không tìm thấy kênh' });
    return;
  }

  const connected = channel.connectionStatus === 'CONNECTED' || !!channel.apiConfig;
  await prisma.channel.update({
    where: { id },
    data: { connectionStatus: connected ? 'CONNECTED' : 'ERROR' },
  });

  res.json({
    ok: connected,
    message: connected ? 'Kết nối ổn định' : 'Chưa cấu hình API — cập nhật apiConfig trong kênh',
  });
});

router.delete('/:id', requireWrite, async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params.id as string);
  await prisma.channel.delete({ where: { id } });
  res.status(204).send();
});

export default router;
