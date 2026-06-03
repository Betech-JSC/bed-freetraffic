import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma';
import { AuthRequest, authenticate, requireAdmin } from '../middleware/auth';
import { Role } from '@prisma/client';

const router = Router();
router.use(authenticate);
router.use(requireAdmin);

router.get('/', async (_req: AuthRequest, res: Response): Promise<void> => {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json(users);
});

router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const { email, password, name, role } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: 'Email và mật khẩu là bắt buộc' });
    return;
  }
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    res.status(400).json({ error: 'Email đã tồn tại' });
    return;
  }
  const user = await prisma.user.create({
    data: {
      email,
      password: await bcrypt.hash(password, 10),
      name: name || null,
      role: (role as Role) || Role.EDITOR,
    },
    select: { id: true, email: true, name: true, role: true, isActive: true },
  });
  res.status(201).json(user);
});

router.patch('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params.id as string);
  const { name, role, isActive, password } = req.body;
  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = name;
  if (role !== undefined) data.role = role;
  if (isActive !== undefined) data.isActive = !!isActive;
  if (password) data.password = await bcrypt.hash(password, 10);

  const user = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, email: true, name: true, role: true, isActive: true },
  });
  res.json(user);
});

router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params.id as string);
  if (req.user?.userId === id) {
    res.status(400).json({ error: 'Không thể xóa tài khoản đang đăng nhập' });
    return;
  }
  await prisma.user.delete({ where: { id } });
  res.status(204).send();
});

export default router;
