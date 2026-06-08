"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startAlertEngine = startAlertEngine;
const prisma_1 = __importDefault(require("../lib/prisma"));
const nodemailer_1 = __importDefault(require("nodemailer"));
const CHECK_MS = 60 * 60 * 1000;
const DEDUPE_HOURS = 24;
async function sumSessionsBetween(from, to) {
    const rows = await prisma_1.default.analyticsSnapshot.findMany({
        where: { date: { gte: from, lte: to }, channelType: 'all' },
    });
    return rows.reduce((s, r) => s + r.sessions, 0);
}
async function getMetricValue(metric) {
    const since = new Date();
    since.setDate(since.getDate() - 1);
    if (metric === 'sessions' || metric === 'traffic') {
        return sumSessionsBetween(since, new Date());
    }
    if (metric === 'clicks' || metric === 'organic') {
        const rows = await prisma_1.default.analyticsSnapshot.findMany({
            where: { date: { gte: since }, channelType: 'all' },
        });
        return rows.reduce((s, r) => s + r.clicks, 0);
    }
    if (metric === 'keywords') {
        return prisma_1.default.seoKeyword.count();
    }
    /** % giảm sessions 7 ngày gần nhất so với 7 ngày trước đó */
    if (metric === 'sessions_drop_pct') {
        const now = new Date();
        const last7End = new Date(now);
        const last7Start = new Date(now);
        last7Start.setDate(last7Start.getDate() - 7);
        const prev7End = new Date(last7Start);
        const prev7Start = new Date(last7Start);
        prev7Start.setDate(prev7Start.getDate() - 7);
        const last7 = await sumSessionsBetween(last7Start, last7End);
        const prev7 = await sumSessionsBetween(prev7Start, prev7End);
        if (prev7 <= 0)
            return 0;
        const dropPct = ((prev7 - last7) / prev7) * 100;
        return Math.round(dropPct * 10) / 10;
    }
    /** Số audit SEO thất bại (HTTP/critical) trong 24h */
    if (metric === 'crawl_errors') {
        const dayAgo = new Date();
        dayAgo.setDate(dayAgo.getDate() - 1);
        const failed = await prisma_1.default.seoAudit.count({
            where: { auditedAt: { gte: dayAgo }, score: { lte: 10 } },
        });
        return failed;
    }
    return 0;
}
function compare(value, threshold, comparison) {
    if (comparison === 'gt')
        return value > threshold;
    if (comparison === 'gte')
        return value >= threshold;
    if (comparison === 'eq')
        return value === threshold;
    if (comparison === 'lte')
        return value <= threshold;
    return value < threshold;
}
async function shouldFireRule(ruleId) {
    const since = new Date();
    since.setHours(since.getHours() - DEDUPE_HOURS);
    const recent = await prisma_1.default.alertLog.findFirst({
        where: { ruleId, createdAt: { gte: since } },
    });
    return !recent;
}
async function notifyEmail(to, subject, text) {
    if (!process.env.SMTP_USER)
        return;
    const transporter = nodemailer_1.default.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: false,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to,
        subject,
        text,
    });
}
function startAlertEngine() {
    setInterval(async () => {
        const rules = await prisma_1.default.alertRule.findMany({ where: { enabled: true } });
        for (const rule of rules) {
            try {
                const value = await getMetricValue(rule.metric);
                if (!compare(value, rule.threshold, rule.comparison))
                    continue;
                if (!(await shouldFireRule(rule.id)))
                    continue;
                const message = `Cảnh báo "${rule.name}": ${rule.metric} = ${value} (${rule.comparison} ${rule.threshold})`;
                await prisma_1.default.alertLog.create({
                    data: { ruleId: rule.id, message, severity: 'WARNING' },
                });
                if (rule.notifyEmail) {
                    try {
                        await notifyEmail(rule.notifyEmail, `[Free Traffic] ${rule.name}`, message);
                    }
                    catch (err) {
                        console.error('[AlertEngine] email:', err);
                    }
                }
            }
            catch (err) {
                console.error(`[AlertEngine] rule ${rule.id}:`, err);
            }
        }
    }, CHECK_MS);
    console.log('✅ Alert engine started (dedupe 24h, metrics: sessions_drop_pct, crawl_errors)');
}
