import cron from 'node-cron';
import prisma from '../lib/prisma';
import { scrapeFacebookGroup } from '../services/socialListeningScraper';
import { qualifyLead } from '../services/leadQualifierService';
import { sendTelegramAlert } from '../services/telegramService';
import { getEmbedding, cosineSimilarity } from '../lib/embeddings';

/**
 * Executes the social listening scraping, filtering, AI qualification,
 * and Telegram alert routing for a specific campaign.
 */
export async function executeCampaignScan(campaignId: number): Promise<{ success: boolean; postsCount: number; leadsFound: number; error?: string }> {
  const campaign = await prisma.socialListeningCampaign.findUnique({
    where: { id: campaignId },
  });

  if (!campaign) {
    throw new Error(`Campaign with ID ${campaignId} not found.`);
  }

  if (!campaign.facebookCookie) {
    return { success: false, postsCount: 0, leadsFound: 0, error: 'Facebook Cookie not configured.' };
  }

  const groupUrlsList = campaign.groupUrls
    .split(',')
    .map(g => g.trim())
    .filter(Boolean);

  let totalPostsScraped = 0;
  let totalLeadsFound = 0;

  for (const groupUrl of groupUrlsList) {
    try {
      console.log(`[Social Listening] Scraping group: ${groupUrl} for campaign: ${campaign.name}`);
      const posts = await scrapeFacebookGroup(groupUrl, campaign.facebookCookie);
      totalPostsScraped += posts.length;

      // Ensure cookie status is marked ACTIVE if we successfully scrape
      if (campaign.cookieStatus !== 'ACTIVE') {
        await prisma.socialListeningCampaign.update({
          where: { id: campaign.id },
          data: { cookieStatus: 'ACTIVE' },
        });
      }

      // Accent removal helper for Vietnamese search matching
      const removeAccents = (str: string): string => {
        return str
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/đ/g, 'd')
          .replace(/Đ/g, 'd');
      };

      // Helper to check if a single keyword (which could be a phrase) matches the content flexibly
      const checkSingleKeywordMatch = (kw: string, contentLower: string, contentNoAccent: string): boolean => {
        // 1. Try exact match
        if (contentLower.includes(kw)) return true;

        // 2. Try web/website synonyms
        if (kw.includes('web') && !kw.includes('website')) {
          const alt = kw.replace(/\bweb\b/g, 'website');
          if (contentLower.includes(alt)) return true;
        }
        if (kw.includes('website')) {
          const alt = kw.replace(/\bwebsite\b/g, 'web');
          if (contentLower.includes(alt)) return true;
        }

        // 3. Try accent-insensitive exact match
        const kwNoAccent = removeAccents(kw);
        if (contentNoAccent.includes(kwNoAccent)) return true;

        // 4. Try word-proximity / all words match (for phrases)
        const kwWords = kwNoAccent.split(/\s+/).filter(w => w.length > 1); // ignore single chars
        if (kwWords.length > 1) {
          const allWordsPresent = kwWords.every(word => {
            if (word === 'web' || word === 'website') {
              return contentNoAccent.includes('web') || contentNoAccent.includes('website');
            }
            return contentNoAccent.includes(word);
          });
          if (allWordsPresent) return true;
        }

        return false;
      };

      // Keyword pre-filtering
      const keywords = campaign.keywords
        .split(',')
        .map(k => k.trim().toLowerCase())
        .filter(Boolean);
        
      const excludeKeywords = campaign.excludeKeywords
        ? campaign.excludeKeywords.split(',').map(k => k.trim().toLowerCase()).filter(Boolean)
        : [];

      // Pre-compute query embedding if semantic filter is enabled
      let queryEmbedding: number[] | null = null;
      if (campaign.enableSemanticFilter) {
        queryEmbedding = await getEmbedding(campaign.keywords);
      }

      for (const post of posts) {
        // ----------------------------------------------------
        // A. PROCESS MAIN POST
        // ----------------------------------------------------
        const processPost = async () => {
          // Check if log already exists
          const existingLog = await prisma.socialListeningLog.findFirst({
            where: {
              campaignId: campaign.id,
              postUrl: post.postUrl,
              isComment: false,
            },
          });

          if (existingLog) return; // Skip already processed posts

          const contentLower = post.content.toLowerCase();
          const contentNoAccent = removeAccents(contentLower);

          // 1. Negative keyword check first
          const matchesExclude = excludeKeywords.some(ex => {
            const exNoAccent = removeAccents(ex);
            return contentLower.includes(ex) || contentNoAccent.includes(exNoAccent);
          });
          if (matchesExclude) return;

          // 2. Keyword check or Semantic Filter
          let isMatch = false;
          if (campaign.enableSemanticFilter && queryEmbedding) {
            const postEmbedding = await getEmbedding(post.content);
            if (postEmbedding) {
              const similarity = cosineSimilarity(queryEmbedding, postEmbedding);
              isMatch = similarity >= campaign.semanticThreshold;
              console.log(`[Social Listening] Semantic similarity for post: ${similarity.toFixed(3)} (Threshold: ${campaign.semanticThreshold})`);
            }
          } else {
            isMatch = keywords.some(k => checkSingleKeywordMatch(k, contentLower, contentNoAccent));
          }

          if (!isMatch) return;

          // 3. AI Qualification
          console.log(`[Social Listening] Qualifying potential lead from: ${post.authorName}`);
          const aiResult = await qualifyLead(
            campaign.workspaceId,
            post.content,
            campaign.keywords,
            campaign.excludeKeywords,
            campaign.targetAudience,
            campaign.id
          );

          // 4. Create log
          const log = await prisma.socialListeningLog.create({
            data: {
              campaignId: campaign.id,
              postUrl: post.postUrl,
              postAuthor: post.authorName,
              authorAvatar: post.authorAvatar,
              postContent: post.content,
              aiScore: aiResult.score,
              aiDecision: aiResult.decision,
              aiReason: aiResult.reason,
              aiDraftMsg: aiResult.draftMsg,
              isComment: false,
              status: 'PENDING',
            },
          });

          // 5. Telegram Notifications
          if (campaign.telegramEnabled && aiResult.score >= campaign.minScore && aiResult.decision !== 'SPAM') {
            totalLeadsFound++;
            
            const draftMsgBlock = aiResult.draftMsg 
              ? `💬 *Kịch bản phản hồi gợi ý (chạm để copy)*:\n\`\`\`\n${aiResult.draftMsg}\n\`\`\`\n\n` 
              : '';

            const alertText = `🔥 *PHÁT HIỆN KHÁCH HÀNG TIỀM NĂNG (${aiResult.decision})* - Điểm: *${aiResult.score}/100*\n\n` +
              `👥 *Người đăng*: ${post.authorName}\n` +
              `📌 *Chiến dịch*: ${campaign.name}\n\n` +
              `📝 *Nội dung bài viết*:\n"${post.content.slice(0, 350)}${post.content.length > 350 ? '...' : ''}"\n\n` +
              `💡 *Nhận định AI*:\n${aiResult.reason}\n\n` +
              draftMsgBlock +
              `🔗 [Xem bài viết trên Facebook](${post.postUrl})`;

            const replyMarkup = {
              inline_keyboard: [
                [
                  {
                    text: '🔗 Đi tới bài viết Facebook',
                    url: post.postUrl
                  }
                ]
              ]
            };

            try {
              await sendTelegramAlert(campaign.telegramBotToken, campaign.telegramChatId, alertText, replyMarkup);
              await prisma.socialListeningLog.update({
                where: { id: log.id },
                data: { status: 'NOTIFIED' },
              });
            } catch (teleErr: any) {
              console.error(`[Social Listening] Telegram Alert Error: ${teleErr.message}`);
              await prisma.socialListeningLog.update({
                where: { id: log.id },
                data: { status: 'ERROR', errorMessage: teleErr.message },
              });
            }
          } else {
            // Qualification is COLD, SPAM or below minScore threshold, mark ignored
            await prisma.socialListeningLog.update({
              where: { id: log.id },
              data: { status: 'IGNORED' },
            });
          }
        };

        await processPost();

        // ----------------------------------------------------
        // B. PROCESS COMMENTS (IF ENABLED)
        // ----------------------------------------------------
        if (campaign.scrapeComments && post.comments && post.comments.length > 0) {
          for (const comment of post.comments) {
            const processComment = async () => {
              // Check if log already exists
              const existingLog = await prisma.socialListeningLog.findFirst({
                where: {
                  campaignId: campaign.id,
                  commentId: comment.commentId,
                  isComment: true,
                },
              });

              if (existingLog) return; // Skip already processed comments

              const contentLower = comment.content.toLowerCase();
              const contentNoAccent = removeAccents(contentLower);

              // 1. Negative keyword check first
              const matchesExclude = excludeKeywords.some(ex => {
                const exNoAccent = removeAccents(ex);
                return contentLower.includes(ex) || contentNoAccent.includes(exNoAccent);
              });
              if (matchesExclude) return;

              // 2. Keyword check or Semantic Filter
              let isMatch = false;
              if (campaign.enableSemanticFilter && queryEmbedding) {
                const commentEmbedding = await getEmbedding(comment.content);
                if (commentEmbedding) {
                  const similarity = cosineSimilarity(queryEmbedding, commentEmbedding);
                  isMatch = similarity >= campaign.semanticThreshold;
                  console.log(`[Social Listening] Semantic similarity for comment by ${comment.authorName}: ${similarity.toFixed(3)} (Threshold: ${campaign.semanticThreshold})`);
                }
              } else {
                isMatch = keywords.some(k => checkSingleKeywordMatch(k, contentLower, contentNoAccent));
              }

              if (!isMatch) return;

              // 3. AI Qualification
              console.log(`[Social Listening] Qualifying potential comment lead from: ${comment.authorName}`);
              const aiResult = await qualifyLead(
                campaign.workspaceId,
                comment.content,
                campaign.keywords,
                campaign.excludeKeywords,
                campaign.targetAudience,
                campaign.id
              );

              // 4. Create log
              const log = await prisma.socialListeningLog.create({
                data: {
                  campaignId: campaign.id,
                  postUrl: post.postUrl, // point to parent post url
                  postAuthor: comment.authorName,
                  authorAvatar: null,
                  postContent: comment.content,
                  aiScore: aiResult.score,
                  aiDecision: aiResult.decision,
                  aiReason: aiResult.reason,
                  aiDraftMsg: aiResult.draftMsg,
                  isComment: true,
                  commentId: comment.commentId,
                  parentPostAuthor: post.authorName,
                  status: 'PENDING',
                },
              });

              // 5. Telegram Notifications
              if (campaign.telegramEnabled && aiResult.score >= campaign.minScore && aiResult.decision !== 'SPAM') {
                totalLeadsFound++;
                
                const draftMsgBlock = aiResult.draftMsg 
                  ? `💬 *Kịch bản phản hồi gợi ý (chạm để copy)*:\n\`\`\`\n${aiResult.draftMsg}\n\`\`\`\n\n` 
                  : '';

                const alertText = `💬 *PHÁT HIỆN BÌNH LUẬN TIỀM NĂNG (${aiResult.decision})* - Điểm: *${aiResult.score}/100*\n\n` +
                  `👤 *Người bình luận*: ${comment.authorName}\n` +
                  `📝 *Tại bài đăng của*: ${post.authorName}\n` +
                  `📌 *Chiến dịch*: ${campaign.name}\n\n` +
                  `💬 *Nội dung bình luận*:\n"${comment.content.slice(0, 350)}${comment.content.length > 350 ? '...' : ''}"\n\n` +
                  `💡 *Nhận định AI*:\n${aiResult.reason}\n\n` +
                  draftMsgBlock +
                  `🔗 [Xem bình luận trên Facebook](${post.postUrl})`;

                const replyMarkup = {
                  inline_keyboard: [
                    [
                      {
                        text: '🔗 Đi tới bài viết Facebook',
                        url: post.postUrl
                      }
                    ]
                  ]
                };

                try {
                  await sendTelegramAlert(campaign.telegramBotToken, campaign.telegramChatId, alertText, replyMarkup);
                  await prisma.socialListeningLog.update({
                    where: { id: log.id },
                    data: { status: 'NOTIFIED' },
                  });
                } catch (teleErr: any) {
                  console.error(`[Social Listening] Telegram Alert Error for comment: ${teleErr.message}`);
                  await prisma.socialListeningLog.update({
                    where: { id: log.id },
                    data: { status: 'ERROR', errorMessage: teleErr.message },
                  });
                }
              } else {
                // Qualification is COLD, SPAM or below minScore threshold, mark ignored
                await prisma.socialListeningLog.update({
                  where: { id: log.id },
                  data: { status: 'IGNORED' },
                });
              }
            };

            await processComment();
          }
        }
      }
    } catch (err: any) {
      console.error(`[Social Listening Campaign Scan Error]:`, err.message);
      
      if (err.message === 'COOKIE_EXPIRED') {
        // Mark cookie status as EXPIRED
        await prisma.socialListeningCampaign.update({
          where: { id: campaign.id },
          data: { cookieStatus: 'EXPIRED' },
        });

        // Notify user about expired cookie
        const warningText = `⚠️ *Cảnh báo: Cookie Facebook Hết Hạn*\n\n` +
          `Chiến dịch: *${campaign.name}*\n` +
          `Phiên quét facebook đã bị ngắt kết nối do Cookie hết hạn hoặc không hoạt động. Vui lòng kết nối lại tài khoản Facebook bằng cách nhập Cookie thủ công trên Dashboard Be Traffic.`;
        
        try {
          await sendTelegramAlert(campaign.telegramBotToken, campaign.telegramChatId, warningText);
        } catch (teleErr: any) {
          console.error(`Failed to send Telegram cookie warning: ${teleErr.message}`);
        }
        
        return { success: false, postsCount: totalPostsScraped, leadsFound: totalLeadsFound, error: 'COOKIE_EXPIRED' };
      }
      
      return { success: false, postsCount: totalPostsScraped, leadsFound: totalLeadsFound, error: err.message };
    }
  }

  try {
    await prisma.socialListeningCampaign.update({
      where: { id: campaign.id },
      data: { lastScannedAt: new Date() },
    });
  } catch (dbErr: any) {
    console.error(`[Social Listening] Failed to update lastScannedAt: ${dbErr.message}`);
  }

  return { success: true, postsCount: totalPostsScraped, leadsFound: totalLeadsFound };
}

/**
 * Scrapes all active campaigns that are due for scanning
 */
export async function runSocialListeningScan() {
  console.log('🤖 [Social Listening Worker] Starting periodic scan of all active campaigns...');
  try {
    const activeCampaigns = await prisma.socialListeningCampaign.findMany({
      where: { isActive: true },
    });

    const now = new Date();
    const campaignsToScan = activeCampaigns.filter(campaign => {
      if (!campaign.lastScannedAt) return true; // Never scanned before
      const nextScanTime = new Date(campaign.lastScannedAt.getTime() + campaign.scanInterval * 60 * 1000);
      return nextScanTime <= now;
    });

    console.log(`[Social Listening Worker] Found ${activeCampaigns.length} active campaigns. ${campaignsToScan.length} are due for scan.`);
    for (const campaign of campaignsToScan) {
      await executeCampaignScan(campaign.id);
    }
    console.log('🤖 [Social Listening Worker] Periodic scan completed.');
  } catch (err: any) {
    console.error('❌ [Social Listening Worker Error]:', err.message);
  }
}

/**
 * Registers the node-cron task to scan social listening campaigns periodically.
 */
export function startSocialListeningEngine() {
  console.log('🤖 AI Social Listening Engine Registered (Every minute check)');

  // Run every minute to check for campaigns due for scanning
  cron.schedule('* * * * *', async () => {
    try {
      await runSocialListeningScan();
    } catch (err) {
      console.error('[Social Listening Engine Cron Error]:', err);
    }
  });

  // Run once immediately on start for testing unless disabled
  if (process.env.TRIGGER_LISTENING_ON_START === 'true') {
    console.log('[Social Listening Engine] Triggering immediate scan (TRIGGER_LISTENING_ON_START=true)...');
    runSocialListeningScan().catch(err => {
      console.error('[Social Listening Engine] Immediate scan error:', err);
    });
  }
}
