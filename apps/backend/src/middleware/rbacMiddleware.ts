import { Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { WorkspaceRequest } from './workspace';

/**
 * Middleware yêu cầu vai trò tối thiểu của thành viên trong Workspace hiện tại
 * @param allowedRoles Danh sách vai trò được phép (ví dụ: ['OWNER', 'MEMBER'])
 */
export function requireWorkspaceRole(allowedRoles: string[]) {
  return async (req: WorkspaceRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user || !req.workspaceId) {
      res.status(401).json({ error: 'Chưa xác thực thông tin tài khoản hoặc Workspace' });
      return;
    }

    try {
      const userWs = await prisma.userWorkspace.findUnique({
        where: {
          userId_workspaceId: {
            userId: req.user.userId,
            workspaceId: req.workspaceId
          }
        }
      });

      if (!userWs) {
        res.status(403).json({ error: 'Bạn không thuộc Workspace này' });
        return;
      }

      if (!allowedRoles.includes(userWs.role)) {
        res.status(403).json({ error: 'Bạn không có quyền thực hiện hành động này với vai trò hiện tại' });
        return;
      }

      next();
    } catch (error) {
      console.error('[RBAC Middleware] Lỗi kiểm tra quyền:', error);
      res.status(500).json({ error: 'Lỗi kiểm tra phân quyền Workspace' });
    }
  };
}
