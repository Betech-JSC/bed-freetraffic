import prisma from '../lib/prisma';
import {
  dispatchToAllPlatforms,
  summarizeChannelResults,
  type ChannelResult,
} from '../lib/dispatch';
import { resolveAbTestContent } from './abTestPublish';
import { scheduleNextOccurrence } from './scheduleRecurrence';

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

  const channelResults = await dispatchToAllPlatforms(row.platforms, {
    title: resolved.title,
    content: resolved.content,
    imageUrl: resolved.imageUrl,
    urlTarget: resolved.urlTarget || undefined,
    emailRecipients: row.recipients?.trim() || undefined,
  });

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

export async function getChannelConnectionStatus(): Promise<
  Record<string, { connected: boolean; label: string }>
> {
  const platforms = ['facebook', 'email', 'zalo', 'youtube', 'community'] as const;
  const out: Record<string, { connected: boolean; label: string }> = {};

  for (const platform of platforms) {
    const conn = await prisma.socialConnection.findUnique({ where: { platform } });
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
