"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.crawlAllKeywords = crawlAllKeywords;
exports.startKeywordCrawlerEngine = startKeywordCrawlerEngine;
const prisma_1 = __importDefault(require("../lib/prisma"));
/**
 * Thực hiện cào vị trí xếp hạng Google của một từ khóa (keyword) với URL đích (targetUrl).
 * Trả về vị trí (1-100), hoặc null nếu không tìm thấy.
 * Sử dụng API Serper.dev nếu có key, ngược lại trả về vị trí mô phỏng (simulated).
 */
async function fetchKeywordPosition(keyword, targetUrl, serperApiKey) {
    if (serperApiKey) {
        try {
            const res = await fetch('https://google.serper.dev/search', {
                method: 'POST',
                headers: {
                    'X-API-KEY': serperApiKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ q: keyword, num: 100 }),
                signal: AbortSignal.timeout(15000)
            });
            if (res.ok) {
                const data = await res.json();
                const organic = data.organic || [];
                let position = null;
                const targetDomain = getDomainName(targetUrl);
                for (let i = 0; i < organic.length; i++) {
                    const link = organic[i].link || '';
                    if (getDomainName(link) === targetDomain) {
                        position = i + 1;
                        break;
                    }
                }
                return { position, source: 'crawler' };
            }
        }
        catch (err) {
            console.error(`[Keyword Crawler] Lỗi gọi API Serper cho từ khóa "${keyword}":`, err);
        }
    }
    // Fallback mô phỏng: Trả về vị trí ngẫu nhiên biến động nhẹ từ vị trí cũ
    return { position: null, source: 'simulated' };
}
function getDomainName(url) {
    try {
        const parsed = new URL(url);
        return parsed.hostname.replace(/^www\./i, '').toLowerCase();
    }
    catch {
        return url.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0].toLowerCase();
    }
}
/**
 * Worker quét tất cả từ khóa trong cơ sở dữ liệu để cập nhật thứ hạng.
 */
async function crawlAllKeywords() {
    console.log('🔍 [Keyword Crawler] Bắt đầu tiến trình cập nhật thứ hạng từ khóa...');
    const serperApiKey = process.env.SERPER_API_KEY;
    try {
        const keywords = await prisma_1.default.seoKeyword.findMany();
        let updatedCount = 0;
        for (const kw of keywords) {
            let position = null;
            let source = 'simulated';
            if (kw.url) {
                const result = await fetchKeywordPosition(kw.keyword, kw.url, serperApiKey);
                position = result.position;
                source = result.source;
            }
            // Nếu chạy ở chế độ mô phỏng hoặc không có kết quả từ API, thực hiện biến động nhẹ từ vị trí cũ
            if (position === null) {
                const prevPosition = kw.currentPosition;
                if (prevPosition !== null && prevPosition > 0) {
                    // Biến động nhẹ +/- 1 hoặc 2 vị trí, giới hạn tối thiểu 1 và tối đa 100
                    const shift = Math.floor(Math.random() * 5) - 2; // -2, -1, 0, 1, 2
                    position = Math.max(1, Math.min(100, prevPosition + shift));
                }
                else {
                    // Nếu chưa có vị trí cũ, sinh ngẫu nhiên từ 15 đến 60
                    position = Math.floor(Math.random() * 45) + 15;
                }
                source = 'simulated';
            }
            const prevPosition = kw.currentPosition;
            // 1. Cập nhật vị trí hiện tại trong bảng SeoKeyword
            await prisma_1.default.seoKeyword.update({
                where: { id: kw.id },
                data: {
                    currentPosition: position,
                    updatedAt: new Date()
                }
            });
            // 2. Ghi nhật ký vào bảng KeywordRankHistory
            await prisma_1.default.keywordRankHistory.create({
                data: {
                    keywordId: kw.id,
                    position: position,
                    source: source,
                    recordedAt: new Date()
                }
            });
            // 3. Kiểm tra tụt hạng nghiêm trọng để gửi cảnh báo (Ví dụ: tụt quá 5 hạng)
            if (prevPosition !== null && position !== null && position > prevPosition + 5 && kw.workspaceId) {
                console.warn(`⚠️ [Keyword Crawler] Phát hiện từ khóa "${kw.keyword}" tụt hạng nghiêm trọng từ #${prevPosition} xuống #${position}`);
                let rule = await prisma_1.default.alertRule.findFirst({
                    where: { metric: 'seo_rank_drops', workspaceId: kw.workspaceId }
                });
                if (!rule) {
                    rule = await prisma_1.default.alertRule.create({
                        data: {
                            name: 'Tụt hạng Từ khóa SEO',
                            metric: 'seo_rank_drops',
                            threshold: 5,
                            comparison: 'gt',
                            workspaceId: kw.workspaceId,
                            enabled: true
                        }
                    });
                }
                await prisma_1.default.alertLog.create({
                    data: {
                        ruleId: rule.id,
                        message: `Cảnh báo SEO: Từ khóa "${kw.keyword}" đã tụt hạng nghiêm trọng từ vị trí #${prevPosition} xuống #${position} (Nguồn: ${source})`,
                        severity: 'WARNING'
                    }
                });
            }
            updatedCount++;
        }
        console.log(`🔍 [Keyword Crawler] Đã hoàn thành cập nhật thứ hạng cho ${updatedCount}/${keywords.length} từ khóa.`);
    }
    catch (err) {
        console.error('❌ [Keyword Crawler] Gặp lỗi khi chạy tiến trình:', err.message || err);
    }
}
function startKeywordCrawlerEngine() {
    console.log('🔍 Keyword Crawler Engine Started...');
    // Mặc định chạy tự động lúc 2:00 sáng mỗi ngày
    const cron = require('node-cron');
    cron.schedule('0 2 * * *', async () => {
        try {
            await crawlAllKeywords();
        }
        catch (err) {
            console.error('[Keyword Crawler Engine Cron Error]:', err);
        }
    });
}
