import prisma from '../lib/prisma';
import {
  dispatchToPlatform,
  parsePlatforms,
  summarizeChannelResults,
  type ChannelResult,
} from '../lib/dispatch';
import { resolveAbTestContent } from './abTestPublish';
import { scheduleNextOccurrence } from './scheduleRecurrence';
import { applyImageOverlay } from '../lib/dispatch/overlay';

export type ScheduleRow = {
  id: number;
  title: string;
  content: string;
  imageUrl: string | null;
  platforms: string;
  urlTarget: string | null;
  recipients: string | null;
  scheduledAt?: Date;
  repeatRule?: string | null;
  repeatUntil?: Date | null;
  abTestId?: number | null;
  overlayText?: string | null;
  overlayWatermark?: string | null;
  overlayPosition?: string | null;
  overlayFontSize?: number | null;
};

export async function executeContentSchedule(
  item: ScheduleRow
): Promise<{ status: string; channelResults: ChannelResult[]; errorMessage: string | null }> {
  const row = await prisma.contentSchedule.findUnique({ where: { id: item.id } });
  if (!row) {
    throw new Error('Không tìm thấy lịch');
  }

  await prisma.contentSchedule.update({
    where: { id: item.id },
    data: { status: 'SENDING', attemptCount: { increment: 1 } },
  });

  const resolved = await resolveAbTestContent({
    title: row.title,
    content: row.content,
    imageUrl: row.imageUrl,
    urlTarget: row.urlTarget,
    abTestId: row.abTestId,
  });

  let finalImageUrl = resolved.imageUrl;
  if (finalImageUrl && (row.overlayText || row.overlayWatermark)) {
    try {
      finalImageUrl = await applyImageOverlay(finalImageUrl, {
        overlayText: row.overlayText,
        overlayWatermark: row.overlayWatermark,
        overlayPosition: row.overlayPosition,
        overlayFontSize: row.overlayFontSize,
      });
    } catch (err) {
      console.error('Failed to apply image overlay:', err);
    }
  }

  let targets: { connectionId: number; platform: string; pageName?: string }[] = [];
  if (row.targetConnectionsJson) {
    try {
      const parsed = JSON.parse(row.targetConnectionsJson);
      if (Array.isArray(parsed)) {
        targets = parsed.map((t: any) => ({
          connectionId: Number(t.connectionId || 0),
          platform: String(t.platform).trim().toLowerCase(),
          pageName: t.pageName ? String(t.pageName) : undefined
        })).filter(t => t.platform);
      }
    } catch {
      // ignore
    }
  }

  // Fallback to platforms string parsing
  if (targets.length === 0) {
    const platformList = parsePlatforms(row.platforms);
    for (const p of platformList) {
      targets.push({ connectionId: 0, platform: p });
    }
  }

  const channelResults: ChannelResult[] = [];

  for (const target of targets) {
    let pageName = target.pageName;
    if (!pageName && target.connectionId > 0) {
      const conn = await prisma.socialConnection.findUnique({ where: { id: target.connectionId } });
      pageName = conn?.pageName || undefined;
    }

    let result;
    try {
      result = await dispatchToPlatform(target.platform, {
        title: resolved.title,
        content: resolved.content,
        imageUrl: finalImageUrl,
        urlTarget: resolved.urlTarget || undefined,
        emailRecipients: target.platform === 'email' ? row.recipients?.trim() || undefined : undefined,
        workspaceId: row.workspaceId || undefined,
        connectionId: target.connectionId > 0 ? target.connectionId : undefined,
      });
    } catch (err: any) {
      result = { success: false, message: `Lỗi thực thi: ${err.message}` };
    }

    channelResults.push({
      platform: pageName ? `${target.platform} (${pageName})` : target.platform,
      success: result.success,
      message: result.message,
      at: new Date().toISOString(),
    });
  }

  const { status, errorMessage } = summarizeChannelResults(channelResults);

  await prisma.contentSchedule.update({
    where: { id: item.id },
    data: {
      status,
      publishedAt: channelResults.some((r) => r.success) ? new Date() : null,
      errorMessage,
      channelResults: JSON.stringify(channelResults),
    },
  });

  await scheduleNextOccurrence(
    {
      id: row.id,
      scheduledAt: row.scheduledAt,
      repeatRule: row.repeatRule,
      repeatUntil: row.repeatUntil,
      cronExpression: row.cronExpression,
    },
    status
  );

  return { status, channelResults, errorMessage };
}

export async function dispatchDueSchedules(limit = 10): Promise<number> {
  const due = await prisma.contentSchedule.findMany({
    where: { status: 'PENDING', scheduledAt: { lte: new Date() } },
    orderBy: { scheduledAt: 'asc' },
    take: limit,
  });

  for (const item of due) {
    try {
      await executeContentSchedule(item);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Dispatch failed';
      await prisma.contentSchedule.update({
        where: { id: item.id },
        data: { status: 'FAILED', errorMessage: msg },
      });
    }
  }

  return due.length;
}

export async function getChannelConnectionStatus(
  workspaceId?: number
): Promise<Record<string, { connected: boolean; label: string }>> {
  const platforms = ['facebook', 'email', 'zalo', 'youtube', 'community'] as const;
  const out: Record<string, { connected: boolean; label: string }> = {};

  for (const platform of platforms) {
    const conn = await prisma.socialConnection.findFirst({
      where: { platform, workspaceId }
    });
    const connected = !!(conn?.status === 'CONNECTED' && conn.accessToken);
    const labels: Record<string, string> = {
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
