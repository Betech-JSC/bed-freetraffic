"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeContentSchedule = executeContentSchedule;
exports.dispatchDueSchedules = dispatchDueSchedules;
exports.getChannelConnectionStatus = getChannelConnectionStatus;
const prisma_1 = __importDefault(require("../lib/prisma"));
const dispatch_1 = require("../lib/dispatch");
const abTestPublish_1 = require("./abTestPublish");
const scheduleRecurrence_1 = require("./scheduleRecurrence");
async function executeContentSchedule(item) {
    const row = await prisma_1.default.contentSchedule.findUnique({ where: { id: item.id } });
    if (!row) {
        throw new Error('Không tìm thấy lịch');
    }
    await prisma_1.default.contentSchedule.update({
        where: { id: item.id },
        data: { status: 'SENDING', attemptCount: { increment: 1 } },
    });
    const resolved = await (0, abTestPublish_1.resolveAbTestContent)({
        title: row.title,
        content: row.content,
        imageUrl: row.imageUrl,
        urlTarget: row.urlTarget,
        abTestId: row.abTestId,
    });
    const channelResults = await (0, dispatch_1.dispatchToAllPlatforms)(row.platforms, {
        title: resolved.title,
        content: resolved.content,
        imageUrl: resolved.imageUrl,
        urlTarget: resolved.urlTarget || undefined,
        emailRecipients: row.recipients?.trim() || undefined,
        workspaceId: row.workspaceId || undefined,
    });
    const { status, errorMessage } = (0, dispatch_1.summarizeChannelResults)(channelResults);
    await prisma_1.default.contentSchedule.update({
        where: { id: item.id },
        data: {
            status,
            publishedAt: channelResults.some((r) => r.success) ? new Date() : null,
            errorMessage,
            channelResults: JSON.stringify(channelResults),
        },
    });
    await (0, scheduleRecurrence_1.scheduleNextOccurrence)({
        id: row.id,
        scheduledAt: row.scheduledAt,
        repeatRule: row.repeatRule,
        repeatUntil: row.repeatUntil,
        cronExpression: row.cronExpression,
    }, status);
    return { status, channelResults, errorMessage };
}
async function dispatchDueSchedules(limit = 10) {
    const due = await prisma_1.default.contentSchedule.findMany({
        where: { status: 'PENDING', scheduledAt: { lte: new Date() } },
        orderBy: { scheduledAt: 'asc' },
        take: limit,
    });
    for (const item of due) {
        try {
            await executeContentSchedule(item);
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : 'Dispatch failed';
            await prisma_1.default.contentSchedule.update({
                where: { id: item.id },
                data: { status: 'FAILED', errorMessage: msg },
            });
        }
    }
    return due.length;
}
async function getChannelConnectionStatus(workspaceId) {
    const platforms = ['facebook', 'email', 'zalo', 'youtube', 'community'];
    const out = {};
    for (const platform of platforms) {
        const conn = await prisma_1.default.socialConnection.findFirst({
            where: { platform, workspaceId }
        });
        const connected = !!(conn?.status === 'CONNECTED' && conn.accessToken);
        const labels = {
            facebook: conn?.pageName || 'Facebook Page',
            email: conn?.pageName || 'SMTP Email',
            zalo: conn?.pageName || 'Zalo OA',
            youtube: 'YouTube (hướng dẫn đăng tay)',
            community: 'Forum / Community (hướng dẫn đăng tay)',
        };
        const alwaysOn = platform === 'youtube' || platform === 'community';
        out[platform] = { connected: alwaysOn || connected, label: labels[platform] };
    }
    return out;
}
