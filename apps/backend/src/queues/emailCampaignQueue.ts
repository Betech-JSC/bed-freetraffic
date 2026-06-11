import { Queue, Worker } from 'bullmq';
import { connection, logRedisError, useRedis } from './connection';
import prisma from '../lib/prisma';
import { sendEmailCampaign } from '../services/emailCampaignSend';

export const emailCampaignQueue = useRedis ? new Queue('email-campaign-queue', { connection }) : null;

export const emailCampaignWorker = useRedis
  ? new Worker(
      'email-campaign-queue',
      async (job) => {
        const now = new Date();
        
        // 1. Repeatable Cron Job: Quét các chiến dịch đặt lịch
        if (job.name === 'campaign-scanner') {
          const due = await prisma.emailCampaign.findMany({
            where: {
              status: 'SCHEDULED',
              scheduledAt: { lte: now },
            },
            orderBy: { scheduledAt: 'asc' },
          });

          if (due.length > 0) {
            console.log(`[campaign-scanner] Phát hiện ${due.length} chiến dịch đến hạn gửi. Đang đẩy vào hàng đợi...`);
            for (const c of due) {
              // Cập nhật trạng thái thành QUEUED để tránh quét lặp lại
              await prisma.emailCampaign.update({
                where: { id: c.id },
                data: { status: 'QUEUED' },
              });

              if (emailCampaignQueue) {
                await emailCampaignQueue.add(`campaign-${c.id}`, { campaignId: c.id });
              }
            }
          }
          return { scanned: due.length };
        }

        // 2. Individual Job: Gửi một chiến dịch cụ thể
        const { campaignId } = job.data as { campaignId: number };
        console.log(`[Worker: email-campaign] Bắt đầu xử lý chiến dịch #${campaignId}...`);

        await prisma.emailCampaign.update({
          where: { id: campaignId },
          data: { status: 'PROCESSING' },
        });

        try {
          const result = await sendEmailCampaign(campaignId);
          console.log(`[Worker: email-campaign] Gửi thành công chiến dịch #${campaignId}: ${result.sent}/${result.total} email.`);
          return result;
        } catch (err: any) {
          console.error(`[Worker: email-campaign] Thất bại khi gửi chiến dịch #${campaignId}:`, err);
          await prisma.emailCampaign.update({
            where: { id: campaignId },
            data: { status: 'FAILED' },
          });
          throw err;
        }
      },
      {
        connection,
        concurrency: 2, // Cho phép xử lý tối đa 2 chiến dịch cùng lúc
      }
    )
  : null;

if (emailCampaignQueue) {
  emailCampaignQueue.on('error', (err) => {
    logRedisError('Queue: email-campaign', err);
  });
}

if (emailCampaignWorker) {
  emailCampaignWorker.on('failed', (job, err) => {
    console.error(`[Worker: email-campaign] Job ${job?.id} thất bại:`, err.message);
  });

  emailCampaignWorker.on('error', (err) => {
    logRedisError('Worker: email-campaign', err);
  });
}

