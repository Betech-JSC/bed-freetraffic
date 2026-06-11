"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_1 = require("../middleware/auth");
const workspace_1 = require("../middleware/workspace");
const rbacMiddleware_1 = require("../middleware/rbacMiddleware");
const auditLogger_1 = require("../lib/auditLogger");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
// Get list of workspaces the user has access to
router.get('/', async (req, res) => {
    try {
        const userId = req.user.userId;
        // Check if user exists in the database
        const userExists = await prisma_1.default.user.findUnique({ where: { id: userId } });
        if (!userExists) {
            res.status(401).json({ error: 'Tài khoản không tồn tại. Vui lòng đăng nhập lại.' });
            return;
        }
        const userWorkspaces = await prisma_1.default.userWorkspace.findMany({
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
    }
    catch (error) {
        console.error('[GET /workspaces] Error:', error);
        res.status(500).json({ error: 'Lỗi máy chủ' });
    }
});
// Get current workspace info
router.get('/current', workspace_1.workspaceMiddleware, async (req, res) => {
    try {
        if (!req.workspaceId) {
            res.status(400).json({ error: 'Không xác định được Workspace' });
            return;
        }
        const workspaceId = req.workspaceId;
        const workspace = await prisma_1.default.workspace.findUnique({
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
    }
    catch (error) {
        console.error('[GET /workspaces/current] Error:', error);
        res.status(500).json({ error: 'Lỗi máy chủ' });
    }
});
// Get workspace audit logs (OWNER & MEMBER only)
router.get('/current/audit-logs', workspace_1.workspaceMiddleware, (0, rbacMiddleware_1.requireWorkspaceRole)(['OWNER', 'MEMBER']), async (req, res) => {
    try {
        const workspaceId = req.workspaceId;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const action = req.query.action;
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
        const queryParams = [workspaceId];
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
            prisma_1.default.$queryRawUnsafe(logsQuery, ...logsParams),
            prisma_1.default.$queryRawUnsafe(countQuery, ...queryParams)
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
    }
    catch (error) {
        console.error('[GET /workspaces/current/audit-logs] Error:', error);
        res.status(500).json({ error: 'Lỗi máy chủ khi lấy audit logs' });
    }
});
// Create a new workspace
router.post('/', async (req, res) => {
    try {
        const { name } = req.body;
        if (!name?.trim()) {
            res.status(400).json({ error: 'Tên Workspace là bắt buộc' });
            return;
        }
        const userId = req.user.userId;
        const workspace = await prisma_1.default.workspace.create({
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
        await (0, auditLogger_1.logActivity)({
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
    }
    catch (error) {
        console.error('[POST /workspaces] Error:', error);
        res.status(500).json({ error: 'Lỗi máy chủ' });
    }
});
exports.default = router;
