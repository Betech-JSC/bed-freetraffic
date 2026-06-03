import prisma from '../lib/prisma';
import cronParser from 'cron-parser';

type ScheduleRecurrence = {
  id: number;
  scheduledAt: Date;
  repeatRule: string | null;
  repeatUntil: Date | null;
  cronExpression?: string | null;
};

export async function scheduleNextOccurrence(
  item: ScheduleRecurrence,
  publishStatus: string
): Promise<void> {
  if (!item.repeatRule) return;
  if (publishStatus !== 'PUBLISHED' && publishStatus !== 'PARTIAL') return;

  const rule = item.repeatRule.toLowerCase();
  let next = new Date(item.scheduledAt);

  if (rule === 'daily') {
    next.setDate(next.getDate() + 1);
  } else if (rule === 'weekly') {
    next.setDate(next.getDate() + 7);
  } else if (rule === 'cron') {
    if (!item.cronExpression) {
      await prisma.contentSchedule.update({
        where: { id: item.id },
        data: { repeatRule: null },
      });
      return;
    }
    try {
      const interval = cronParser.parse(item.cronExpression, { currentDate: item.scheduledAt });
      next = interval.next().toDate();
    } catch (err) {
      console.error('[Recurrence] Loi parse cron expression:', err);
      await prisma.contentSchedule.update({
        where: { id: item.id },
        data: { 
          repeatRule: null, 
          errorMessage: 'Quy tac lap Cron khong hop le: ' + (err instanceof Error ? err.message : String(err)) 
        },
      });
      return;
    }
  } else {
    return;
  }

  if (item.repeatUntil && next > item.repeatUntil) {
    await prisma.contentSchedule.update({
      where: { id: item.id },
      data: { repeatRule: null },
    });
    return;
  }

  await prisma.contentSchedule.update({
    where: { id: item.id },
    data: {
      status: 'PENDING',
      scheduledAt: next,
      publishedAt: null,
      errorMessage: null,
      channelResults: null,
    },
  });
}
