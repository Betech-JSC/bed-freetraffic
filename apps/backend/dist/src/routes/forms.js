"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Get list of forms
router.get('/', auth_1.authenticate, async (req, res) => {
    try {
        const forms = await prisma_1.default.customForm.findMany({
            where: { workspaceId: req.workspaceId },
            include: { landingPage: { select: { title: true, slug: true } } },
            orderBy: { createdAt: 'desc' },
        });
        res.json(forms);
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Lỗi lấy danh sách form' });
    }
});
// Get single form details
router.get('/:id', auth_1.authenticate, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const form = await prisma_1.default.customForm.findFirst({
            where: { id, workspaceId: req.workspaceId },
            include: { landingPage: true },
        });
        if (!form) {
            res.status(404).json({ error: 'Không tìm thấy form' });
            return;
        }
        res.json(form);
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Lỗi lấy chi tiết form' });
    }
});
// Get submissions for a form
router.get('/:id/submissions', auth_1.authenticate, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const form = await prisma_1.default.customForm.findFirst({
            where: { id, workspaceId: req.workspaceId },
        });
        if (!form) {
            res.status(404).json({ error: 'Không tìm thấy form để xem dữ liệu' });
            return;
        }
        const submissions = await prisma_1.default.formSubmission.findMany({
            where: { formId: id, workspaceId: req.workspaceId },
            orderBy: { createdAt: 'desc' },
        });
        res.json(submissions);
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Lỗi lấy danh sách đăng ký form' });
    }
});
// Create new form
router.post('/', auth_1.authenticate, auth_1.requireWrite, async (req, res) => {
    try {
        const { name, fieldsJson, landingPageId } = req.body;
        if (!name || !fieldsJson) {
            res.status(400).json({ error: 'Tên form và cấu trúc trường (fieldsJson) là bắt buộc.' });
            return;
        }
        // Parse fieldsJson to validate it is valid JSON
        try {
            JSON.parse(fieldsJson);
        }
        catch {
            res.status(400).json({ error: 'fieldsJson phải là một chuỗi JSON hợp lệ.' });
            return;
        }
        const form = await prisma_1.default.customForm.create({
            data: {
                name,
                fieldsJson,
                landingPageId: landingPageId ? parseInt(landingPageId) : null,
                workspaceId: req.workspaceId,
            },
        });
        res.status(201).json(form);
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Lỗi tạo form mới' });
    }
});
// Update form
router.put('/:id', auth_1.authenticate, auth_1.requireWrite, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { name, fieldsJson, landingPageId } = req.body;
        const existing = await prisma_1.default.customForm.findFirst({
            where: { id, workspaceId: req.workspaceId },
        });
        if (!existing) {
            res.status(404).json({ error: 'Không tìm thấy form để cập nhật' });
            return;
        }
        if (fieldsJson) {
            try {
                JSON.parse(fieldsJson);
            }
            catch {
                res.status(400).json({ error: 'fieldsJson phải là một chuỗi JSON hợp lệ.' });
                return;
            }
        }
        const updated = await prisma_1.default.customForm.update({
            where: { id },
            data: {
                name: name !== undefined ? name : existing.name,
                fieldsJson: fieldsJson !== undefined ? fieldsJson : existing.fieldsJson,
                landingPageId: landingPageId !== undefined ? (landingPageId ? parseInt(landingPageId) : null) : existing.landingPageId,
            },
        });
        res.json(updated);
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Lỗi cập nhật form' });
    }
});
// Delete form
router.delete('/:id', auth_1.authenticate, auth_1.requireWrite, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const existing = await prisma_1.default.customForm.findFirst({
            where: { id, workspaceId: req.workspaceId },
        });
        if (!existing) {
            res.status(404).json({ error: 'Không tìm thấy form để xóa' });
            return;
        }
        await prisma_1.default.customForm.delete({
            where: { id },
        });
        res.status(204).send();
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Lỗi xóa form' });
    }
});
exports.default = router;
