"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireWorkspaceRole = requireWorkspaceRole;
const prisma_1 = __importDefault(require("../lib/prisma"));
/**
 * Middleware yêu cầu vai trò tối thiểu của thành viên trong Workspace hiện tại
 * @param allowedRoles Danh sách vai trò được phép (ví dụ: ['OWNER', 'MEMBER'])
 */
function requireWorkspaceRole(allowedRoles) {
    return async (req, res, next) => {
        if (!req.user || !req.workspaceId) {
            res.status(401).json({ error: 'Chưa xác thực thông tin tài khoản hoặc Workspace' });
            return;
        }
        try {
            const userWs = await prisma_1.default.userWorkspace.findUnique({
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
        }
        catch (error) {
            console.error('[RBAC Middleware] Lỗi kiểm tra quyền:', error);
            res.status(500).json({ error: 'Lỗi kiểm tra phân quyền Workspace' });
        }
    };
}
