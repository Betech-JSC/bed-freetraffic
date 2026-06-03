"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_1 = require("../middleware/auth");
const client_1 = require("@prisma/client");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
router.use(auth_1.requireAdmin);
router.get('/', async (_req, res) => {
    const users = await prisma_1.default.user.findMany({
        select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
    });
    res.json(users);
});
router.post('/', async (req, res) => {
    const { email, password, name, role } = req.body;
    if (!email || !password) {
        res.status(400).json({ error: 'Email và mật khẩu là bắt buộc' });
        return;
    }
    const exists = await prisma_1.default.user.findUnique({ where: { email } });
    if (exists) {
        res.status(400).json({ error: 'Email đã tồn tại' });
        return;
    }
    const user = await prisma_1.default.user.create({
        data: {
            email,
            password: await bcryptjs_1.default.hash(password, 10),
            name: name || null,
            role: role || client_1.Role.EDITOR,
        },
        select: { id: true, email: true, name: true, role: true, isActive: true },
    });
    res.status(201).json(user);
});
router.patch('/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    const { name, role, isActive, password } = req.body;
    const data = {};
    if (name !== undefined)
        data.name = name;
    if (role !== undefined)
        data.role = role;
    if (isActive !== undefined)
        data.isActive = !!isActive;
    if (password)
        data.password = await bcryptjs_1.default.hash(password, 10);
    const user = await prisma_1.default.user.update({
        where: { id },
        data,
        select: { id: true, email: true, name: true, role: true, isActive: true },
    });
    res.json(user);
});
router.delete('/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    if (req.user?.userId === id) {
        res.status(400).json({ error: 'Không thể xóa tài khoản đang đăng nhập' });
        return;
    }
    await prisma_1.default.user.delete({ where: { id } });
    res.status(204).send();
});
exports.default = router;
