"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOrCreateDefaultWorkspace = getOrCreateDefaultWorkspace;
exports.workspaceMiddleware = workspaceMiddleware;
const prisma_1 = __importDefault(require("../lib/prisma"));
async function getOrCreateDefaultWorkspace(userId, email) {
    // Check if user is associated with any workspace
    const userWorkspace = await prisma_1.default.userWorkspace.findFirst({
        where: { userId },
        include: { workspace: true }
    });
    if (userWorkspace) {
        return userWorkspace.workspaceId;
    }
    // Create a new default workspace
    const workspaceName = `Workspace của ${email.split('@')[0]}`;
    const workspace = await prisma_1.default.workspace.create({
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
            const prismaTable = prisma_1.default[table];
            if (prismaTable) {
                await prismaTable.updateMany({
                    where: { workspaceId: null },
                    data: { workspaceId: workspace.id }
                });
            }
        }
        catch (err) {
            console.error(`[Workspace Migration] Error migrating table ${table}:`, err);
        }
    }
    return workspace.id;
}
async function workspaceMiddleware(req, res, next) {
    if (!req.user) {
        res.status(401).json({ error: 'Chưa đăng nhập' });
        return;
    }
    const userId = req.user.userId;
    const email = req.user.email;
    const headerWsId = req.headers['x-workspace-id'];
    try {
        // Check if user exists in the database to prevent foreign key errors with legacy tokens
        const userExists = await prisma_1.default.user.findUnique({ where: { id: userId } });
        if (!userExists) {
            res.status(401).json({ error: 'Tài khoản không tồn tại trong hệ thống. Vui lòng đăng nhập lại.' });
            return;
        }
        if (headerWsId) {
            const parsedId = parseInt(headerWsId, 10);
            if (!isNaN(parsedId)) {
                // Nếu là ADMIN, cho phép truy cập bất kỳ workspace nào mà không cần thuộc workspace đó
                if (req.user.role === 'ADMIN') {
                    req.workspaceId = parsedId;
                    next();
                    return;
                }
                // Verify user belongs to this workspace
                const hasAccess = await prisma_1.default.userWorkspace.findUnique({
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
    }
    catch (error) {
        console.error('[Workspace Middleware] Error:', error);
        res.status(500).json({ error: 'Lỗi hệ thống xác thực Workspace' });
    }
}
