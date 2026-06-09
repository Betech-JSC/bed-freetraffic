"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_1 = require("../middleware/auth");
const workspace_1 = require("../middleware/workspace");
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
