"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dispatchDueWorkflowEmails = dispatchDueWorkflowEmails;
exports.startEmailWorkflowEngine = startEmailWorkflowEngine;
const prisma_1 = __importDefault(require("../lib/prisma"));
const smtp_1 = require("../lib/smtp");
const emailWorkflowQueue_1 = require("../queues/emailWorkflowQueue");
const connection_1 = require("../queues/connection");
const TICK_MS = 60_000; // Run every 60 seconds
async function dispatchDueWorkflowEmails(limit = 50) {
    const now = new Date();
    const claimTime = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes lock
    try {
        // LOCK and Claim jobs in a single transaction
        const claimedJobIds = await prisma_1.default.$transaction(async (tx) => {
            const pendingJobs = await tx.$queryRawUnsafe(`SELECT id FROM "EmailWorkflowQueue"
         WHERE "scheduledAt" <= $1
           AND "status" = 'PENDING'
         FOR UPDATE SKIP LOCKED
         LIMIT $2`, now, limit);
            if (pendingJobs.length === 0)
                return [];
            const ids = pendingJobs.map(j => j.id);
            await tx.emailWorkflowQueue.updateMany({
                where: { id: { in: ids } },
                data: {
                    status: 'PROCESSING',
                    scheduledAt: claimTime
                }
            });
            return ids;
        });
        if (claimedJobIds.length === 0)
            return;
        console.log(`[EmailWorkflowEngine] Locked ${claimedJobIds.length} pending email workflow jobs.`);
        // Fetch the jobs with full details
        const jobs = await prisma_1.default.emailWorkflowQueue.findMany({
            where: { id: { in: claimedJobIds } },
            include: {
                customer: true,
                step: true,
            },
        });
        for (const job of jobs) {
            try {
                const { customer, step, workspaceId } = job;
                if (!customer || !step) {
                    await prisma_1.default.emailWorkflowQueue.update({
                        where: { id: job.id },
                        data: { status: 'FAILED', errorMessage: 'Thiếu thông tin khách hàng hoặc bước gửi email.' },
                    });
                    continue;
                }
                // Check if customer status is INACTIVE or unsubscribed (status = INACTIVE)
                if (customer.status === 'INACTIVE') {
                    await prisma_1.default.emailWorkflowQueue.update({
                        where: { id: job.id },
                        data: { status: 'CANCELLED', errorMessage: 'Khách hàng ở trạng thái không hoạt động/hủy đăng ký.' },
                    });
                    continue;
                }
                // Get SMTP Config
                const smtpConfig = await (0, smtp_1.getSmtpConfig)(workspaceId || undefined);
                const transporter = await (0, smtp_1.createSmtpTransporter)(workspaceId || undefined);
                if (!transporter || !smtpConfig) {
                    await prisma_1.default.emailWorkflowQueue.update({
                        where: { id: job.id },
                        data: { status: 'FAILED', errorMessage: 'Chưa cấu hình SMTP cho Workspace này.' },
                    });
                    continue;
                }
                // Replace template variables
                let subject = step.emailSubject || 'Thông tin chăm sóc khách hàng';
                let body = step.emailBody || '';
                const variables = {
                    name: customer.name || 'Quý khách',
                    email: customer.email,
                    phone: customer.phone || '',
                    company: customer.company || '',
                };
                for (const [key, val] of Object.entries(variables)) {
                    const regex = new RegExp(`{{${key}}}`, 'g');
                    subject = subject.replace(regex, val);
                    body = body.replace(regex, val);
                }
                // Send the mail
                await transporter.sendMail({
                    from: `"${smtpConfig.email.split('@')[0]}" <${smtpConfig.email}>`,
                    to: customer.email,
                    subject,
                    html: body,
                });
                // Update current job status
                await prisma_1.default.emailWorkflowQueue.update({
                    where: { id: job.id },
                    data: { status: 'SENT' },
                });
                // Write log to Customer CRM history
                await prisma_1.default.customerEmailLog.create({
                    data: {
                        customerId: customer.id,
                        subject,
                        body,
                        status: 'SENT',
                        sentAt: new Date(),
                    },
                });
                // Enqueue next step
                const nextStep = await prisma_1.default.emailWorkflowStep.findFirst({
                    where: {
                        workflowId: job.workflowId,
                        stepOrder: step.stepOrder + 1,
                    },
                });
                if (nextStep) {
                    const delay = nextStep.delaySeconds || 0;
                    await prisma_1.default.emailWorkflowQueue.create({
                        data: {
                            workflowId: job.workflowId,
                            stepId: nextStep.id,
                            customerId: customer.id,
                            scheduledAt: new Date(Date.now() + delay * 1000),
                            status: 'PENDING',
                            workspaceId: job.workspaceId,
                        },
                    });
                }
            }
            catch (error) {
                console.error(`[EmailWorkflowEngine] Job ${job.id} failed:`, error);
                await prisma_1.default.emailWorkflowQueue.update({
                    where: { id: job.id },
                    data: {
                        status: 'FAILED',
                        errorMessage: error.message || 'Lỗi không xác định khi gửi mail.',
                    },
                });
            }
        }
    }
    catch (error) {
        console.error(`[EmailWorkflowEngine] Error in workflow dispatcher:`, error);
    }
}
function startEmailWorkflowEngine() {
    if (connection_1.useRedis && emailWorkflowQueue_1.emailWorkflowQueue) {
        emailWorkflowQueue_1.emailWorkflowQueue.add('drip-scanner', {}, {
            repeat: {
                every: 60_000,
            },
            jobId: 'drip-scanner',
        }).then(() => {
            console.log('✅ Email Workflow Engine — Đã đăng ký repeatable job BullMQ (quét hàng đợi Drip mỗi 60 giây)');
        }).catch((err) => {
            console.error('[EmailWorkflowEngine] Lỗi đăng ký repeatable job:', err);
        });
    }
    else {
        console.log('✅ Email Workflow Engine — Đang khởi chạy ở chế độ Local Fallback (quét hàng đợi Drip mỗi 60 giây sử dụng setInterval)');
        // Chạy ngay lập tức khi khởi chạy
        dispatchDueWorkflowEmails();
        setInterval(() => {
            dispatchDueWorkflowEmails();
        }, 60_000);
    }
}
