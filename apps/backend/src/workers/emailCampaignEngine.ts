import prisma from '../lib/prisma';
import { sendEmailCampaign } from '../services/emailCampaignSend';
import { emailCampaignQueue } from '../queues/emailCampaignQueue';
import { useRedis } from '../queues/connection';

export async function dispatchDueCampaigns(): Promise<void> {
  const now = new Date();
  try {
    const due = await prisma.emailCampaign.findMany({
      where: {
        status: 'SCHEDULED',
        scheduledAt: { lte: now },
      },
      orderBy: { scheduledAt: 'asc' },
    });

    if (due.length > 0) {
      console.log(`[EmailCampaignEngine (No-Redis)] Phát hiện ${due.length} chiến dịch đến hạn gửi. Đang xử lý trực tiếp...`);
      for (const c of due) {
        // Cập nhật trạng thái thành PROCESSING tránh bị trùng lặp
        await prisma.emailCampaign.update({
          where: { id: c.id },
          data: { status: 'PROCESSING' },
        });

        // Chạy bất đồng bộ để không chặn tiến trình quét chính
        (async () => {
          try {
            console.log(`[EmailCampaignEngine (No-Redis)] Bắt đầu xử lý chiến dịch #${c.id}...`);
            const result = await sendEmailCampaign(c.id);
            console.log(`[EmailCampaignEngine (No-Redis)] Gửi thành công chiến dịch #${c.id}: ${result.sent}/${result.total} email.`);
          } catch (err: any) {
            console.error(`[EmailCampaignEngine (No-Redis)] Thất bại khi gửi chiến dịch #${c.id}:`, err);
            await prisma.emailCampaign.update({
              where: { id: c.id },
              data: { status: 'FAILED' },
            });
          }
        })();
      }
    }
  } catch (error) {
    console.error(`[EmailCampaignEngine (No-Redis)] Lỗi quét chiến dịch:`, error);
  }
}

export function startEmailCampaignEngine() {
  if (useRedis && emailCampaignQueue) {
    emailCampaignQueue.add(
      'campaign-scanner',
      {},
      {
        repeat: {
          every: 60_000,
        },
        jobId: 'campaign-scanner',
      }
    ).then(() => {
      console.log('✅ Email campaign scheduler — Đã đăng ký repeatable job BullMQ (quét mỗi 60 giây)');
    }).catch((err) => {
      console.error('[EmailCampaignEngine] Lỗi đăng ký repeatable job:', err);
    });
  } else {
    console.log('✅ Email campaign scheduler — Đang khởi chạy ở chế độ Local Fallback (quét mỗi 60 giây sử dụng setInterval)');
    // Quét ngay lập tức khi khởi chạy
    dispatchDueCampaigns();
    setInterval(() => {
      dispatchDueCampaigns();
    }, 60_000);
  }
}

