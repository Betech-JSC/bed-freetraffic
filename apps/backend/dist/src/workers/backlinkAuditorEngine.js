"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditAllBacklinks = auditAllBacklinks;
exports.startBacklinkAuditorEngine = startBacklinkAuditorEngine;
const node_cron_1 = __importDefault(require("node-cron"));
const prisma_1 = __importDefault(require("../lib/prisma"));
function normalizeUrl(url) {
    try {
        const u = new URL(url);
        return (u.host + u.pathname).replace(/\/$/, '').toLowerCase();
    }
    catch {
        return url.replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/$/, '').toLowerCase();
    }
}
async function auditAllBacklinks() {
    console.log('🔍 [Backlink Auditor] Bắt đầu quét tất cả backlink...');
    const backlinks = await prisma_1.default.backlink.findMany();
    let updatedCount = 0;
    for (const link of backlinks) {
        try {
            const res = await fetch(link.sourceUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                },
                signal: AbortSignal.timeout(15000)
            });
            let newStatus = 'active';
            let statusDetail = 'Hoạt động bình thường';
            if (!res.ok) {
                newStatus = 'broken';
                statusDetail = `Lỗi HTTP ${res.status}: Không thể tải trang nguồn`;
            }
            else {
                const html = await res.text();
                const aTagRegex = /<a\s+[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
                let found = false;
                let isNofollow = false;
                let match;
                while ((match = aTagRegex.exec(html)) !== null) {
                    const href = match[1];
                    const fullTag = match[0];
                    if (normalizeUrl(href) === normalizeUrl(link.targetUrl)) {
                        found = true;
                        const relMatch = /rel=["']([^"']*)["']/i.exec(fullTag);
                        if (relMatch && relMatch[1].toLowerCase().split(/\s+/).includes('nofollow')) {
                            isNofollow = true;
                        }
                    }
                }
                if (!found) {
                    newStatus = 'broken';
                    statusDetail = 'Không tìm thấy liên kết đích';
                }
                else if (isNofollow) {
                    newStatus = 'nofollow';
                    statusDetail = 'Có liên kết trỏ về nhưng có thuộc tính nofollow';
                }
            }
            const prevStatus = link.status;
            await prisma_1.default.backlink.update({
                where: { id: link.id },
                data: {
                    status: newStatus,
                    statusDetail,
                    checkedAt: new Date()
                }
            });
            // Nếu trạng thái giảm từ active xuống broken/nofollow, trigger Alert
            if (newStatus !== 'active' && prevStatus === 'active') {
                let rule = await prisma_1.default.alertRule.findFirst({
                    where: { metric: 'crawl_errors' }
                });
                if (!rule) {
                    rule = await prisma_1.default.alertRule.create({
                        data: {
                            name: 'Lỗi Crawl & Giám sát',
                            metric: 'crawl_errors',
                            threshold: 1,
                            comparison: 'gte',
                            enabled: true
                        }
                    });
                }
                await prisma_1.default.alertLog.create({
                    data: {
                        ruleId: rule.id,
                        message: `Cảnh báo Backlink: ${link.sourceUrl} trỏ tới ${link.targetUrl} bị lỗi (${statusDetail})`,
                        severity: 'WARNING'
                    }
                });
            }
            updatedCount++;
        }
        catch (err) {
            console.error(`[Backlink Auditor Error] Không thể quét ${link.sourceUrl}:`, err.message);
            await prisma_1.default.backlink.update({
                where: { id: link.id },
                data: {
                    status: 'broken',
                    statusDetail: `Lỗi quét: ${err.message}`,
                    checkedAt: new Date()
                }
            });
        }
    }
    console.log(`🔍 [Backlink Auditor] Đã hoàn thành quét ${updatedCount}/${backlinks.length} backlink.`);
}
function startBacklinkAuditorEngine() {
    console.log('🔍 Backlink Auditor Engine Started...');
    // Run daily at 2:00 AM
    node_cron_1.default.schedule('0 2 * * *', async () => {
        try {
            await auditAllBacklinks();
        }
        catch (err) {
            console.error('[Backlink Auditor Engine Cron Error]:', err);
        }
    });
}
