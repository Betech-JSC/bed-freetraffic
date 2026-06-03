"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const otplib_1 = require("otplib");
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-free-traffic-key';
// Đăng ký (Register)
router.post('/register', async (req, res) => {
    try {
        const { email, password, name } = req.body;
        if (!email || !password) {
            res.status(400).json({ error: 'Vui lòng cung cấp email và mật khẩu' });
            return;
        }
        const existingUser = await prisma_1.default.user.findUnique({ where: { email } });
        if (existingUser) {
            res.status(400).json({ error: 'Email đã được sử dụng' });
            return;
        }
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        const user = await prisma_1.default.user.create({
            data: {
                email,
                password: hashedPassword,
                name: name || 'Admin User',
                role: 'ADMIN' // Tạm thời set mặc định là ADMIN cho bản MVP
            }
        });
        res.status(201).json({ message: 'Đăng ký thành công', userId: user.id });
    }
    catch (error) {
        console.error('Lỗi đăng ký:', error);
        res.status(500).json({ error: 'Lỗi máy chủ nội bộ' });
    }
});
// Đăng nhập (Login)
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            res.status(400).json({ error: 'Vui lòng cung cấp email và mật khẩu' });
            return;
        }
        const user = await prisma_1.default.user.findUnique({ where: { email } });
        if (!user) {
            res.status(401).json({ error: 'Sai email hoặc mật khẩu' });
            return;
        }
        if (user.isActive === false) {
            res.status(403).json({ error: 'Tài khoản đã bị vô hiệu hóa' });
            return;
        }
        const isPasswordValid = await bcryptjs_1.default.compare(password, user.password);
        if (!isPasswordValid) {
            res.status(401).json({ error: 'Sai email hoặc mật khẩu' });
            return;
        }
        if (user.totpEnabled && user.totpSecret) {
            const totpCode = req.body.totpCode;
            if (!totpCode) {
                res.status(403).json({ requiresTotp: true, error: 'Cần mã xác thực 2FA' });
                return;
            }
            const valid = await (0, otplib_1.verify)({ token: totpCode, secret: user.totpSecret });
            if (!valid) {
                res.status(401).json({ error: 'Mã 2FA không đúng' });
                return;
            }
        }
        // Tạo JWT Token
        const token = jsonwebtoken_1.default.sign({ userId: user.id, email: user.email, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
        res.status(200).json({
            message: 'Đăng nhập thành công',
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role
            }
        });
    }
    catch (error) {
        console.error('Lỗi đăng nhập:', error);
        res.status(500).json({ error: 'Lỗi máy chủ nội bộ' });
    }
});
router.post('/2fa/setup', auth_1.authenticate, async (req, res) => {
    const user = await prisma_1.default.user.findUnique({ where: { id: req.user.userId } });
    if (!user) {
        res.status(404).json({ error: 'Không tìm thấy user' });
        return;
    }
    const secret = (0, otplib_1.generateSecret)();
    await prisma_1.default.user.update({
        where: { id: user.id },
        data: { totpSecret: secret, totpEnabled: false },
    });
    const otpauthUrl = (0, otplib_1.generateURI)({ label: user.email, issuer: 'Be Traffic', secret });
    res.json({ secret, otpauthUrl, message: 'Quét QR bằng Google Authenticator rồi bật 2FA.' });
});
router.post('/2fa/enable', auth_1.authenticate, async (req, res) => {
    const { code } = req.body;
    if (!code) {
        res.status(400).json({ error: 'Nhập mã 6 số' });
        return;
    }
    const user = await prisma_1.default.user.findUnique({ where: { id: req.user.userId } });
    if (!user?.totpSecret) {
        res.status(400).json({ error: 'Chạy setup 2FA trước' });
        return;
    }
    if (!(await (0, otplib_1.verify)({ token: String(code), secret: user.totpSecret }))) {
        res.status(400).json({ error: 'Mã không hợp lệ' });
        return;
    }
    await prisma_1.default.user.update({ where: { id: user.id }, data: { totpEnabled: true } });
    res.json({ message: 'Đã bật 2FA' });
});
router.post('/2fa/disable', auth_1.authenticate, async (req, res) => {
    const { code } = req.body;
    const user = await prisma_1.default.user.findUnique({ where: { id: req.user.userId } });
    if (!user?.totpSecret || !user.totpEnabled) {
        res.status(400).json({ error: '2FA chưa bật' });
        return;
    }
    if (!(await (0, otplib_1.verify)({ token: String(code), secret: user.totpSecret }))) {
        res.status(400).json({ error: 'Mã không hợp lệ' });
        return;
    }
    await prisma_1.default.user.update({
        where: { id: user.id },
        data: { totpEnabled: false, totpSecret: null },
    });
    res.json({ message: 'Đã tắt 2FA' });
});
router.get('/2fa/status', auth_1.authenticate, async (req, res) => {
    const user = await prisma_1.default.user.findUnique({
        where: { id: req.user.userId },
        select: { totpEnabled: true },
    });
    res.json({ enabled: user?.totpEnabled ?? false });
});
exports.default = router;
