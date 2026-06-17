import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { workspaceMiddleware, WorkspaceRequest } from '../middleware/workspace';
import { requireWorkspaceRole } from '../middleware/rbacMiddleware';
import { logActivity } from '../lib/auditLogger';

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
      companyName: workspace.companyName,
      websiteUrl: workspace.websiteUrl,
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

// Get workspace audit logs (OWNER & MEMBER only)
router.get(
  '/current/audit-logs',
  workspaceMiddleware,
  requireWorkspaceRole(['OWNER', 'MEMBER']),
  async (req: WorkspaceRequest, res: Response): Promise<void> => {
    try {
      const workspaceId = req.workspaceId!;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const action = req.query.action as string;
      const offset = (page - 1) * limit;

      let logsQuery = `
        SELECT a.*, u.email as "userEmail", u.name as "userName"
        FROM "AuditLog" a
        JOIN "User" u ON a."userId" = u.id
        WHERE a."workspaceId" = $1
      `;
      let countQuery = `
        SELECT COUNT(*)::integer as count
        FROM "AuditLog"
        WHERE "workspaceId" = $1
      `;
      
      const queryParams: any[] = [workspaceId];
      let paramIndex = 2;

      if (action && action.trim() !== '') {
        logsQuery += ` AND a.action = $${paramIndex}`;
        countQuery += ` AND action = $${paramIndex}`;
        queryParams.push(action.trim());
        paramIndex++;
      }

      logsQuery += ` ORDER BY a."createdAt" DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      
      const logsParams = [...queryParams, limit, offset];
      
      const [logs, countResult] = await Promise.all([
        prisma.$queryRawUnsafe<any[]>(logsQuery, ...logsParams),
        prisma.$queryRawUnsafe<any[]>(countQuery, ...queryParams)
      ]);

      const total = countResult?.[0]?.count || 0;

      res.json({
        logs,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('[GET /workspaces/current/audit-logs] Error:', error);
      res.status(500).json({ error: 'Lỗi máy chủ khi lấy audit logs' });
    }
  }
);

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

    // Ghi audit log
    await logActivity({
      userId,
      workspaceId: workspace.id,
      action: 'CREATE_WORKSPACE',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: { workspaceName: workspace.name }
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

// Update current workspace settings
router.patch(
  '/current',
  workspaceMiddleware,
  requireWorkspaceRole(['OWNER']),
  async (req: WorkspaceRequest, res: Response): Promise<void> => {
    try {
      const workspaceId = req.workspaceId!;
      const { name, companyName, websiteUrl } = req.body;

      const updateData: any = {};
      if (name !== undefined) updateData.name = name.trim();
      if (companyName !== undefined) updateData.companyName = companyName.trim();
      if (websiteUrl !== undefined) updateData.websiteUrl = websiteUrl.trim() || null;

      if (Object.keys(updateData).length === 0) {
        res.status(400).json({ error: 'Không có thông tin thay đổi' });
        return;
      }

      const updated = await prisma.workspace.update({
        where: { id: workspaceId },
        data: updateData
      });

      // Ghi audit log
      await logActivity({
        userId: req.user!.userId,
        workspaceId,
        action: 'UPDATE_WORKSPACE_SETTINGS',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        details: updateData
      });

      res.json({
        id: updated.id,
        name: updated.name,
        companyName: updated.companyName,
        websiteUrl: updated.websiteUrl
      });
    } catch (error: any) {
      console.error('[PATCH /workspaces/current] Error:', error);
      res.status(500).json({ error: error.message || 'Lỗi cập nhật cấu hình Workspace' });
    }
  }
);

export default router;
