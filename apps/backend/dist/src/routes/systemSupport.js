"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_1 = require("../middleware/auth");
const cskhService_1 = require("../services/cskhService");
const router = (0, express_1.Router)();
// Endpoint gửi tin nhắn cho Trợ lý Be Traffic AI và nhận câu trả lời RAG
router.post('/message', auth_1.authenticate, async (req, res) => {
    try {
        const { message, sessionId } = req.body;
        if (!message || !message.trim()) {
            res.status(400).json({ error: 'Nội dung tin nhắn không được rỗng.' });
            return;
        }
        // 1. Xác định Workspace ID quản trị hệ thống (Workspace đầu tiên trong DB) làm kho tri thức support
        let supportWorkspaceId = 1;
        const firstWs = await prisma_1.default.workspace.findFirst({
            orderBy: { id: 'asc' }
        });
        if (firstWs) {
            supportWorkspaceId = firstWs.id;
        }
        // 2. Gọi hàm xử lý tin nhắn hỗ trợ sử dụng tri thức RAG hệ thống
        console.log(`[Support Widget AI] Nhận tin nhắn hỗ trợ từ user ID ${req.user.userId}: "${message}"`);
        const result = await (0, cskhService_1.handleVisitorMessage)(supportWorkspaceId, sessionId ? String(sessionId) : undefined, message.trim(), req.ip ? String(req.ip) : undefined, req.headers['user-agent'] ? String(req.headers['user-agent']) : undefined);
        // 3. Trả về câu trả lời và Session ID để lưu lịch sử
        res.json({
            success: true,
            sessionId: result.sessionId,
            reply: result.reply,
        });
    }
    catch (err) {
        console.error('[Support Widget AI Error] Lỗi xử lý tin nhắn support:', err);
        res.status(500).json({
            error: 'Hệ thống hỗ trợ tạm thời gián đoạn. Trợ lý AI sẽ phản hồi lại bạn sau ít phút.',
            reply: 'Xin lỗi bạn, tôi đang gặp lỗi kết nối với máy chủ AI của Be Traffic. Bạn hãy thử lại sau vài giây nhé!'
        });
    }
});
// Endpoint lấy lịch sử tin nhắn hỗ trợ của phiên hiện tại
router.get('/history/:sessionId', auth_1.authenticate, async (req, res) => {
    try {
        const { sessionId } = req.params;
        // Tìm session xem có tồn tại trong hệ thống không
        const sessionExists = await prisma_1.default.chatSession.findUnique({
            where: { id: String(sessionId) },
        });
        if (!sessionExists) {
            res.json([]);
            return;
        }
        const messages = await prisma_1.default.chatMessage.findMany({
            where: { sessionId: String(sessionId) },
            orderBy: { createdAt: 'asc' },
        });
        res.json(messages);
    }
    catch (err) {
        res.status(500).json({ error: err.message || 'Lỗi lấy lịch sử chat hỗ trợ' });
    }
});
exports.default = router;
