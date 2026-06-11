"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailCampaignWorker = exports.emailCampaignQueue = void 0;
const bullmq_1 = require("bullmq");
const connection_1 = require("./connection");
const prisma_1 = __importDefault(require("../lib/prisma"));
const emailCampaignSend_1 = require("../services/emailCampaignSend");
exports.emailCampaignQueue = connection_1.useRedis ? new bullmq_1.Queue('email-campaign-queue', { connection: connection_1.connection }) : null;
exports.emailCampaignWorker = connection_1.useRedis
    ? new bullmq_1.Worker('email-campaign-queue', async (job) => {
        const now = new Date();
        // 1. Repeatable Cron Job: Quét các chiến dịch đặt lịch
        if (job.name === 'campaign-scanner') {
            const due = await prisma_1.default.emailCampaign.findMany({
                where: {
                    status: 'SCHEDULED',
                    scheduledAt: { lte: now },
                },
                orderBy: { scheduledAt: 'asc' },
            });
            if (due.length > 0) {
                console.log(`[campaign-scanner] Phát hiện ${due.length} chiến dịch đến hạn gửi. Đang đẩy vào hàng đợi...`);
                for (const c of due) {
                    // Cập nhật trạng thái thành QUEUED để tránh quét lặp lại
                    await prisma_1.default.emailCampaign.update({
                        where: { id: c.id },
                        data: { status: 'QUEUED' },
                    });
                    if (exports.emailCampaignQueue) {
                        await exports.emailCampaignQueue.add(`campaign-${c.id}`, { campaignId: c.id });
                    }
                }
            }
            return { scanned: due.length };
        }
        // 2. Individual Job: Gửi một chiến dịch cụ thể
        const { campaignId } = job.data;
        console.log(`[Worker: email-campaign] Bắt đầu xử lý chiến dịch #${campaignId}...`);
        await prisma_1.default.emailCampaign.update({
            where: { id: campaignId },
            data: { status: 'PROCESSING' },
        });
        try {
            const result = await (0, emailCampaignSend_1.sendEmailCampaign)(campaignId);
            console.log(`[Worker: email-campaign] Gửi thành công chiến dịch #${campaignId}: ${result.sent}/${result.total} email.`);
            return result;
        }
        catch (err) {
            console.error(`[Worker: email-campaign] Thất bại khi gửi chiến dịch #${campaignId}:`, err);
            await prisma_1.default.emailCampaign.update({
                where: { id: campaignId },
                data: { status: 'FAILED' },
            });
            throw err;
        }
    }, {
        connection: connection_1.connection,
        concurrency: 2, // Cho phép xử lý tối đa 2 chiến dịch cùng lúc
    })
    : null;
if (exports.emailCampaignQueue) {
    exports.emailCampaignQueue.on('error', (err) => {
        (0, connection_1.logRedisError)('Queue: email-campaign', err);
    });
}
if (exports.emailCampaignWorker) {
    exports.emailCampaignWorker.on('failed', (job, err) => {
        console.error(`[Worker: email-campaign] Job ${job?.id} thất bại:`, err.message);
    });
    exports.emailCampaignWorker.on('error', (err) => {
        (0, connection_1.logRedisError)('Worker: email-campaign', err);
    });
}
