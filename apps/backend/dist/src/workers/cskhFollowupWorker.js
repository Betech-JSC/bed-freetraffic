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
exports.dispatchDueCskhFollowUps = dispatchDueCskhFollowUps;
exports.dispatchDueCskhAutoCare = dispatchDueCskhAutoCare;
exports.dispatchDueAbandonedCarts = dispatchDueAbandonedCarts;
exports.dispatchDueInactiveCustomers = dispatchDueInactiveCustomers;
exports.startCskhFollowupWorker = startCskhFollowupWorker;
const prisma_1 = __importDefault(require("../lib/prisma"));
const smtp_1 = require("../lib/smtp");
const cskhFollowupQueue_1 = require("../queues/cskhFollowupQueue");
const connection_1 = require("../queues/connection");
const TICK_MS = 60_000; // Quét mỗi 60 giây
/**
 * Xử lý email follow-up cho một phiên chat đơn lẻ.
 * Được bọc trong try-catch độc lập để đảm bảo nếu một phiên chat bị lỗi,
 * nó sẽ không làm gián đoạn toàn bộ tiến trình quét hoặc gây crash server.
 */
async function processSession(session) {
    const workspaceId = session.workspaceId;
    // 1. Kiểm tra Cấu hình CSKH của Workspace
    const cskhConfig = await prisma_1.default.cskhConfig.findUnique({
        where: { workspaceId }
    });
    // Nếu không bật tính năng follow-up (delay = 0 hoặc null) thì đánh dấu đã xử lý và bỏ qua
    if (!cskhConfig || !cskhConfig.followUpDelayHours || cskhConfig.followUpDelayHours <= 0) {
        await prisma_1.default.chatSession.update({
            where: { id: session.id },
            data: { followUpSent: true }
        });
        return;
    }
    // 2. Kiểm tra thông tin khách hàng nhận thư
    if (!session.customer || !session.customer.email) {
        await prisma_1.default.chatSession.update({
            where: { id: session.id },
            data: { followUpSent: true }
        });
        return;
    }
    // 3. Tạo văn bản lịch sử cuộc hội thoại
    const conversationText = session.messages
        .map((m) => `${m.sender === 'visitor' ? 'Khách hàng' : 'Trợ lý ảo AI'}: ${m.content}`)
        .join('\n');
    // 4. Sinh email AI RAG chăm sóc
    const { generateEmailWithRag } = await Promise.resolve().then(() => __importStar(require('../services/ragEmailService')));
    const emailResult = await generateEmailWithRag(workspaceId, 'FOLLOWUP', {
        customerId: session.customer.id,
        customerName: session.customer.name,
        customerEmail: session.customer.email,
        chatHistory: conversationText,
        customMessage: cskhConfig.followUpEmailBody || ''
    });
    const subject = emailResult.subject;
    const htmlBody = emailResult.htmlContent;
    // 7. Gửi email qua SMTP
    const transporter = await (0, smtp_1.createSmtpTransporter)(workspaceId);
    const smtpConfig = await (0, smtp_1.getSmtpConfig)(workspaceId);
    if (transporter && smtpConfig) {
        await transporter.sendMail({
            from: `"${smtpConfig.email.split('@')[0]}" <${smtpConfig.email}>`,
            to: session.customer.email,
            subject,
            html: htmlBody,
        });
        // Lưu nhật ký vào CRM
        await prisma_1.default.customerEmailLog.create({
            data: {
                customerId: session.customer.id,
                subject,
                body: htmlBody,
                status: 'SENT',
                sentAt: new Date(),
            },
        });
        console.log(`[CskhFollowupWorker] Đã gửi email follow-up thành công đến ${session.customer.email}`);
    }
    else {
        console.warn(`[CskhFollowupWorker] SMTP chưa được cấu hình hoặc thiếu email khách hàng cho session ${session.id}`);
    }
    // 8. Đánh dấu gửi thành công
    await prisma_1.default.chatSession.update({
        where: { id: session.id },
        data: { followUpSent: true }
    });
}
async function dispatchDueCskhFollowUps() {
    try {
        const now = new Date();
        // Claim các chat session hết hạn, chuyển tiếp scheduled time 10 phút để "khóa" tạm thời
        const claimTime = new Date(Date.now() + 10 * 60 * 1000);
        const claimedIds = await prisma_1.default.$transaction(async (tx) => {
            const due = await tx.$queryRawUnsafe(`SELECT id FROM "ChatSession"
         WHERE "followUpScheduledAt" <= $1
           AND "followUpSent" = false
           AND "customerId" IS NOT NULL
         FOR UPDATE SKIP LOCKED
         LIMIT 20`, now);
            if (due.length === 0)
                return [];
            const ids = due.map((s) => s.id);
            await tx.chatSession.updateMany({
                where: { id: { in: ids } },
                data: { followUpScheduledAt: claimTime },
            });
            return ids;
        });
        if (claimedIds.length === 0)
            return;
        console.log(`[CskhFollowupWorker] Khóa thành công ${claimedIds.length} phiên chat để gửi follow-up.`);
        const dueSessions = await prisma_1.default.chatSession.findMany({
            where: { id: { in: claimedIds } },
            include: {
                customer: true,
                messages: {
                    orderBy: { createdAt: 'asc' },
                },
            },
        });
        for (const session of dueSessions) {
            try {
                await processSession(session);
            }
            catch (err) {
                console.error(`[CskhFollowupWorker] Lỗi xử lý phiên chat ${session.id}:`, err);
                // Để tránh loop vô tận khi lỗi liên tục, lùi lịch gửi 30 phút.
                try {
                    await prisma_1.default.chatSession.update({
                        where: { id: session.id },
                        data: {
                            followUpScheduledAt: new Date(Date.now() + 30 * 60 * 1000)
                        }
                    });
                }
                catch (dbErr) {
                    console.error(`[CskhFollowupWorker] Không thể lùi lịch gửi cho session ${session.id}:`, dbErr);
                }
            }
        }
    }
    catch (error) {
        console.error('[CskhFollowupWorker] Lỗi quét tiến trình gửi email chăm sóc:', error);
    }
}
async function dispatchDueCskhAutoCare() {
    try {
        const now = new Date();
        // 1. Lấy tất cả CskhConfig mà autoCareEnabled là true
        const activeConfigs = await prisma_1.default.cskhConfig.findMany({
            where: { autoCareEnabled: true }
        });
        for (const config of activeConfigs) {
            const workspaceId = config.workspaceId;
            if (!workspaceId)
                continue;
            // Đọc các kênh được cấu hình để gửi chăm sóc tự động
            const channels = (config.autoCareChannels || 'email')
                .split(',')
                .map((c) => c.trim().toLowerCase())
                .filter(Boolean);
            if (channels.length === 0)
                continue;
            // 2. Tìm danh sách khách hàng cần gửi chăm sóc tự động bằng cách LOCK dòng Postgres
            let dueCustomerIds = [];
            await prisma_1.default.$transaction(async (tx) => {
                if (config.autoCareScheduleType === 'AFTER_CREATION') {
                    const threshold = new Date(Date.now() - config.autoCareDelayHours * 60 * 60 * 1000);
                    const rows = await tx.$queryRawUnsafe(`SELECT id FROM "Customer"
             WHERE "workspaceId" = $1
               AND "createdAt" <= $2
               AND "lastAiCareSentAt" IS NULL
               AND "status" <> 'INACTIVE'
             FOR UPDATE SKIP LOCKED
             LIMIT 50`, workspaceId, threshold);
                    dueCustomerIds = rows.map(r => r.id);
                }
                else if (config.autoCareScheduleType === 'PERIODIC') {
                    const threshold = new Date(Date.now() - config.autoCareIntervalDays * 24 * 60 * 60 * 1000);
                    const rows = await tx.$queryRawUnsafe(`SELECT id FROM "Customer"
             WHERE "workspaceId" = $1
               AND "status" <> 'INACTIVE'
               AND ("lastAiCareSentAt" IS NULL OR "lastAiCareSentAt" <= $2)
             FOR UPDATE SKIP LOCKED
             LIMIT 50`, workspaceId, threshold);
                    dueCustomerIds = rows.map(r => r.id);
                }
                if (dueCustomerIds.length > 0) {
                    // Claim ngay bằng cách set lastAiCareSentAt sang thời gian hiện tại
                    await tx.customer.updateMany({
                        where: { id: { in: dueCustomerIds } },
                        data: { lastAiCareSentAt: now }
                    });
                }
            });
            if (dueCustomerIds.length === 0)
                continue;
            // Tải đầy đủ quan hệ của các khách hàng đã được claim
            const dueCustomers = await prisma_1.default.customer.findMany({
                where: { id: { in: dueCustomerIds } },
                include: {
                    notes: { orderBy: { createdAt: 'desc' } },
                    orders: { orderBy: { createdAt: 'desc' } },
                }
            });
            console.log(`[CskhAutoCare] Workspace ${workspaceId} khóa thành công ${dueCustomers.length} khách hàng để chăm sóc.`);
            // Hoist connection/config loading for the workspace before customer loop
            let transporter = null;
            let smtpConfig = null;
            if (channels.includes('email')) {
                transporter = await (0, smtp_1.createSmtpTransporter)(workspaceId);
                smtpConfig = await (0, smtp_1.getSmtpConfig)(workspaceId);
            }
            let zaloConn = null;
            if (channels.includes('zalo')) {
                zaloConn = await prisma_1.default.socialConnection.findFirst({
                    where: { platform: 'zalo', workspaceId }
                });
            }
            // 3. Xử lý từng khách hàng
            for (const customer of dueCustomers) {
                try {
                    // Luồng Fallback đa kênh: Ưu tiên Zalo OA trước, nếu lỗi tự động chuyển sang Email SMTP
                    const channelsToTry = [...channels];
                    if (channelsToTry.includes('zalo') && !channelsToTry.includes('email') && customer.email) {
                        channelsToTry.push('email');
                    }
                    let sentSuccessfully = false;
                    for (const channel of channelsToTry) {
                        // Kiểm tra điều kiện từng kênh
                        if (channel === 'email' && !customer.email)
                            continue;
                        if (channel === 'zalo' && !customer.zaloUserId && !customer.phone)
                            continue;
                        // 4. Sinh email AI RAG chăm sóc
                        const { generateEmailWithRag } = await Promise.resolve().then(() => __importStar(require('../services/ragEmailService')));
                        const emailResult = await generateEmailWithRag(workspaceId, 'FOLLOWUP', {
                            customerId: customer.id,
                            customerName: customer.name,
                            customerEmail: customer.email,
                            customMessage: config.autoCareEmailBody || ''
                        });
                        let subject = emailResult.subject;
                        let messageBody = emailResult.htmlContent;
                        // Thực thi gửi theo kênh
                        let success = false;
                        let errorMsg = null;
                        let logBody = messageBody;
                        if (channel === 'email') {
                            if (transporter && smtpConfig) {
                                try {
                                    const htmlBody = messageBody;
                                    logBody = htmlBody;
                                    await transporter.sendMail({
                                        from: `"${smtpConfig.email.split('@')[0]}" <${smtpConfig.email}>`,
                                        to: customer.email,
                                        subject,
                                        html: htmlBody,
                                    });
                                    success = true;
                                }
                                catch (sendErr) {
                                    errorMsg = sendErr.message || 'Lỗi gửi email SMTP';
                                }
                            }
                            else {
                                errorMsg = 'SMTP chưa được cấu hình cho Workspace';
                            }
                        }
                        else if (channel === 'zalo') {
                            try {
                                if (!zaloConn || zaloConn.status !== 'CONNECTED' || !zaloConn.accessToken) {
                                    throw new Error('Chưa kết nối Zalo OA. Vui lòng kết nối Zalo OA trong Cài đặt trước.');
                                }
                                const plainText = messageBody.replace(/<[^>]+>/g, '');
                                const plainSubject = subject.replace(/<[^>]+>/g, '');
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
                                                text: `${plainSubject}\n\n${plainText}`
                                            }
                                        })
                                    });
                                    const zaloData = await zaloRes.json();
                                    if (zaloData.error !== 0 && zaloData.error !== undefined) {
                                        throw new Error(zaloData.message || `Zalo OA API Error code ${zaloData.error}`);
                                    }
                                    success = true;
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
                                                subject: plainSubject,
                                                content: plainText.substring(0, 100)
                                            }
                                        })
                                    });
                                    const znsData = await znsRes.json();
                                    if (znsData.error !== 0 && znsData.error !== undefined) {
                                        throw new Error(`Zalo API error: ${znsData.message || 'Không gửi được tin nhắn'}. Bạn cần liên kết Zalo User ID hoặc đăng ký ZNS Template.`);
                                    }
                                    success = true;
                                }
                                else {
                                    throw new Error('Khách hàng này không có Zalo User ID hoặc Số điện thoại để gửi Zalo.');
                                }
                            }
                            catch (zaloErr) {
                                errorMsg = zaloErr.message || 'Lỗi gửi tin nhắn Zalo';
                            }
                        }
                        else if (channel === 'messenger') {
                            // Mock Messenger sending
                            console.log(`[CskhAutoCare Messenger] Gửi tin nhắn đến khách hàng ${customer.name}: ${messageBody.slice(0, 100)}...`);
                            success = true;
                        }
                        // Ghi nhận nhật ký chăm sóc
                        await prisma_1.default.customerEmailLog.create({
                            data: {
                                customerId: customer.id,
                                subject,
                                body: logBody,
                                status: success ? 'SENT' : 'FAILED',
                                errorMessage: errorMsg,
                                channel,
                            }
                        });
                        if (success) {
                            console.log(`[CskhAutoCare] Đã gửi tin nhắn chăm sóc qua ${channel} thành công cho khách hàng ${customer.name}`);
                            sentSuccessfully = true;
                            break; // THÀNH CÔNG: Thoát khỏi vòng lặp fallback, không gửi thêm các kênh tiếp theo
                        }
                        else {
                            console.error(`[CskhAutoCare] Gửi tin nhắn chăm sóc qua ${channel} thất bại cho khách hàng ${customer.name}: ${errorMsg}. Đang chuyển sang kênh fallback...`);
                        }
                    }
                }
                catch (custErr) {
                    console.error(`[CskhAutoCare] Lỗi xử lý khách hàng ${customer.id}:`, custErr);
                }
            }
        }
    }
    catch (error) {
        console.error('[CskhAutoCare] Lỗi quét tiến trình chăm sóc tự động:', error);
    }
}
async function dispatchDueAbandonedCarts() {
    try {
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
        const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
        // Tìm các đơn hàng PENDING trong khoảng 2h - 48h trước
        const pendingOrders = await prisma_1.default.order.findMany({
            where: {
                status: 'PENDING',
                createdAt: {
                    lte: twoHoursAgo,
                    gte: fortyEightHoursAgo,
                },
            },
            include: {
                customer: true,
            },
        });
        for (const order of pendingOrders) {
            if (!order.customer || !order.customer.email)
                continue;
            // Kiểm tra xem đã gửi email bỏ quên giỏ hàng cho đơn hàng này chưa (trong email log)
            const existingLog = await prisma_1.default.customerEmailLog.findFirst({
                where: {
                    customerId: order.customerId,
                    subject: {
                        contains: order.orderNumber,
                    },
                    status: 'SENT',
                },
            });
            if (existingLog)
                continue; // Đã gửi rồi
            console.log(`[AbandonedCart] Đơn hàng #${order.orderNumber} của khách hàng ${order.customer.email} bị bỏ quên quá 2 giờ. Kích hoạt email chăm sóc.`);
            // Trigger sự kiện ABANDONED
            const { triggerEmailEvent } = await Promise.resolve().then(() => __importStar(require('../services/emailEventTrigger')));
            await triggerEmailEvent('ABANDONED', {
                orderId: order.id,
                customerId: order.customerId,
                workspaceId: order.workspaceId,
                orderNumber: order.orderNumber,
                email: order.customer.email,
                customerName: order.customer.name,
            });
        }
    }
    catch (err) {
        console.error('[AbandonedCartScanner] Lỗi quét giỏ hàng bị bỏ quên:', err);
    }
}
async function dispatchDueInactiveCustomers() {
    try {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        // Tìm khách hàng chưa gửi chăm sóc trong 30 ngày qua và không tương tác gì trong 30 ngày qua
        const inactiveCustomers = await prisma_1.default.customer.findMany({
            where: {
                status: { not: 'INACTIVE' },
                createdAt: { lte: thirtyDaysAgo },
                AND: [
                    {
                        OR: [
                            { lastContactAt: null },
                            { lastContactAt: { lte: thirtyDaysAgo } },
                        ],
                    },
                    {
                        OR: [
                            { lastAiCareSentAt: null },
                            { lastAiCareSentAt: { lte: thirtyDaysAgo } },
                        ],
                    },
                ],
            },
            include: {
                orders: {
                    where: {
                        createdAt: { gte: thirtyDaysAgo },
                    },
                },
                notes: {
                    where: {
                        createdAt: { gte: thirtyDaysAgo },
                    },
                },
                chatSessions: {
                    where: {
                        createdAt: { gte: thirtyDaysAgo },
                    },
                },
            },
        });
        const eligibleCustomers = inactiveCustomers.filter((c) => c.orders.length === 0 && c.notes.length === 0 && c.chatSessions.length === 0);
        for (const customer of eligibleCustomers) {
            console.log(`[InactiveReactivation] Khách hàng ${customer.email} không hoạt động 30 ngày qua. Kích hoạt email đánh thức.`);
            // Cập nhật lastAiCareSentAt và chuyển status sang INACTIVE
            await prisma_1.default.customer.update({
                where: { id: customer.id },
                data: {
                    lastAiCareSentAt: new Date(),
                    status: 'INACTIVE',
                },
            });
            // Trigger sự kiện INACTIVE
            const { triggerEmailEvent } = await Promise.resolve().then(() => __importStar(require('../services/emailEventTrigger')));
            await triggerEmailEvent('INACTIVE', {
                customerId: customer.id,
                workspaceId: customer.workspaceId,
                email: customer.email,
                customerName: customer.name,
            });
        }
    }
    catch (err) {
        console.error('[InactiveScanner] Lỗi quét khách hàng ngủ đông:', err);
    }
}
function startCskhFollowupWorker() {
    if (connection_1.useRedis && cskhFollowupQueue_1.cskhFollowupQueue) {
        cskhFollowupQueue_1.cskhFollowupQueue.add('cskh-scanner', {}, {
            repeat: {
                every: 60_000,
            },
            jobId: 'cskh-scanner',
        }).then(() => {
            console.log('✅ CSKH Follow-up & AI Auto-Care Worker — Đã đăng ký repeatable job BullMQ (quét và gửi tin nhắn tự động mỗi 60 giây)');
        }).catch((err) => {
            console.error('[CskhFollowupWorker] Lỗi đăng ký repeatable job:', err);
        });
    }
    else {
        console.log('✅ CSKH Follow-up & AI Auto-Care Worker — Đang khởi chạy ở chế độ Local Fallback (quét và gửi tin nhắn tự động mỗi 60 giây sử dụng setInterval)');
        // Quét ngay lập tức khi khởi chạy
        dispatchDueCskhFollowUps();
        dispatchDueCskhAutoCare();
        dispatchDueAbandonedCarts();
        dispatchDueInactiveCustomers();
        setInterval(async () => {
            await dispatchDueCskhFollowUps();
            await dispatchDueCskhAutoCare();
            await dispatchDueAbandonedCarts();
            await dispatchDueInactiveCustomers();
        }, 60_000);
    }
}
