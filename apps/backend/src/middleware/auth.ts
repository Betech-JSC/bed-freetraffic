import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-free-traffic-key';

export interface AuthPayload {
  userId: number;
  email: string;
  role: Role;
  name?: string;
}

export interface AuthRequest extends Request {
  user?: AuthPayload;
  workspaceId?: number;
}

function readToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  const cookie = req.headers.cookie;
  if (cookie) {
    const match = cookie.match(/(?:^|;\s*)token=([^;]+)/);
    if (match) return decodeURIComponent(match[1]);
  }
  return null;
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
  const token = readToken(req);

  if (!token) {
    res.status(401).json({ error: 'Chưa đăng nhập hoặc token hết hạn' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload;
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Token không hợp lệ' });
  }
}

export function requireRoles(...roles: Role[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Chưa đăng nhập' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Không có quyền thực hiện thao tác này' });
      return;
    }
    next();
  };
}

export function requireWrite(req: AuthRequest, res: Response, next: NextFunction): void {
  return requireRoles(Role.ADMIN, Role.EDITOR)(req, res, next);
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  return requireRoles(Role.ADMIN)(req, res, next);
}
