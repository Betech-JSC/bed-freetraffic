"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../lib/prisma"));
const smtp_1 = require("../lib/smtp");
const careEmail_1 = require("../lib/careEmail");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
const STATUSES = ['NEW', 'ACTIVE', 'NEED_FOLLOWUP', 'VIP', 'INACTIVE'];
router.get('/', async (req, res) => {
    const status = req.query.status || undefined;
    const q = (req.query.q || '').trim();
    const customers = await prisma_1.default.customer.findMany({
        where: {
            workspaceId: req.workspaceId,
            ...(status ? { status } : {}),
            ...(q
                ? {
                    OR: [
                        { name: { contains: q, mode: 'insensitive' } },
                        { email: { contains: q, mode: 'insensitive' } },
                        { company: { contains: q, mode: 'insensitive' } },
                    ],
                }
                : {}),
        },
        orderBy: { updatedAt: 'desc' },
        include: {
            notes: { orderBy: { createdAt: 'desc' }, take: 1 },
            _count: { select: { emailLogs: true, notes: true } },
        },
    });
    res.json(customers);
});
router.get('/meta/statuses', (_req, res) => {
    res.json(STATUSES);
});
router.get('/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    const customer = await prisma_1.default.customer.findFirst({
        where: { id, workspaceId: req.workspaceId },
        include: {
            notes: { orderBy: { createdAt: 'desc' } },
            emailLogs: { orderBy: { sentAt: 'desc' }, take: 50 },
        },
    });
    if (!customer) {
        res.status(404).json({ error: 'Không tìm thấy khách hàng' });
        return;
    }
    res.json(customer);
});
router.post('/', auth_1.requireWrite, async (req, res) => {
    const { name, email, phone, company, status, note } = req.body;
    if (!name?.trim() || !email?.trim()) {
        res.status(400).json({ error: 'Tên và email là bắt buộc' });
        return;
    }
    try {
        const customer = await prisma_1.default.customer.create({
            data: {
                name: name.trim(),
                email: email.trim().toLowerCase(),
                phone: phone?.trim() || null,
                company: company?.trim() || null,
                status: status && STATUSES.includes(status) ? status : 'NEW',
                workspaceId: req.workspaceId,
                notes: note?.trim()
                    ? { create: [{ content: note.trim() }] }
                    : undefined,
            },
            include: { notes: { orderBy: { createdAt: 'desc' }, take: 5 } },
        });
        res.status(201).json(customer);
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : 'Lỗi tạo khách';
        if (msg.includes('Unique constraint')) {
            res.status(400).json({ error: 'Email này đã tồn tại trong hệ thống' });
            return;
        }
        res.status(500).json({ error: msg });
    }
});
router.patch('/:id', auth_1.requireWrite, async (req, res) => {
    const id = parseInt(req.params.id);
    const { name, email, phone, company, status } = req.body;
    const data = {};
    if (name != null)
        data.name = String(name).trim();
    if (email != null)
        data.email = String(email).trim().toLowerCase();
    if (phone !== undefined)
        data.phone = phone?.trim() || null;
    if (company !== undefined)
        data.company = company?.trim() || null;
    if (status != null && STATUSES.includes(status))
        data.status = status;
    try {
        const existing = await prisma_1.default.customer.findFirst({
            where: { id, workspaceId: req.workspaceId }
        });
        if (!existing) {
            res.status(404).json({ error: 'Không tìm thấy khách hàng' });
            return;
        }
        const customer = await prisma_1.default.customer.update({ where: { id }, data });
        res.json(customer);
    }
    catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : 'Cập nhật thất bại' });
    }
});
router.delete('/:id', auth_1.requireWrite, async (req, res) => {
    const id = parseInt(req.params.id);
    const existing = await prisma_1.default.customer.findFirst({
        where: { id, workspaceId: req.workspaceId }
    });
    if (!existing) {
        res.status(404).json({ error: 'Không tìm thấy khách hàng' });
        return;
    }
    await prisma_1.default.customer.delete({ where: { id } });
    res.status(204).send();
});
router.post('/:id/notes', auth_1.requireWrite, async (req, res) => {
    const id = parseInt(req.params.id);
    const { content } = req.body;
    if (!content?.trim()) {
        res.status(400).json({ error: 'Nội dung ghi chú không được trống' });
        return;
    }
    const existing = await prisma_1.default.customer.findFirst({
        where: { id, workspaceId: req.workspaceId }
    });
    if (!existing) {
        res.status(404).json({ error: 'Không tìm thấy khách hàng' });
        return;
    }
    const note = await prisma_1.default.customerNote.create({
        data: { customerId: id, content: content.trim() },
    });
    await prisma_1.default.customer.update({ where: { id }, data: { updatedAt: new Date() } });
    res.status(201).json(note);
});
router.post('/send-care', auth_1.requireWrite, async (req, res) => {
    const { customerIds, subject, htmlContent } = req.body;
    if (!Array.isArray(customerIds) || customerIds.length === 0) {
        res.status(400).json({ error: 'Chọn ít nhất một khách hàng' });
        return;
    }
    if (!subject?.trim() || !htmlContent?.trim()) {
        res.status(400).json({ error: 'Tiêu đề và nội dung email là bắt buộc' });
        return;
    }
    const transporter = await (0, smtp_1.createSmtpTransporter)(req.workspaceId);
    if (!transporter) {
        res.status(400).json({
            error: 'Chưa cấu hình SMTP. Vào Cài đặt → Email để kết nối trước khi gửi.',
        });
        return;
    }
    const smtpCfg = await (0, smtp_1.getSmtpConfig)(req.workspaceId);
    const fromAddress = process.env.SMTP_FROM || smtpCfg?.email || '';
    const customers = await prisma_1.default.customer.findMany({
        where: {
            id: { in: customerIds.map((x) => parseInt(String(x))) },
            workspaceId: req.workspaceId,
        },
        include: { notes: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    let sent = 0;
    const errors = [];
    for (const customer of customers) {
        const latestNote = customer.notes[0]?.content;
        const html = (0, careEmail_1.renderCareEmail)(htmlContent, customer, latestNote);
        const renderedSubject = (0, careEmail_1.renderCareEmail)(subject, customer, latestNote).replace(/<[^>]+>/g, '');
        try {
            await transporter.sendMail({
                from: fromAddress,
                to: customer.email,
                subject: renderedSubject,
                html,
            });
            await prisma_1.default.customerEmailLog.create({
                data: {
                    customerId: customer.id,
                    subject: renderedSubject,
                    body: html,
                    status: 'SENT',
                },
            });
            await prisma_1.default.customer.update({
                where: { id: customer.id },
                data: { lastContactAt: new Date(), status: customer.status === 'NEW' ? 'ACTIVE' : customer.status },
            });
            sent++;
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : 'Gửi thất bại';
            await prisma_1.default.customerEmailLog.create({
                data: {
                    customerId: customer.id,
                    subject: renderedSubject,
                    body: html,
                    status: 'FAILED',
                    errorMessage: msg,
                },
            });
            errors.push(`${customer.email}: ${msg}`);
        }
    }
    res.json({
        message: `Đã gửi ${sent}/${customers.length} email chăm sóc`,
        sent,
        total: customers.length,
        errors: errors.length ? errors : undefined,
    });
});
exports.default = router;
