import prisma from '../lib/prisma';
import { createSmtpTransporter, getSmtpConfig } from '../lib/smtp';
import { cskhFollowupQueue } from '../queues/cskhFollowupQueue';
import { generateEmailWithRag } from './ragEmailService';

/**
 * Hàm hỗ trợ xử lý gửi email thực tế cho sự kiện (Dùng cho cả background worker và fallback)
 */
export async function processEventEmail(eventType: string, payload: any): Promise<void> {
  try {
    // 1. Phân giải workspaceId và customerId
    let workspaceId = payload.workspaceId;
    let customerId = payload.customerId || payload.customer?.id;
    let recipientEmail = payload.email || payload.customerEmail || payload.customer?.email;

    if (customerId) {
      const cust = await prisma.customer.findUnique({
        where: { id: customerId }
      });
      if (cust) {
        if (!workspaceId) workspaceId = cust.workspaceId;
        if (!recipientEmail) recipientEmail = cust.email;
      }
    }

    const orderId = payload.orderId || payload.order?.id;
    if (orderId) {
      const ord = await prisma.order.findUnique({
        where: { id: orderId }
      });
      if (ord) {
        if (!workspaceId) workspaceId = ord.workspaceId;
        if (!customerId) customerId = ord.customerId;
      }
    }

    if (!workspaceId) {
      const firstWorkspace = await prisma.workspace.findFirst();
      workspaceId = firstWorkspace?.id || 1;
    }

    if (!recipientEmail && customerId) {
      const cust = await prisma.customer.findUnique({ where: { id: customerId } });
      recipientEmail = cust?.email;
    }

    if (!recipientEmail) {
      console.warn(`[emailEventTrigger] Bỏ qua gửi email sự kiện ${eventType}: Không xác định được email người nhận.`);
      return;
    }

    console.log(`[emailEventTrigger] Bắt đầu sinh email AI RAG cho sự kiện ${eventType} (Workspace #${workspaceId}, Khách hàng #${customerId || 'N/A'})`);

    // 2. Gọi RAG Email Service sinh email
    const emailResult = await generateEmailWithRag(workspaceId, eventType, {
      ...payload,
      customerId,
      workspaceId
    });

    // 3. Gửi SMTP
    const transporter = await createSmtpTransporter(workspaceId);
    const smtpConfig = await getSmtpConfig(workspaceId);

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
        await prisma.customerEmailLog.create({
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
    } else {
      console.warn(`[emailEventTrigger] Bỏ qua gửi SMTP: Cấu hình SMTP chưa được hoàn tất cho Workspace #${workspaceId}`);
      
      // Ghi nhận lịch sử gửi thất bại
      if (customerId) {
        await prisma.customerEmailLog.create({
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
  } catch (err: any) {
    console.error(`[emailEventTrigger] Lỗi khi xử lý email cho sự kiện ${eventType}:`, err);
  }
}

/**
 * Kích hoạt gửi email sự kiện (đẩy vào hàng đợi BullMQ hoặc chạy ngầm tự động)
 */
export async function triggerEmailEvent(eventType: string, payload: any): Promise<void> {
  console.log(`[emailEventTrigger] Kích hoạt sự kiện email: ${eventType}`);

  if (cskhFollowupQueue) {
    try {
      await cskhFollowupQueue.add(`event-driven-${eventType}-${Date.now()}`, {
        type: 'event-driven-email',
        eventType,
        payload
      });
      console.log(`[emailEventTrigger] Đã đẩy tác vụ sự kiện ${eventType} vào hàng đợi BullMQ.`);
      return;
    } catch (err) {
      console.error('[emailEventTrigger] Lỗi khi đẩy tác vụ vào BullMQ. Chuyển sang fallback chạy trực tiếp trong background:', err);
    }
  }

  // Chạy không đồng bộ trên background thread (non-blocking)
  setImmediate(async () => {
    await processEventEmail(eventType, payload);
  });
}
