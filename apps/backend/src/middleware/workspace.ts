import { Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from './auth';

export interface WorkspaceRequest extends AuthRequest {
  workspaceId?: number;
}

export async function getOrCreateDefaultWorkspace(userId: number, email: string): Promise<number> {
  // Check if user is associated with any workspace
  const userWorkspace = await prisma.userWorkspace.findFirst({
    where: { userId },
    include: { workspace: true }
  });

  if (userWorkspace) {
    return userWorkspace.workspaceId;
  }

  // Create a new default workspace
  const workspaceName = `Workspace của ${email.split('@')[0]}`;
  const workspace = await prisma.workspace.create({
    data: {
      name: workspaceName,
      users: {
        create: {
          userId,
          role: 'OWNER'
        }
      }
    }
  });

  // Migrate existing data (where workspaceId is null) to this default workspace
  const tables = [
    'channel',
    'keywordGroup',
    'seoKeyword',
    'googleIntegration',
    'automationTask',
    'postTemplate',
    'contentSchedule',
    'seoAudit',
    'backlink',
    'emailCampaign',
    'customer',
    'alertRule',
    'abTest',
    'socialConnection',
    'analyticsSnapshot'
  ];

  for (const table of tables) {
    try {
      const prismaTable = (prisma as any)[table];
      if (prismaTable) {
        await prismaTable.updateMany({
          where: { workspaceId: null },
          data: { workspaceId: workspace.id }
        });
      }
    } catch (err) {
      console.error(`[Workspace Migration] Error migrating table ${table}:`, err);
    }
  }

  return workspace.id;
}

export async function workspaceMiddleware(
  req: WorkspaceRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Chưa đăng nhập' });
    return;
  }

  const userId = req.user.userId;
  const email = req.user.email;

  const headerWsId = req.headers['x-workspace-id'];
  
  try {
    if (headerWsId) {
      const parsedId = parseInt(headerWsId as string, 10);
      if (!isNaN(parsedId)) {
        // Verify user belongs to this workspace
        const hasAccess = await prisma.userWorkspace.findUnique({
          where: {
            userId_workspaceId: {
              userId,
              workspaceId: parsedId
            }
          }
        });

        if (hasAccess) {
          req.workspaceId = parsedId;
          next();
          return;
        }
      }
    }

    // Default or fallback
    const workspaceId = await getOrCreateDefaultWorkspace(userId, email);
    req.workspaceId = workspaceId;
    next();
  } catch (error) {
    console.error('[Workspace Middleware] Error:', error);
    res.status(500).json({ error: 'Lỗi hệ thống xác thực Workspace' });
  }
}
