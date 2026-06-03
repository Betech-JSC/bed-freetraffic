"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditAllPagesWithPageSpeed = auditAllPagesWithPageSpeed;
exports.startPageSpeedAuditorEngine = startPageSpeedAuditorEngine;
const node_cron_1 = __importDefault(require("node-cron"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const pagespeedAuditService_1 = require("../services/pagespeedAuditService");
async function auditAllPagesWithPageSpeed() {
    console.log('⚡ [PageSpeed Auditor] Bắp đầu quét PageSpeed Insights hàng tuần...');
    // 1. Get distinct URLs previously audited
    const audits = await prisma_1.default.seoAudit.findMany({
        distinct: ['url'],
        select: { url: true },
    });
    const auditedUrls = audits.map((a) => a.url).filter(Boolean);
    // 2. Get active website channel URLs
    const channels = await prisma_1.default.channel.findMany({
        where: {
            url: { not: null },
            status: 'ACTIVE'
        },
        select: { url: true },
    });
    const channelUrls = channels.map((c) => c.url).filter(Boolean);
    // Combine and deduplicate
    const allUrls = Array.from(new Set([...auditedUrls, ...channelUrls]));
    if (allUrls.length === 0) {
        console.log('⚡ [PageSpeed Auditor] Không tìm thấy URL nào cần quét.');
        return;
    }
    let successCount = 0;
    for (const url of allUrls) {
        try {
            console.log(`⚡ [PageSpeed Auditor] Đang quét: ${url}`);
            const result = await (0, pagespeedAuditService_1.runPageSpeedAudit)(url);
            await prisma_1.default.seoAudit.create({
                data: {
                    url,
                    score: result.score,
                    technicalScore: result.technicalScore,
                    contentScore: result.contentScore,
                    uxScore: result.uxScore,
                    issues: { create: result.issues },
                },
            });
            successCount++;
        }
        catch (err) {
            console.error(`⚡ [PageSpeed Auditor Error] Thất bại khi quét ${url}:`, err.message || err);
        }
    }
    console.log(`⚡ [PageSpeed Auditor] Đã hoàn thành quét PageSpeed tự động cho ${successCount}/${allUrls.length} trang.`);
}
function startPageSpeedAuditorEngine() {
    console.log('⚡ PageSpeed Auditor Engine Started...');
    // Run weekly: Sunday at 3:00 AM
    node_cron_1.default.schedule('0 3 * * 0', async () => {
        try {
            await auditAllPagesWithPageSpeed();
        }
        catch (err) {
            console.error('[PageSpeed Auditor Engine Cron Error]:', err);
        }
    });
}
