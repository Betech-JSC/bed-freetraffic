"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../lib/prisma"));
const smtp_1 = require("../lib/smtp");
const careEmail_1 = require("../lib/careEmail");
const auth_1 = require("../middleware/auth");
const auditLogger_1 = require("../lib/auditLogger");
const cache_1 = require("../lib/cache");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
const STATUSES = ['NEW', 'ACTIVE', 'NEED_FOLLOWUP', 'VIP', 'INACTIVE'];
router.get('/', async (req, res) => {
    const status = req.query.status || undefined;
    const q = (req.query.q || '').trim();
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;
    const where = {
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
    };
    try {
        const [total, vipCount, followupCount, customers] = await Promise.all([
            prisma_1.default.customer.count({ where }),
            prisma_1.default.customer.count({ where: { workspaceId: req.workspaceId, status: 'VIP' } }),
            prisma_1.default.customer.count({ where: { workspaceId: req.workspaceId, status: 'NEED_FOLLOWUP' } }),
            prisma_1.default.customer.findMany({
                where,
                orderBy: { updatedAt: 'desc' },
                skip,
                take: limit,
                include: {
                    notes: { orderBy: { createdAt: 'desc' }, take: 1 },
                    _count: { select: { emailLogs: true, notes: true } },
                },
            }),
        ]);
        res.json({
            data: customers,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
                vipCount,
                followupCount,
            },
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Lỗi lấy danh sách khách hàng' });
    }
});
router.get('/export/csv', async (req, res) => {
    try {
        const customers = await prisma_1.default.customer.findMany({
            where: { workspaceId: req.workspaceId },
            orderBy: { createdAt: 'desc' }
        });
        let csv = 'ID,Họ tên,Email,Số điện thoại,Công ty,Trạng thái,Nguồn traffic,Chiến dịch UTM,Thời gian tạo\n';
        for (const c of customers) {
            const formattedDate = c.createdAt.toISOString();
            csv += `"${c.id}","${(c.name || '').replace(/"/g, '""')}","${(c.email || '').replace(/"/g, '""')}","${(c.phone || '').replace(/"/g, '""')}","${(c.company || '').replace(/"/g, '""')}","${c.status}","${(c.trafficSource || '').replace(/"/g, '""')}","${(c.utmCampaign || '').replace(/"/g, '""')}","${formattedDate}"\n`;
        }
        // Ghi audit log
        await (0, auditLogger_1.logActivity)({
            userId: req.user.userId,
            workspaceId: req.workspaceId,
            action: 'EXPORT_CRM',
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            details: { count: customers.length }
        });
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="customers.csv"');
        res.send('\uFEFF' + csv);
    }
    catch (error) {
        console.error('[GET /customers/export/csv]', error);
        res.status(500).json({ error: error.message || 'Lỗi xuất file' });
    }
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
    const { name, email, phone, zaloUserId, company, status, note } = req.body;
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
                zaloUserId: zaloUserId?.trim() || null,
                company: company?.trim() || null,
                status: status && STATUSES.includes(status) ? status : 'NEW',
                workspaceId: req.workspaceId,
                notes: note?.trim()
                    ? { create: [{ content: note.trim() }] }
                    : undefined,
            },
            include: { notes: { orderBy: { createdAt: 'desc' }, take: 5 } },
        });
        // Kích hoạt gửi email chào mừng cho khách hàng mới
        const { triggerEmailEvent } = await Promise.resolve().then(() => __importStar(require('../services/emailEventTrigger')));
        void triggerEmailEvent('WELCOME', {
            customerId: customer.id,
            workspaceId: req.workspaceId
        }).catch(e => console.error('Error triggering customer welcome email:', e));
        // Ghi audit log
        await (0, auditLogger_1.logActivity)({
            userId: req.user.userId,
            workspaceId: req.workspaceId,
            action: 'CREATE_CUSTOMER',
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            details: { customerId: customer.id, customerName: customer.name, email: customer.email }
        });
        if (req.workspaceId) {
            void (0, cache_1.invalidateWorkspaceCache)(req.workspaceId, ['dashboard', 'report']).catch(err => {
                console.error('[Cache Invalidation Error]:', err);
            });
        }
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
    const { name, email, phone, zaloUserId, company, status } = req.body;
    const data = {};
    if (name != null)
        data.name = String(name).trim();
    if (email != null)
        data.email = String(email).trim().toLowerCase();
    if (phone !== undefined)
        data.phone = phone?.trim() || null;
    if (zaloUserId !== undefined)
        data.zaloUserId = zaloUserId?.trim() || null;
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
        // Ghi audit log
        await (0, auditLogger_1.logActivity)({
            userId: req.user.userId,
            workspaceId: req.workspaceId,
            action: 'UPDATE_CUSTOMER',
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            details: { customerId: id, email: customer.email, updatedFields: Object.keys(data) }
        });
        if (req.workspaceId) {
            void (0, cache_1.invalidateWorkspaceCache)(req.workspaceId, ['dashboard', 'report']).catch(err => {
                console.error('[Cache Invalidation Error]:', err);
            });
        }
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
    // Ghi audit log
    await (0, auditLogger_1.logActivity)({
        userId: req.user.userId,
        workspaceId: req.workspaceId,
        action: 'DELETE_CUSTOMER',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        details: { customerId: id, email: existing.email, customerName: existing.name }
    });
    if (req.workspaceId) {
        void (0, cache_1.invalidateWorkspaceCache)(req.workspaceId, ['dashboard', 'report']).catch(err => {
            console.error('[Cache Invalidation Error]:', err);
        });
    }
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
    const { customerIds, subject, htmlContent, channel = 'email' } = req.body;
    if (!Array.isArray(customerIds) || customerIds.length === 0) {
        res.status(400).json({ error: 'Chọn ít nhất một khách hàng' });
        return;
    }
    if (!subject?.trim() || !htmlContent?.trim()) {
        res.status(400).json({ error: 'Tiêu đề và nội dung chăm sóc là bắt buộc' });
        return;
    }
    // If sending via Email, check SMTP config
    let transporter = null;
    let fromAddress = '';
    if (channel === 'email') {
        transporter = await (0, smtp_1.createSmtpTransporter)(req.workspaceId);
        if (!transporter) {
            res.status(400).json({
                error: 'Chưa cấu hình SMTP. Vào Cài đặt → Email để kết nối trước khi gửi.',
            });
            return;
        }
        const smtpCfg = await (0, smtp_1.getSmtpConfig)(req.workspaceId);
        fromAddress = process.env.SMTP_FROM || smtpCfg?.email || '';
    }
    let zaloConn = null;
    if (channel === 'zalo') {
        zaloConn = await prisma_1.default.socialConnection.findFirst({
            where: { platform: 'zalo', workspaceId: req.workspaceId }
        });
        if (!zaloConn || zaloConn.status !== 'CONNECTED' || !zaloConn.accessToken) {
            res.status(400).json({
                error: 'Chưa kết nối Zalo OA. Vui lòng kết nối Zalo OA trong Cài đặt trước.',
            });
            return;
        }
    }
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
            if (channel === 'email') {
                await transporter.sendMail({
                    from: fromAddress,
                    to: customer.email,
                    subject: renderedSubject,
                    html,
                });
            }
            else if (channel === 'zalo') {
                const plainText = html.replace(/<[^>]+>/g, '');
                if (customer.zaloUserId) {
                    const zaloRes = await fetch('https://openapi.zalo.me/v3.0/oa/message/cs', {
                        method: 'POST',
                        headers: {
                            'access_token': zaloConn.accessToken,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            recipient: {
                                user_id: customer.zaloUserId
                            },
                            message: {
                                text: `${renderedSubject}\n\n${plainText}`
                            }
                        })
                    });
                    const zaloData = await zaloRes.json();
                    if (zaloData.error !== 0 && zaloData.error !== undefined) {
                        throw new Error(zaloData.message || `Zalo OA API Error code ${zaloData.error}`);
                    }
                }
                else if (customer.phone) {
                    let phoneFormatted = customer.phone.replace(/[^0-9]/g, '');
                    if (phoneFormatted.startsWith('0')) {
                        phoneFormatted = '84' + phoneFormatted.substring(1);
                    }
                    const znsTemplateId = process.env.ZALO_ZNS_TEMPLATE_ID || 'default';
                    const znsRes = await fetch('https://business.openapi.zalo.me/message/template', {
                        method: 'POST',
                        headers: {
                            'access_token': zaloConn.accessToken,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            phone: phoneFormatted,
                            template_id: znsTemplateId,
                            template_data: {
                                name: customer.name,
                                subject: renderedSubject,
                                content: plainText.substring(0, 100)
                            }
                        })
                    });
                    const znsData = await znsRes.json();
                    if (znsData.error !== 0 && znsData.error !== undefined) {
                        throw new Error(`Zalo API error: ${znsData.message || 'Không gửi được tin nhắn'}. Bạn cần liên kết Zalo User ID hoặc đăng ký ZNS Template.`);
                    }
                }
                else {
                    throw new Error('Khách hàng này không có Zalo User ID hoặc Số điện thoại để gửi Zalo.');
                }
            }
            else if (channel === 'messenger') {
                // Mock Messenger sending
                console.log(`[Messenger Mock] Gửi tin nhắn đến khách hàng ${customer.name}: ${renderedSubject} - ${html.slice(0, 100)}...`);
            }
            else {
                throw new Error(`Kênh gửi "${channel}" chưa được hỗ trợ.`);
            }
            await prisma_1.default.customerEmailLog.create({
                data: {
                    customerId: customer.id,
                    subject: renderedSubject,
                    body: html,
                    status: 'SENT',
                    channel,
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
                    channel,
                },
            });
            errors.push(`${customer.email || customer.name}: ${msg}`);
        }
    }
    const channelLabel = channel === 'email' ? 'email' : channel === 'zalo' ? 'tin nhắn Zalo' : 'tin nhắn Messenger';
    res.json({
        message: `Đã gửi ${sent}/${customers.length} ${channelLabel} chăm sóc`,
        sent,
        total: customers.length,
        errors: errors.length ? errors : undefined,
    });
});
// Import danh sách khách hàng hàng loạt (CSV/JSON)
router.post('/import', auth_1.requireWrite, async (req, res) => {
    const { customers } = req.body;
    if (!Array.isArray(customers) || customers.length === 0) {
        res.status(400).json({ error: 'Danh sách khách hàng không hợp lệ hoặc rỗng.' });
        return;
    }
    let createdCount = 0;
    let updatedCount = 0;
    const errors = [];
    try {
        // 1. Lọc các bản ghi hợp lệ
        const validCustomers = [];
        for (const c of customers) {
            const name = c.name?.trim();
            const email = c.email?.trim()?.toLowerCase();
            if (!name || !email) {
                errors.push(`Bỏ qua dòng không hợp lệ: thiếu Tên hoặc Email`);
                continue;
            }
            validCustomers.push({
                name,
                email,
                phone: c.phone?.trim() || null,
                company: c.company?.trim() || null,
                status: c.status || 'NEW',
            });
        }
        if (validCustomers.length === 0) {
            res.status(400).json({
                error: 'Không tìm thấy khách hàng hợp lệ để nhập.',
                errors: errors.length > 0 ? errors : undefined,
            });
            return;
        }
        // 2. Lấy toàn bộ khách hàng hiện tại khớp với danh sách email cần nhập trong workspace
        const emailsToImport = validCustomers.map((c) => c.email);
        const existingCustomers = await prisma_1.default.customer.findMany({
            where: {
                workspaceId: req.workspaceId,
                email: { in: emailsToImport },
            },
            select: { id: true, email: true, phone: true, company: true },
        });
        const existingMap = new Map(existingCustomers.map((c) => [c.email, c]));
        // 3. Phân nhóm tạo mới và cập nhật
        const toCreate = [];
        const toUpdate = [];
        for (const c of validCustomers) {
            const existing = existingMap.get(c.email);
            if (existing) {
                toUpdate.push({
                    id: existing.id,
                    data: {
                        name: c.name,
                        phone: c.phone || existing.phone,
                        company: c.company || existing.company,
                        status: c.status,
                    },
                });
            }
            else {
                toCreate.push({
                    name: c.name,
                    email: c.email,
                    phone: c.phone,
                    company: c.company,
                    status: c.status,
                    workspaceId: req.workspaceId,
                });
            }
        }
        // 4. Thực thi ghi dữ liệu theo lô (Batch size = 50) trong transaction
        const BATCH_SIZE = 50;
        // Xử lý tạo mới
        for (let i = 0; i < toCreate.length; i += BATCH_SIZE) {
            const batch = toCreate.slice(i, i + BATCH_SIZE);
            await prisma_1.default.$transaction(batch.map((data) => prisma_1.default.customer.create({ data })));
            createdCount += batch.length;
        }
        // Xử lý cập nhật
        for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
            const batch = toUpdate.slice(i, i + BATCH_SIZE);
            await prisma_1.default.$transaction(batch.map((item) => prisma_1.default.customer.update({
                where: { id: item.id },
                data: item.data,
            })));
            updatedCount += batch.length;
        }
        // Ghi audit log
        await (0, auditLogger_1.logActivity)({
            userId: req.user.userId,
            workspaceId: req.workspaceId,
            action: 'IMPORT_CUSTOMERS',
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            details: { createdCount, updatedCount, totalImported: createdCount + updatedCount }
        });
        if (req.workspaceId) {
            void (0, cache_1.invalidateWorkspaceCache)(req.workspaceId, ['dashboard', 'report']).catch(err => {
                console.error('[Cache Invalidation Error]:', err);
            });
        }
        res.json({
            message: `Nhập thành công: tạo mới ${createdCount}, cập nhật ${updatedCount} khách hàng.`,
            createdCount,
            updatedCount,
            errors: errors.length > 0 ? errors : undefined,
        });
    }
    catch (err) {
        res.status(500).json({
            error: err.message || 'Lỗi hệ thống khi nhập khách hàng.',
            errors: errors.length > 0 ? errors : undefined,
        });
    }
});
exports.default = router;
