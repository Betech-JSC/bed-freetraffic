import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { workspaceMiddleware, WorkspaceRequest } from '../middleware/workspace';

const router = Router();
router.use(authenticate);

// Get list of workspaces the user has access to
router.get('/', async (req: WorkspaceRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    
    // Check if user exists in the database
    const userExists = await prisma.user.findUnique({ where: { id: userId } });
    if (!userExists) {
      res.status(401).json({ error: 'Tài khoản không tồn tại. Vui lòng đăng nhập lại.' });
      return;
    }

    const userWorkspaces = await prisma.userWorkspace.findMany({
      where: { userId },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            createdAt: true
          }
        }
      }
    });

    const workspaces = userWorkspaces.map(uw => ({
      id: uw.workspace.id,
      name: uw.workspace.name,
      role: uw.role,
      createdAt: uw.workspace.createdAt
    }));

    res.json(workspaces);
  } catch (error) {
    console.error('[GET /workspaces] Error:', error);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

// Get current workspace info
router.get('/current', workspaceMiddleware, async (req: WorkspaceRequest, res: Response): Promise<void> => {
  try {
    if (!req.workspaceId) {
      res.status(400).json({ error: 'Không xác định được Workspace' });
      return;
    }
    const workspaceId = req.workspaceId;
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        users: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
                role: true
              }
            }
          }
        }
      }
    });

    if (!workspace) {
      res.status(404).json({ error: 'Không tìm thấy Workspace' });
      return;
    }

    res.json({
      id: workspace.id,
      name: workspace.name,
      createdAt: workspace.createdAt,
      members: workspace.users.map(u => ({
        id: u.user.id,
        email: u.user.email,
        name: u.user.name,
        role: u.role
      }))
    });
  } catch (error) {
    console.error('[GET /workspaces/current] Error:', error);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

// Create a new workspace
router.post('/', async (req: WorkspaceRequest, res: Response): Promise<void> => {
  try {
    const { name } = req.body;
    if (!name?.trim()) {
      res.status(400).json({ error: 'Tên Workspace là bắt buộc' });
      return;
    }

    const userId = req.user!.userId;
    const workspace = await prisma.workspace.create({
      data: {
        name: name.trim(),
        users: {
          create: {
            userId,
            role: 'OWNER'
          }
        }
      }
    });

    res.status(201).json({
      id: workspace.id,
      name: workspace.name,
      role: 'OWNER',
      createdAt: workspace.createdAt
    });
  } catch (error) {
    console.error('[POST /workspaces] Error:', error);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

export default router;
