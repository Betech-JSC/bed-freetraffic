import cron from 'node-cron';
import prisma from '../lib/prisma';
import { runPageSpeedAudit } from '../services/pagespeedAuditService';

export async function auditAllPagesWithPageSpeed() {
  console.log('⚡ [PageSpeed Auditor] Bắp đầu quét PageSpeed Insights hàng tuần...');
  
  // 1. Get distinct URLs previously audited
  const audits = await prisma.seoAudit.findMany({
    distinct: ['url'],
    select: { url: true },
  });
  const auditedUrls = audits.map((a) => a.url).filter(Boolean);

  // 2. Get active website channel URLs
  const channels = await prisma.channel.findMany({
    where: { 
      url: { not: null },
      status: 'ACTIVE'
    },
    select: { url: true },
  });
  const channelUrls = channels.map((c) => c.url as string).filter(Boolean);

  // Combine and deduplicate
  const allUrls = Array.from(new Set([...auditedUrls, ...channelUrls]));

  if (allUrls.length === 0) {
    console.log('⚡ [PageSpeed Auditor] Không tìm thấy URL nào cần quét.');
    return;
  }

  let successCount = 0;
  for (const url of allUrls) {
    try {
      console.log(`⚡ [PageSpeed Auditor] Đang quét: ${url}`);
      const result = await runPageSpeedAudit(url);
      
      await prisma.seoAudit.create({
        data: {
          url,
          score: result.score,
          technicalScore: result.technicalScore,
          contentScore: result.contentScore,
          uxScore: result.uxScore,
          issues: { create: result.issues },
        },
      });
      successCount++;
    } catch (err: any) {
      console.error(`⚡ [PageSpeed Auditor Error] Thất bại khi quét ${url}:`, err.message || err);
    }
  }

  console.log(`⚡ [PageSpeed Auditor] Đã hoàn thành quét PageSpeed tự động cho ${successCount}/${allUrls.length} trang.`);
}

export function startPageSpeedAuditorEngine() {
  console.log('⚡ PageSpeed Auditor Engine Started...');
  // Run weekly: Sunday at 3:00 AM
  cron.schedule('0 3 * * 0', async () => {
    try {
      await auditAllPagesWithPageSpeed();
    } catch (err) {
      console.error('[PageSpeed Auditor Engine Cron Error]:', err);
    }
  });
}
