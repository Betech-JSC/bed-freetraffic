"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processEventEmail = processEventEmail;
exports.triggerEmailEvent = triggerEmailEvent;
const prisma_1 = __importDefault(require("../lib/prisma"));
const smtp_1 = require("../lib/smtp");
const cskhFollowupQueue_1 = require("../queues/cskhFollowupQueue");
const ragEmailService_1 = require("./ragEmailService");
/**
 * Hàm hỗ trợ xử lý gửi email thực tế cho sự kiện (Dùng cho cả background worker và fallback)
 */
async function processEventEmail(eventType, payload) {
    try {
        // 1. Phân giải workspaceId và customerId
        let workspaceId = payload.workspaceId;
        let customerId = payload.customerId || payload.customer?.id;
        let recipientEmail = payload.email || payload.customerEmail || payload.customer?.email;
        if (customerId) {
            const cust = await prisma_1.default.customer.findUnique({
                where: { id: customerId }
            });
            if (cust) {
                if (!workspaceId)
                    workspaceId = cust.workspaceId;
                if (!recipientEmail)
                    recipientEmail = cust.email;
            }
        }
        const orderId = payload.orderId || payload.order?.id;
        if (orderId) {
            const ord = await prisma_1.default.order.findUnique({
                where: { id: orderId }
            });
            if (ord) {
                if (!workspaceId)
                    workspaceId = ord.workspaceId;
                if (!customerId)
                    customerId = ord.customerId;
            }
        }
        if (!workspaceId) {
            const firstWorkspace = await prisma_1.default.workspace.findFirst();
            workspaceId = firstWorkspace?.id || 1;
        }
        if (!recipientEmail && customerId) {
            const cust = await prisma_1.default.customer.findUnique({ where: { id: customerId } });
            recipientEmail = cust?.email;
        }
        if (!recipientEmail) {
            console.warn(`[emailEventTrigger] Bỏ qua gửi email sự kiện ${eventType}: Không xác định được email người nhận.`);
            return;
        }
        console.log(`[emailEventTrigger] Bắt đầu sinh email AI RAG cho sự kiện ${eventType} (Workspace #${workspaceId}, Khách hàng #${customerId || 'N/A'})`);
        // 2. Gọi RAG Email Service sinh email
        const emailResult = await (0, ragEmailService_1.generateEmailWithRag)(workspaceId, eventType, {
            ...payload,
            customerId,
            workspaceId
        });
        // 3. Gửi SMTP
        const transporter = await (0, smtp_1.createSmtpTransporter)(workspaceId);
        const smtpConfig = await (0, smtp_1.getSmtpConfig)(workspaceId);
        if (transporter && smtpConfig) {
            await transporter.sendMail({
                from: `"${smtpConfig.email.split('@')[0]}" <${smtpConfig.email}>`,
                to: recipientEmail,
                subject: emailResult.subject,
                html: emailResult.htmlContent
            });
            console.log(`[emailEventTrigger] Đã gửi email sự kiện ${eventType} thành công đến ${recipientEmail}`);
            // 4. Ghi nhận lịch sử gửi email vào CRM
            if (customerId) {
                await prisma_1.default.customerEmailLog.create({
                    data: {
                        customerId,
                        subject: emailResult.subject,
                        body: emailResult.htmlContent,
                        status: 'SENT',
                        channel: 'email',
                        sentAt: new Date()
                    }
                });
            }
        }
        else {
            console.warn(`[emailEventTrigger] Bỏ qua gửi SMTP: Cấu hình SMTP chưa được hoàn tất cho Workspace #${workspaceId}`);
            // Ghi nhận lịch sử gửi thất bại
            if (customerId) {
                await prisma_1.default.customerEmailLog.create({
                    data: {
                        customerId,
                        subject: emailResult.subject,
                        body: emailResult.htmlContent,
                        status: 'FAILED',
                        errorMessage: 'SMTP not configured',
                        channel: 'email',
                        sentAt: new Date()
                    }
                });
            }
        }
    }
    catch (err) {
        console.error(`[emailEventTrigger] Lỗi khi xử lý email cho sự kiện ${eventType}:`, err);
    }
}
/**
 * Kích hoạt gửi email sự kiện (đẩy vào hàng đợi BullMQ hoặc chạy ngầm tự động)
 */
async function triggerEmailEvent(eventType, payload) {
    console.log(`[emailEventTrigger] Kích hoạt sự kiện email: ${eventType}`);
    if (cskhFollowupQueue_1.cskhFollowupQueue) {
        try {
            await cskhFollowupQueue_1.cskhFollowupQueue.add(`event-driven-${eventType}-${Date.now()}`, {
                type: 'event-driven-email',
                eventType,
                payload
            });
            console.log(`[emailEventTrigger] Đã đẩy tác vụ sự kiện ${eventType} vào hàng đợi BullMQ.`);
            return;
        }
        catch (err) {
            console.error('[emailEventTrigger] Lỗi khi đẩy tác vụ vào BullMQ. Chuyển sang fallback chạy trực tiếp trong background:', err);
        }
    }
    // Chạy không đồng bộ trên background thread (non-blocking)
    setImmediate(async () => {
        await processEventEmail(eventType, payload);
    });
}
