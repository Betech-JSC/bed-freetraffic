"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dispatchDueCampaigns = dispatchDueCampaigns;
exports.startEmailCampaignEngine = startEmailCampaignEngine;
const prisma_1 = __importDefault(require("../lib/prisma"));
const emailCampaignSend_1 = require("../services/emailCampaignSend");
const emailCampaignQueue_1 = require("../queues/emailCampaignQueue");
const connection_1 = require("../queues/connection");
async function dispatchDueCampaigns() {
    const now = new Date();
    try {
        const due = await prisma_1.default.emailCampaign.findMany({
            where: {
                status: 'SCHEDULED',
                scheduledAt: { lte: now },
            },
            orderBy: { scheduledAt: 'asc' },
        });
        if (due.length > 0) {
            console.log(`[EmailCampaignEngine (No-Redis)] Phát hiện ${due.length} chiến dịch đến hạn gửi. Đang xử lý trực tiếp...`);
            for (const c of due) {
                // Cập nhật trạng thái thành PROCESSING tránh bị trùng lặp
                await prisma_1.default.emailCampaign.update({
                    where: { id: c.id },
                    data: { status: 'PROCESSING' },
                });
                // Chạy bất đồng bộ để không chặn tiến trình quét chính
                (async () => {
                    try {
                        console.log(`[EmailCampaignEngine (No-Redis)] Bắt đầu xử lý chiến dịch #${c.id}...`);
                        const result = await (0, emailCampaignSend_1.sendEmailCampaign)(c.id);
                        console.log(`[EmailCampaignEngine (No-Redis)] Gửi thành công chiến dịch #${c.id}: ${result.sent}/${result.total} email.`);
                    }
                    catch (err) {
                        console.error(`[EmailCampaignEngine (No-Redis)] Thất bại khi gửi chiến dịch #${c.id}:`, err);
                        await prisma_1.default.emailCampaign.update({
                            where: { id: c.id },
                            data: { status: 'FAILED' },
                        });
                    }
                })();
            }
        }
    }
    catch (error) {
        console.error(`[EmailCampaignEngine (No-Redis)] Lỗi quét chiến dịch:`, error);
    }
}
function startEmailCampaignEngine() {
    if (connection_1.useRedis && emailCampaignQueue_1.emailCampaignQueue) {
        emailCampaignQueue_1.emailCampaignQueue.add('campaign-scanner', {}, {
            repeat: {
                every: 60_000,
            },
            jobId: 'campaign-scanner',
        }).then(() => {
            console.log('✅ Email campaign scheduler — Đã đăng ký repeatable job BullMQ (quét mỗi 60 giây)');
        }).catch((err) => {
            console.error('[EmailCampaignEngine] Lỗi đăng ký repeatable job:', err);
        });
    }
    else {
        console.log('✅ Email campaign scheduler — Đang khởi chạy ở chế độ Local Fallback (quét mỗi 60 giây sử dụng setInterval)');
        // Quét ngay lập tức khi khởi chạy
        dispatchDueCampaigns();
        setInterval(() => {
            dispatchDueCampaigns();
        }, 60_000);
    }
}
