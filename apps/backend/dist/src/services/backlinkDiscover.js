"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.discoverBacklinksFromUrl = discoverBacklinksFromUrl;
const prisma_1 = __importDefault(require("../lib/prisma"));
function normalizeHost(hostname) {
    return hostname.replace(/^www\./i, '').toLowerCase();
}
/**
 * Quét một trang (scanUrl) tìm liên kết trỏ về targetUrl (inbound về site của bạn).
 * scanUrl mặc định = targetUrl nếu không truyền.
 */
async function discoverBacklinksFromUrl(targetUrl, scanUrl, workspaceId) {
    const target = new URL(targetUrl);
    const targetHost = normalizeHost(target.hostname);
    const pageToScan = scanUrl?.trim() || targetUrl;
    const res = await fetch(pageToScan, {
        headers: { 'User-Agent': 'FreeTrafficBot/1.0 Backlink-Discover' },
        signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
        throw new Error(`Không truy cập được trang quét (HTTP ${res.status})`);
    }
    const html = await res.text();
    const hrefRe = /<a[^>]+href=["']([^"']+)["']/gi;
    const found = new Map();
    let match;
    while ((match = hrefRe.exec(html)) !== null) {
        const href = match[1].trim();
        if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:'))
            continue;
        try {
            const abs = new URL(href, pageToScan);
            if (!abs.protocol.startsWith('http'))
                continue;
            if (normalizeHost(abs.hostname) !== targetHost)
                continue;
            const key = `${pageToScan}|${abs.href}`;
            found.set(key, { sourceUrl: pageToScan, targetUrl: abs.href });
        }
        catch {
            /* skip */
        }
    }
    const links = [...found.values()];
    let created = 0;
    for (const link of links) {
        const existing = await prisma_1.default.backlink.findFirst({
            where: { sourceUrl: link.sourceUrl, targetUrl: link.targetUrl, workspaceId },
        });
        if (!existing) {
            await prisma_1.default.backlink.create({
                data: {
                    sourceUrl: link.sourceUrl,
                    targetUrl: link.targetUrl,
                    linkType: 'inbound',
                    status: 'active',
                    workspaceId,
                },
            });
            created++;
        }
    }
    return { discovered: links.length, created, links };
}
