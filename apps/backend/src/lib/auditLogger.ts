import prisma from './prisma';

interface LogActivityParams {
  userId: number;
  workspaceId: number;
  action: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  details?: any;
}

/**
 * Ghi nhận một hành động của người dùng vào bảng AuditLog thông qua raw SQL query
 */
export async function logActivity(params: LogActivityParams): Promise<void> {
  try {
    const detailsStr = params.details ? JSON.stringify(params.details) : null;
    
    await prisma.$executeRawUnsafe(
      `INSERT INTO "AuditLog" ("userId", "workspaceId", "action", "ipAddress", "userAgent", "details", "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      params.userId,
      params.workspaceId,
      params.action,
      params.ipAddress || null,
      params.userAgent || null,
      detailsStr,
      new Date()
    );
  } catch (err) {
    console.error('[AuditLogger] Lỗi lưu audit log:', err);
  }
}
