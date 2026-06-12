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
const overlay_1 = require("../lib/dispatch/overlay");
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
    let finalImageUrl = resolved.imageUrl;
    if (finalImageUrl && (row.overlayText || row.overlayWatermark)) {
        try {
            finalImageUrl = await (0, overlay_1.applyImageOverlay)(finalImageUrl, {
                overlayText: row.overlayText,
                overlayWatermark: row.overlayWatermark,
                overlayPosition: row.overlayPosition,
                overlayFontSize: row.overlayFontSize,
            });
        }
        catch (err) {
            console.error('Failed to apply image overlay:', err);
        }
    }
    let targets = [];
    if (row.targetConnectionsJson) {
        try {
            const parsed = JSON.parse(row.targetConnectionsJson);
            if (Array.isArray(parsed)) {
                targets = parsed.map((t) => ({
                    connectionId: Number(t.connectionId || 0),
                    platform: String(t.platform).trim().toLowerCase(),
                    pageName: t.pageName ? String(t.pageName) : undefined
                })).filter(t => t.platform);
            }
        }
        catch {
            // ignore
        }
    }
    // Fallback to platforms string parsing
    if (targets.length === 0) {
        const platformList = (0, dispatch_1.parsePlatforms)(row.platforms);
        for (const p of platformList) {
            targets.push({ connectionId: 0, platform: p });
        }
    }
    const channelResults = [];
    for (const target of targets) {
        let pageName = target.pageName;
        if (!pageName && target.connectionId > 0) {
            const conn = await prisma_1.default.socialConnection.findUnique({ where: { id: target.connectionId } });
            pageName = conn?.pageName || undefined;
        }
        let targetUrlTarget = resolved.urlTarget || undefined;
        if (row.utmTagEnabled && targetUrlTarget) {
            try {
                const u = new URL(targetUrlTarget);
                if (!u.searchParams.has('utm_source')) {
                    u.searchParams.set('utm_source', target.platform);
                    u.searchParams.set('utm_medium', target.platform === 'email' ? 'email' : 'social');
                    u.searchParams.set('utm_campaign', `post-${row.id}`);
                    targetUrlTarget = u.toString();
                }
            }
            catch {
                const separator = targetUrlTarget.includes('?') ? '&' : '?';
                targetUrlTarget = `${targetUrlTarget}${separator}utm_source=${target.platform}&utm_medium=${target.platform === 'email' ? 'email' : 'social'}&utm_campaign=post-${row.id}`;
            }
        }
        let result;
        try {
            result = await (0, dispatch_1.dispatchToPlatform)(target.platform, {
                title: resolved.title,
                content: resolved.content,
                imageUrl: finalImageUrl,
                urlTarget: targetUrlTarget,
                emailRecipients: target.platform === 'email' ? row.recipients?.trim() || undefined : undefined,
                workspaceId: row.workspaceId || undefined,
                connectionId: target.connectionId > 0 ? target.connectionId : undefined,
            });
        }
        catch (err) {
            result = { success: false, message: `Lỗi thực thi: ${err.message}` };
        }
        channelResults.push({
            platform: pageName ? `${target.platform} (${pageName})` : target.platform,
            success: result.success,
            message: result.message,
            at: new Date().toISOString(),
        });
    }
    const { status, errorMessage } = (0, dispatch_1.summarizeChannelResults)(channelResults);
    let finalStatus = status;
    if (status === 'FAILED') {
        finalStatus = await handleFailedScheduleRetry(item.id, errorMessage || 'Unknown error', channelResults);
    }
    else {
        await prisma_1.default.contentSchedule.update({
            where: { id: item.id },
            data: {
                status,
                publishedAt: channelResults.some((r) => r.success) ? new Date() : null,
                errorMessage,
                channelResults: JSON.stringify(channelResults),
            },
        });
    }
    await (0, scheduleRecurrence_1.scheduleNextOccurrence)({
        id: row.id,
        scheduledAt: row.scheduledAt,
        repeatRule: row.repeatRule,
        repeatUntil: row.repeatUntil,
        cronExpression: row.cronExpression,
    }, finalStatus);
    return { status: finalStatus, channelResults, errorMessage };
}
async function handleFailedScheduleRetry(id, errorMessage, channelResults) {
    const row = await prisma_1.default.contentSchedule.findUnique({
        where: { id },
        select: { attemptCount: true }
    });
    const currentAttempts = row?.attemptCount || 1;
    if (currentAttempts < 3) {
        const delayMinutes = Math.pow(2, currentAttempts); // 2 mins, 4 mins
        const nextRun = new Date(Date.now() + delayMinutes * 60 * 1000);
        await prisma_1.default.contentSchedule.update({
            where: { id },
            data: {
                status: 'PENDING',
                scheduledAt: nextRun,
                errorMessage: `[Thử lại ${currentAttempts}/3 thất bại: ${errorMessage}]. Sẽ thử lại sau ${delayMinutes} phút.`,
                channelResults: channelResults ? JSON.stringify(channelResults) : undefined,
            },
        });
        return 'PENDING';
    }
    else {
        await prisma_1.default.contentSchedule.update({
            where: { id },
            data: {
                status: 'FAILED',
                errorMessage: `[Thử lại thất bại hoàn toàn sau 3 lần]: ${errorMessage}`,
                channelResults: channelResults ? JSON.stringify(channelResults) : undefined,
            },
        });
        return 'FAILED';
    }
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
            await handleFailedScheduleRetry(item.id, msg);
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
