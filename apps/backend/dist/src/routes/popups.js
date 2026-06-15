"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
// 1. GET /popups - List all popups in workspace
router.get('/', async (req, res) => {
    try {
        const popups = await prisma_1.default.popupWidget.findMany({
            where: { workspaceId: req.workspaceId },
            orderBy: { createdAt: 'desc' },
        });
        res.json(popups);
    }
    catch (error) {
        console.error('[GET /popups]', error);
        res.status(500).json({ error: error.message || 'Lỗi lấy danh sách Popups' });
    }
});
// 2. POST /popups - Create a popup widget configuration
router.post('/', auth_1.requireWrite, async (req, res) => {
    const { name, type, delaySeconds, scrollDepth, title, description, buttonText, formFields, themeColor, isActive } = req.body;
    if (!name || !type || !title || !description) {
        res.status(400).json({ error: 'Tên, loại kích hoạt, tiêu đề và mô tả là bắt buộc' });
        return;
    }
    try {
        const popup = await prisma_1.default.popupWidget.create({
            data: {
                workspaceId: req.workspaceId,
                name,
                type,
                delaySeconds: delaySeconds != null ? parseInt(delaySeconds) : 5,
                scrollDepth: scrollDepth != null ? parseInt(scrollDepth) : 50,
                title,
                description,
                buttonText: buttonText || 'Đăng ký',
                formFields: formFields || 'email',
                themeColor: themeColor || '#e85d26',
                isActive: isActive !== false,
            }
        });
        res.status(201).json(popup);
    }
    catch (error) {
        console.error('[POST /popups]', error);
        res.status(500).json({ error: error.message || 'Lỗi tạo cấu hình popup' });
    }
});
// 3. PUT /popups/:id - Update popup widget configuration
router.put('/:id', auth_1.requireWrite, async (req, res) => {
    const id = parseInt(req.params.id);
    const { name, type, delaySeconds, scrollDepth, title, description, buttonText, formFields, themeColor, isActive } = req.body;
    try {
        const existing = await prisma_1.default.popupWidget.findFirst({
            where: { id, workspaceId: req.workspaceId }
        });
        if (!existing) {
            res.status(404).json({ error: 'Không tìm thấy popup hoặc bạn không có quyền' });
            return;
        }
        const updated = await prisma_1.default.popupWidget.update({
            where: { id },
            data: {
                name: name !== undefined ? name : existing.name,
                type: type !== undefined ? type : existing.type,
                delaySeconds: delaySeconds !== undefined ? parseInt(delaySeconds) : existing.delaySeconds,
                scrollDepth: scrollDepth !== undefined ? parseInt(scrollDepth) : existing.scrollDepth,
                title: title !== undefined ? title : existing.title,
                description: description !== undefined ? description : existing.description,
                buttonText: buttonText !== undefined ? buttonText : existing.buttonText,
                formFields: formFields !== undefined ? formFields : existing.formFields,
                themeColor: themeColor !== undefined ? themeColor : existing.themeColor,
                isActive: isActive !== undefined ? isActive : existing.isActive,
            }
        });
        res.json(updated);
    }
    catch (error) {
        console.error('[PUT /popups/:id]', error);
        res.status(500).json({ error: error.message || 'Lỗi cập nhật popup' });
    }
});
// 4. DELETE /popups/:id - Delete popup widget configuration
router.delete('/:id', auth_1.requireWrite, async (req, res) => {
    const id = parseInt(req.params.id);
    try {
        const existing = await prisma_1.default.popupWidget.findFirst({
            where: { id, workspaceId: req.workspaceId }
        });
        if (!existing) {
            res.status(404).json({ error: 'Không tìm thấy popup hoặc bạn không có quyền' });
            return;
        }
        await prisma_1.default.popupWidget.delete({ where: { id } });
        res.json({ success: true, message: 'Đã xóa popup thành công' });
    }
    catch (error) {
        console.error('[DELETE /popups/:id]', error);
        res.status(500).json({ error: error.message || 'Lỗi xóa popup' });
    }
});
exports.default = router;
