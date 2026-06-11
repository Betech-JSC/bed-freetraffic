"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailWorkflowWorker = exports.emailWorkflowQueue = void 0;
const bullmq_1 = require("bullmq");
const connection_1 = require("./connection");
const prisma_1 = __importDefault(require("../lib/prisma"));
const smtp_1 = require("../lib/smtp");
exports.emailWorkflowQueue = connection_1.useRedis ? new bullmq_1.Queue('email-drip-queue', { connection: connection_1.connection }) : null;
exports.emailWorkflowWorker = connection_1.useRedis
    ? new bullmq_1.Worker('email-drip-queue', async (job) => {
        // 1. Repeatable Cron Job: Quét các job drip campaign đến hạn gửi
        if (job.name === 'drip-scanner') {
            const now = new Date();
            const claimTime = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes lock
            const claimedJobIds = await prisma_1.default.$transaction(async (tx) => {
                const pendingJobs = await tx.$queryRawUnsafe(`SELECT id FROM "EmailWorkflowQueue"
               WHERE "scheduledAt" <= $1
                 AND "status" = 'PENDING'
               FOR UPDATE SKIP LOCKED
               LIMIT 50`, now);
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
            if (claimedJobIds.length > 0) {
                console.log(`[drip-scanner] Khóa thành công ${claimedJobIds.length} drip jobs. Đang đẩy vào hàng đợi...`);
                for (const jobQueueId of claimedJobIds) {
                    if (exports.emailWorkflowQueue) {
                        await exports.emailWorkflowQueue.add(`drip-${jobQueueId}`, { jobQueueId });
                    }
                }
            }
            return { scanned: claimedJobIds.length };
        }
        // 2. Individual Job: Xử lý gửi email cho một drip step
        const { jobQueueId } = job.data;
        console.log(`[Worker: email-drip] Bắt đầu xử lý drip job #${jobQueueId}...`);
        const dbJob = await prisma_1.default.emailWorkflowQueue.findUnique({
            where: { id: jobQueueId },
            include: {
                customer: true,
                step: true,
            },
        });
        if (!dbJob) {
            console.warn(`[Worker: email-drip] Không tìm thấy drip job #${jobQueueId} trong database.`);
            return;
        }
        const { customer, step, workspaceId } = dbJob;
        if (!customer || !step) {
            await prisma_1.default.emailWorkflowQueue.update({
                where: { id: jobQueueId },
                data: { status: 'FAILED', errorMessage: 'Thiếu thông tin khách hàng hoặc bước gửi email.' },
            });
            return;
        }
        // Kiểm tra trạng thái khách hàng
        if (customer.status === 'INACTIVE') {
            await prisma_1.default.emailWorkflowQueue.update({
                where: { id: jobQueueId },
                data: { status: 'CANCELLED', errorMessage: 'Khách hàng ở trạng thái không hoạt động/hủy đăng ký.' },
            });
            return;
        }
        try {
            const smtpConfig = await (0, smtp_1.getSmtpConfig)(workspaceId || undefined);
            const transporter = await (0, smtp_1.createSmtpTransporter)(workspaceId || undefined);
            if (!transporter || !smtpConfig) {
                await prisma_1.default.emailWorkflowQueue.update({
                    where: { id: jobQueueId },
                    data: { status: 'FAILED', errorMessage: 'Chưa cấu hình SMTP cho Workspace này.' },
                });
                return;
            }
            // Thay thế biến template
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
            // Thực hiện gửi email
            await transporter.sendMail({
                from: `"${smtpConfig.email.split('@')[0]}" <${smtpConfig.email}>`,
                to: customer.email,
                subject,
                html: body,
            });
            // Cập nhật trạng thái job thành SENT
            await prisma_1.default.emailWorkflowQueue.update({
                where: { id: jobQueueId },
                data: { status: 'SENT' },
            });
            // Ghi lịch sử chăm sóc khách hàng
            await prisma_1.default.customerEmailLog.create({
                data: {
                    customerId: customer.id,
                    subject,
                    body,
                    status: 'SENT',
                    sentAt: new Date(),
                },
            });
            // Thêm bước tiếp theo vào hàng đợi
            const nextStep = await prisma_1.default.emailWorkflowStep.findFirst({
                where: {
                    workflowId: dbJob.workflowId,
                    stepOrder: step.stepOrder + 1,
                },
            });
            if (nextStep) {
                const delay = nextStep.delaySeconds || 0;
                await prisma_1.default.emailWorkflowQueue.create({
                    data: {
                        workflowId: dbJob.workflowId,
                        stepId: nextStep.id,
                        customerId: customer.id,
                        scheduledAt: new Date(Date.now() + delay * 1000),
                        status: 'PENDING',
                        workspaceId: dbJob.workspaceId,
                    },
                });
                console.log(`[Worker: email-drip] Đã lên lịch bước tiếp theo #${nextStep.id} sau ${delay}s.`);
            }
        }
        catch (err) {
            console.error(`[Worker: email-drip] Drip job #${jobQueueId} lỗi:`, err);
            await prisma_1.default.emailWorkflowQueue.update({
                where: { id: jobQueueId },
                data: {
                    status: 'FAILED',
                    errorMessage: err.message || 'Lỗi không xác định khi gửi mail.',
                },
            });
            throw err;
        }
    }, {
        connection: connection_1.connection,
        concurrency: 5, // Drip email có thể chạy đồng thời nhiều hơn
    })
    : null;
if (exports.emailWorkflowQueue) {
    exports.emailWorkflowQueue.on('error', (err) => {
        (0, connection_1.logRedisError)('Queue: email-drip', err);
    });
}
if (exports.emailWorkflowWorker) {
    exports.emailWorkflowWorker.on('failed', (job, err) => {
        console.error(`[Worker: email-drip] Job ${job?.id} thất bại:`, err.message);
    });
    exports.emailWorkflowWorker.on('error', (err) => {
        (0, connection_1.logRedisError)('Worker: email-drip', err);
    });
}
