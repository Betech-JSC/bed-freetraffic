import { Queue, Worker } from 'bullmq';
import { connection, logRedisError, useRedis } from './connection';
import prisma from '../lib/prisma';
import { createSmtpTransporter, getSmtpConfig } from '../lib/smtp';
import { getAiConfig, fetchWithRetry } from '../lib/ai';

export const cskhFollowupQueue = useRedis ? new Queue('cskh-ai-followup-queue', { connection }) : null;

export const cskhFollowupWorker = useRedis
  ? new Worker(
      'cskh-ai-followup-queue',
      async (job) => {
        // 1. Repeatable Cron Job: Quét các chat session và customer cần chăm sóc
        if (job.name === 'cskh-scanner') {
          const now = new Date();
          const claimTime = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes lock

          // 1a. Quét các ChatSession cần follow-up
          const claimedSessionIds = await prisma.$transaction(async (tx) => {
            const due = await tx.$queryRawUnsafe<{ id: string }[]>(
              `SELECT id FROM "ChatSession"
               WHERE "followUpScheduledAt" <= $1
                 AND "followUpSent" = false
                 AND "customerId" IS NOT NULL
               FOR UPDATE SKIP LOCKED
               LIMIT 20`,
              now
            );
            if (due.length === 0) return [];
            const ids = due.map((s) => s.id);
            await tx.chatSession.updateMany({
              where: { id: { in: ids } },
              data: { followUpScheduledAt: claimTime },
            });
            return ids;
          });

          if (claimedSessionIds.length > 0) {
            console.log(`[cskh-scanner] Khóa thành công ${claimedSessionIds.length} chat sessions. Đang đẩy vào hàng đợi...`);
            for (const sessionId of claimedSessionIds) {
              if (cskhFollowupQueue) {
                await cskhFollowupQueue.add(`followup-${sessionId}`, {
                  type: 'follow-up',
                  sessionId,
                });
              }
            }
          }

          // 1b. Quét các Customer cần auto-care
          const activeConfigs = await prisma.cskhConfig.findMany({
            where: { autoCareEnabled: true },
          });

          let enqueuedAutoCares = 0;
          for (const config of activeConfigs) {
            const workspaceId = config.workspaceId;
            if (!workspaceId) continue;

            let dueCustomerIds: number[] = [];

            await prisma.$transaction(async (tx) => {
              if (config.autoCareScheduleType === 'AFTER_CREATION') {
                const threshold = new Date(Date.now() - config.autoCareDelayHours * 60 * 60 * 1000);
                const rows = await tx.$queryRawUnsafe<{ id: number }[]>(
                  `SELECT id FROM "Customer"
                   WHERE "workspaceId" = $1
                     AND "createdAt" <= $2
                     AND "lastAiCareSentAt" IS NULL
                     AND "status" <> 'INACTIVE'
                   FOR UPDATE SKIP LOCKED
                   LIMIT 50`,
                  workspaceId,
                  threshold
                );
                dueCustomerIds = rows.map((r) => r.id);
              } else if (config.autoCareScheduleType === 'PERIODIC') {
                const threshold = new Date(Date.now() - config.autoCareIntervalDays * 24 * 60 * 60 * 1000);
                const rows = await tx.$queryRawUnsafe<{ id: number }[]>(
                  `SELECT id FROM "Customer"
                   WHERE "workspaceId" = $1
                     AND "status" <> 'INACTIVE'
                     AND ("lastAiCareSentAt" IS NULL OR "lastAiCareSentAt" <= $2)
                   FOR UPDATE SKIP LOCKED
                   LIMIT 50`,
                  workspaceId,
                  threshold
                );
                dueCustomerIds = rows.map((r) => r.id);
              }

              if (dueCustomerIds.length > 0) {
                await tx.customer.updateMany({
                  where: { id: { in: dueCustomerIds } },
                  data: { lastAiCareSentAt: now },
                });
              }
            });

            if (dueCustomerIds.length > 0) {
              console.log(`[cskh-scanner] Workspace ${workspaceId}: Khóa thành công ${dueCustomerIds.length} khách hàng để chăm sóc tự động.`);
              for (const customerId of dueCustomerIds) {
                if (cskhFollowupQueue) {
                  await cskhFollowupQueue.add(`autocare-${workspaceId}-${customerId}`, {
                    type: 'auto-care',
                    customerId,
                    workspaceId,
                    configId: config.id,
                  });
                }
                enqueuedAutoCares++;
              }
            }
          }

          // Quét giỏ hàng bị bỏ quên & khách ngủ đông trong background
          try {
            const { dispatchDueAbandonedCarts, dispatchDueInactiveCustomers } = await import('../workers/cskhFollowupWorker');
            await dispatchDueAbandonedCarts();
            await dispatchDueInactiveCustomers();
          } catch (scanErr) {
            console.error('[cskh-scanner] Lỗi quét giỏ hàng/khách ngủ đông:', scanErr);
          }
 
          return { followUps: claimedSessionIds.length, autoCares: enqueuedAutoCares };
        }

        // 2. Individual Job Handling
        const payload = job.data as {
          type: 'follow-up' | 'auto-care' | 'event-driven-email';
          sessionId?: string;
          customerId?: number;
          workspaceId?: number;
          configId?: number;
          eventType?: string;
          payload?: any;
        };

        if (payload.type === 'event-driven-email') {
          const { eventType, payload: eventPayload } = payload;
          const { processEventEmail } = await import('../services/emailEventTrigger');
          await processEventEmail(eventType!, eventPayload);
          return;
        }

        if (payload.type === 'follow-up') {
          const sessionId = payload.sessionId!;
          console.log(`[Worker: cskh-followup] Xử lý email follow-up cho session ${sessionId}`);

          const session = await prisma.chatSession.findUnique({
            where: { id: sessionId },
            include: {
              customer: true,
              messages: {
                orderBy: { createdAt: 'asc' },
              },
            },
          });

          if (!session) {
            console.warn(`[Worker: cskh-followup] Không tìm thấy session ${sessionId}`);
            return;
          }

          const workspaceId = session.workspaceId;

          // Đọc cấu hình CSKH
          const cskhConfig = await prisma.cskhConfig.findUnique({
            where: { workspaceId },
          });

          if (!cskhConfig || !cskhConfig.followUpDelayHours || cskhConfig.followUpDelayHours <= 0) {
            await prisma.chatSession.update({
              where: { id: sessionId },
              data: { followUpSent: true },
            });
            return;
          }

          if (!session.customer || !session.customer.email) {
            await prisma.chatSession.update({
              where: { id: sessionId },
              data: { followUpSent: true },
            });
            return;
          }

          // Tạo văn bản hội thoại
          const conversationText = session.messages
            .map((m) => `${m.sender === 'visitor' ? 'Khách hàng' : 'Trợ lý ảo AI'}: ${m.content}`)
            .join('\n');

          // 4. Sinh email AI RAG chăm sóc
          const { generateEmailWithRag } = await import('../services/ragEmailService');
          const emailResult = await generateEmailWithRag(workspaceId, 'FOLLOWUP', {
            customerId: session.customer.id,
            customerName: session.customer.name,
            customerEmail: session.customer.email,
            chatHistory: conversationText,
            customMessage: cskhConfig.followUpEmailBody || ''
          });

          const subject = emailResult.subject;
          const htmlBody = emailResult.htmlContent;

          const transporter = await createSmtpTransporter(workspaceId);
          const smtpConfig = await getSmtpConfig(workspaceId);

          if (transporter && smtpConfig) {
            await transporter.sendMail({
              from: `"${smtpConfig.email.split('@')[0]}" <${smtpConfig.email}>`,
              to: session.customer.email,
              subject,
              html: htmlBody,
            });

            await prisma.customerEmailLog.create({
              data: {
                customerId: session.customer.id,
                subject,
                body: htmlBody,
                status: 'SENT',
                sentAt: new Date(),
              },
            });

            console.log(`[Worker: cskh-followup] Đã gửi email follow-up thành công đến ${session.customer.email}`);
          } else {
            console.warn(`[Worker: cskh-followup] SMTP chưa được cấu hình hoặc thiếu email cho session ${session.id}`);
          }

          await prisma.chatSession.update({
            where: { id: sessionId },
            data: { followUpSent: true },
          });
        }

        if (payload.type === 'auto-care') {
          const { customerId, workspaceId, configId } = payload;
          console.log(`[Worker: cskh-autocare] Xử lý AI auto-care cho customer #${customerId} tại workspace #${workspaceId}`);

          const customer = await prisma.customer.findUnique({
            where: { id: customerId },
            include: {
              notes: { orderBy: { createdAt: 'desc' } },
              orders: { orderBy: { createdAt: 'desc' } },
            },
          });

          const config = await prisma.cskhConfig.findUnique({
            where: { id: configId },
          });

          if (!customer || !config || !workspaceId) {
            console.warn(`[Worker: cskh-autocare] Thiếu thông tin customer/config để gửi auto-care.`);
            return;
          }

          const channels = (config.autoCareChannels || 'email')
            .split(',')
            .map((c: string) => c.trim().toLowerCase())
            .filter(Boolean);

          if (channels.length === 0) return;

          let transporter: any = null;
          let smtpConfig: any = null;
          if (channels.includes('email')) {
            transporter = await createSmtpTransporter(workspaceId);
            smtpConfig = await getSmtpConfig(workspaceId);
          }

          let zaloConn: any = null;
          if (channels.includes('zalo')) {
            zaloConn = await prisma.socialConnection.findFirst({
              where: { platform: 'zalo', workspaceId },
            });
          }

          const channelsToTry = [...channels];
          if (channelsToTry.includes('zalo') && !channelsToTry.includes('email') && customer.email) {
            channelsToTry.push('email');
          }

          let sentSuccessfully = false;

          for (const channel of channelsToTry) {
            if (channel === 'email' && !customer.email) continue;
            if (channel === 'zalo' && !customer.zaloUserId && !customer.phone) continue;

            // 4. Sinh email AI RAG chăm sóc
            const { generateEmailWithRag } = await import('../services/ragEmailService');
            const emailResult = await generateEmailWithRag(workspaceId, 'FOLLOWUP', {
              customerId: customer.id,
              customerName: customer.name,
              customerEmail: customer.email,
              customMessage: config.autoCareEmailBody || ''
            });

            let subject = emailResult.subject;
            let messageBody = emailResult.htmlContent;

            let success = false;
            let errorMsg = null;

            let logBody = messageBody;

            if (channel === 'email') {
              if (transporter && smtpConfig) {
                try {
                  const htmlBody = messageBody;
                  logBody = htmlBody;

                  await transporter.sendMail({
                    from: `"${smtpConfig.email.split('@')[0]}" <${smtpConfig.email}>`,
                    to: customer.email,
                    subject,
                    html: htmlBody,
                  });
                  success = true;
                } catch (sendErr: any) {
                  errorMsg = sendErr.message || 'Lỗi gửi email SMTP';
                }
              } else {
                errorMsg = 'SMTP chưa được cấu hình cho Workspace';
              }
            } else if (channel === 'zalo') {
              try {
                if (!zaloConn || zaloConn.status !== 'CONNECTED' || !zaloConn.accessToken) {
                  throw new Error('Chưa kết nối Zalo OA. Vui lòng kết nối Zalo OA trong Cài đặt trước.');
                }

                const plainText = messageBody.replace(/<[^>]+>/g, '');
                const plainSubject = subject.replace(/<[^>]+>/g, '');

                if (customer.zaloUserId) {
                  const zaloRes = await fetch('https://openapi.zalo.me/v3.0/oa/message/cs', {
                    method: 'POST',
                    headers: {
                      access_token: zaloConn.accessToken,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      recipient: {
                        user_id: customer.zaloUserId,
                      },
                      message: {
                        text: `${plainSubject}\n\n${plainText}`,
                      },
                    }),
                  });
                  const zaloData = (await zaloRes.json()) as { error?: number; message?: string };
                  if (zaloData.error !== 0 && zaloData.error !== undefined) {
                    throw new Error(zaloData.message || `Zalo OA API Error code ${zaloData.error}`);
                  }
                  success = true;
                } else if (customer.phone) {
                  let phoneFormatted = customer.phone.replace(/[^0-9]/g, '');
                  if (phoneFormatted.startsWith('0')) {
                    phoneFormatted = '84' + phoneFormatted.substring(1);
                  }

                  const znsTemplateId = process.env.ZALO_ZNS_TEMPLATE_ID || 'default';
                  const znsRes = await fetch('https://business.openapi.zalo.me/message/template', {
                    method: 'POST',
                    headers: {
                      access_token: zaloConn.accessToken,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      phone: phoneFormatted,
                      template_id: znsTemplateId,
                      template_data: {
                        name: customer.name,
                        subject: plainSubject,
                        content: plainText.substring(0, 100),
                      },
                    }),
                  });
                  const znsData = (await znsRes.json()) as { error?: number; message?: string };
                  if (znsData.error !== 0 && znsData.error !== undefined) {
                    throw new Error(`Zalo API error: ${znsData.message || 'Không gửi được tin nhắn'}. Bạn cần liên kết Zalo User ID hoặc đăng ký ZNS Template.`);
                  }
                  success = true;
                } else {
                  throw new Error('Khách hàng này không có Zalo User ID hoặc Số điện thoại để gửi Zalo.');
                }
              } catch (zaloErr: any) {
                errorMsg = zaloErr.message || 'Lỗi gửi tin nhắn Zalo';
              }
            } else if (channel === 'messenger') {
              console.log(`[Worker: cskh-autocare Messenger] Gửi tin nhắn đến khách hàng ${customer.name}: ${messageBody.slice(0, 100)}...`);
              success = true;
            }

            await prisma.customerEmailLog.create({
              data: {
                customerId: customer.id,
                subject,
                body: logBody,
                status: success ? 'SENT' : 'FAILED',
                errorMessage: errorMsg,
                channel,
              },
            });

            if (success) {
              console.log(`[Worker: cskh-autocare] Đã gửi tin nhắn chăm sóc qua ${channel} thành công cho khách hàng ${customer.name}`);
              sentSuccessfully = true;
              break; // Fallback thành công, dừng lại không gửi kênh tiếp theo
            } else {
              console.error(`[Worker: cskh-autocare] Gửi qua ${channel} thất bại cho khách hàng ${customer.name}: ${errorMsg}. Đang thử kênh fallback tiếp theo...`);
            }
          }
        }
      },
      {
        connection,
        concurrency: 3,
      }
    )
  : null;

if (cskhFollowupQueue) {
  cskhFollowupQueue.on('error', (err) => {
    logRedisError('Queue: cskh-followup', err);
  });
}

if (cskhFollowupWorker) {
  cskhFollowupWorker.on('failed', (job, err) => {
    console.error(`[Worker: cskh-followup] Job ${job?.id} thất bại:`, err.message);
  });

  cskhFollowupWorker.on('error', (err) => {
    logRedisError('Worker: cskh-followup', err);
  });
}

