"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../lib/prisma"));
const reportPdf_1 = require("../services/reportPdf");
const reportExcel_1 = require("../services/reportExcel");
const auth_1 = require("../middleware/auth");
const cache_1 = require("../lib/cache");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
router.get('/traffic', async (req, res) => {
    const days = parseInt(req.query.days || '30');
    const cacheKey = `ws:${req.workspaceId}:report:traffic:${days}`;
    try {
        const cached = await cache_1.cache.get(cacheKey);
        if (cached) {
            res.json(cached);
            return;
        }
        const since = new Date();
        since.setDate(since.getDate() - days);
        const snapshots = await prisma_1.default.analyticsSnapshot.findMany({
            where: { date: { gte: since }, channelType: 'all', workspaceId: req.workspaceId },
            orderBy: { date: 'asc' },
        });
        const rows = snapshots.map((s) => ({
            date: s.date.toISOString().slice(0, 10),
            sessions: s.sessions,
            users: s.users,
            pageviews: s.pageviews,
            clicks: s.clicks,
            impressions: s.impressions,
        }));
        const result = { rows, total: rows.length };
        await cache_1.cache.set(cacheKey, result, 60); // Cache for 60 seconds
        res.json(result);
    }
    catch (error) {
        console.error('[GET /reports/traffic]', error);
        res.status(500).json({ error: 'Lỗi máy chủ' });
    }
});
router.get('/keywords', async (req, res) => {
    const cacheKey = `ws:${req.workspaceId}:report:keywords`;
    try {
        const cached = await cache_1.cache.get(cacheKey);
        if (cached) {
            res.json(cached);
            return;
        }
        const keywords = await prisma_1.default.seoKeyword.findMany({
            where: { workspaceId: req.workspaceId },
            include: {
                channel: { select: { name: true } },
                rankHistory: { orderBy: { recordedAt: 'desc' }, take: 1 },
            },
            orderBy: { keyword: 'asc' },
        });
        const rows = keywords.map((k) => ({
            keyword: k.keyword,
            url: k.url,
            position: k.currentPosition,
            searchVolume: k.searchVolume,
            channel: k.channel?.name,
            lastClicks: k.rankHistory[0]?.clicks,
            lastImpressions: k.rankHistory[0]?.impressions,
        }));
        const result = { rows };
        await cache_1.cache.set(cacheKey, result, 60); // Cache for 60 seconds
        res.json(result);
    }
    catch (error) {
        console.error('[GET /reports/keywords]', error);
        res.status(500).json({ error: 'Lỗi máy chủ' });
    }
});
router.get('/export/csv', async (req, res) => {
    const type = req.query.type || 'traffic';
    const days = parseInt(req.query.days || '30');
    const since = new Date();
    since.setDate(since.getDate() - days);
    let csv = '';
    let filename = 'report.csv';
    try {
        if (type === 'keywords') {
            const keywords = await prisma_1.default.seoKeyword.findMany({
                where: { workspaceId: req.workspaceId },
                include: { channel: true }
            });
            csv = 'keyword,url,position,searchVolume,channel\n';
            for (const k of keywords) {
                csv += `"${k.keyword}","${k.url || ''}",${k.currentPosition ?? ''},${k.searchVolume ?? ''},"${k.channel?.name || ''}"\n`;
            }
            filename = 'keywords-report.csv';
        }
        else {
            const snapshots = await prisma_1.default.analyticsSnapshot.findMany({
                where: { date: { gte: since }, channelType: 'all', workspaceId: req.workspaceId },
                orderBy: { date: 'asc' },
            });
            csv = 'date,sessions,users,pageviews,clicks,impressions\n';
            for (const s of snapshots) {
                csv += `${s.date.toISOString().slice(0, 10)},${s.sessions},${s.users},${s.pageviews},${s.clicks},${s.impressions}\n`;
            }
            filename = 'traffic-report.csv';
        }
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send('\uFEFF' + csv);
    }
    catch (error) {
        console.error('[GET /reports/export/csv]', error);
        res.status(500).send('Lỗi xuất file');
    }
});
router.get('/export/xlsx', async (req, res) => {
    const type = req.query.type || 'traffic';
    const days = parseInt(req.query.days || '30');
    const since = new Date();
    since.setDate(since.getDate() - days);
    let xml = '';
    let filename = 'report.xls';
    try {
        if (type === 'keywords') {
            const keywords = await prisma_1.default.seoKeyword.findMany({
                where: { workspaceId: req.workspaceId },
                include: { channel: { select: { name: true } } },
                orderBy: { keyword: 'asc' },
            });
            xml = (0, reportExcel_1.buildSpreadsheetXml)(['keyword', 'url', 'position', 'searchVolume', 'channel'], keywords.map((k) => [k.keyword, k.url, k.currentPosition, k.searchVolume, k.channel?.name]));
            filename = 'keywords-report.xls';
        }
        else {
            const snapshots = await prisma_1.default.analyticsSnapshot.findMany({
                where: { date: { gte: since }, channelType: 'all', workspaceId: req.workspaceId },
                orderBy: { date: 'asc' },
            });
            xml = (0, reportExcel_1.buildSpreadsheetXml)(['date', 'sessions', 'users', 'pageviews', 'clicks', 'impressions'], snapshots.map((s) => [
                s.date.toISOString().slice(0, 10),
                s.sessions,
                s.users,
                s.pageviews,
                s.clicks,
                s.impressions,
            ]));
            filename = 'traffic-report.xls';
        }
        res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send('\uFEFF' + xml);
    }
    catch (error) {
        console.error('[GET /reports/export/xlsx]', error);
        res.status(500).send('Lỗi xuất file');
    }
});
router.get('/export/pdf', async (req, res) => {
    const type = req.query.type || 'traffic';
    const days = parseInt(req.query.days || '30');
    const since = new Date();
    since.setDate(since.getDate() - days);
    try {
        if (type === 'keywords') {
            const keywords = await prisma_1.default.seoKeyword.findMany({
                where: { workspaceId: req.workspaceId },
                include: { channel: { select: { name: true } } },
                orderBy: { keyword: 'asc' },
            });
            const rows = keywords.map((k) => ({
                keyword: k.keyword,
                url: k.url,
                position: k.currentPosition,
                searchVolume: k.searchVolume,
                channel: k.channel?.name,
            }));
            const pdf = await (0, reportPdf_1.buildKeywordsPdf)(rows);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename="keywords-report.pdf"');
            res.send(pdf);
            return;
        }
        const snapshots = await prisma_1.default.analyticsSnapshot.findMany({
            where: { date: { gte: since }, channelType: 'all', workspaceId: req.workspaceId },
            orderBy: { date: 'asc' },
        });
        const rows = snapshots.map((s) => ({
            date: s.date.toISOString().slice(0, 10),
            sessions: s.sessions,
            users: s.users,
            pageviews: s.pageviews,
            clicks: s.clicks,
            impressions: s.impressions,
        }));
        const pdf = await (0, reportPdf_1.buildTrafficPdf)(rows, days);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="traffic-report.pdf"');
        res.send(pdf);
    }
    catch (err) {
        console.error('PDF export:', err);
        res.status(500).json({ error: 'Không tạo được PDF' });
    }
});
exports.default = router;
