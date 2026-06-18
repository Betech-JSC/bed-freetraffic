import cron from 'node-cron';
import prisma from '../lib/prisma';
import { scrapeFacebookGroup } from '../services/socialListeningScraper';
import { qualifyLead } from '../services/leadQualifierService';
import { sendTelegramAlert } from '../services/telegramService';
import { getEmbedding, cosineSimilarity } from '../lib/embeddings';

function cleanFacebookUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    urlObj.search = '';
    return urlObj.toString();
  } catch (e) {
    return url;
  }
}

function extractPostIdFromUrl(url: string): string | null {
  const match = url.match(/(?:\/posts\/|\/permalink\/|story_fbid=)(\d+)/);
  return match ? match[1] : null;
}

const removeAccents = (str: string): string => {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd');
};

const normalizeContentForDeduplication = (str: string): string => {
  return removeAccents(str.toLowerCase())
    .replace(/[^a-z0-9]/g, ''); // keep only raw alphanumeric characters
};

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

  // Resolve Telegram Credentials: use campaign level or fallback to workspace connection settings
  let finalBotToken = campaign.telegramBotToken;
  let finalChatId = campaign.telegramChatId;

  if (campaign.telegramEnabled && (!finalBotToken || !finalChatId)) {
    const defaultTgConn = await prisma.socialConnection.findFirst({
      where: {
        platform: 'telegram',
        workspaceId: campaign.workspaceId,
        status: 'CONNECTED',
      },
    });
    if (defaultTgConn) {
      if (!finalBotToken) finalBotToken = defaultTgConn.accessToken;
      if (!finalChatId) finalChatId = defaultTgConn.pageId;
    }
  }

  const groupUrlsList = campaign.groupUrls
    .split(',')
    .map(g => g.trim())
    .filter(Boolean);

  let totalPostsScraped = 0;
  let totalLeadsFound = 0;

  // Pre-fetch recent logs for deduplication
  const recentLogs = await prisma.socialListeningLog.findMany({
    where: {
      campaignId: campaign.id,
      isComment: false,
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: { postUrl: true, postContent: true, postAuthor: true }
  });

  const recentCommentLogs = await prisma.socialListeningLog.findMany({
    where: {
      campaignId: campaign.id,
      isComment: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: { commentId: true, postContent: true, postAuthor: true }
  });

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
        // Filter by maxPostAgeHours if set (greater than 0)
        if (campaign.maxPostAgeHours && campaign.maxPostAgeHours > 0) {
          const maxAgeMs = campaign.maxPostAgeHours * 60 * 60 * 1000;
          const postTimeMs = post.creationTime
            ? post.creationTime * 1000
            : post.createdAtText ? new Date(post.createdAtText).getTime() : null;

          if (postTimeMs && (Date.now() - postTimeMs > maxAgeMs)) {
            console.log(`[Social Listening] Post ${post.postId} ignored: age (${Math.round((Date.now() - postTimeMs) / 3600000)}h) exceeds limit of ${campaign.maxPostAgeHours} hours.`);
            continue;
          }
        }

        // ----------------------------------------------------
        // A. PROCESS MAIN POST
        // ----------------------------------------------------
        const processPost = async () => {
          const cleanedUrl = cleanFacebookUrl(post.postUrl);
          const currentPostId = extractPostIdFromUrl(post.postUrl);

          // 1. Check if URL already exists in recent logs (raw or cleaned, or same post ID)
          const isUrlDuplicate = recentLogs.some(log => {
            if (log.postUrl === post.postUrl || log.postUrl === cleanedUrl) return true;
            if (currentPostId) {
              const logPostId = extractPostIdFromUrl(log.postUrl);
              if (logPostId === currentPostId) return true;
            }
            return false;
          });

          if (isUrlDuplicate) return;

          // Check database directly as fallback if not in recent logs
          const existingLog = await prisma.socialListeningLog.findFirst({
            where: {
              campaignId: campaign.id,
              isComment: false,
              OR: [
                { postUrl: post.postUrl },
                { postUrl: cleanedUrl },
                ...(currentPostId ? [{ postUrl: { contains: currentPostId } }] : [])
              ]
            },
          });

          if (existingLog) return;

          // 2. Check if content is a duplicate (same author and text, or same long text from different author)
          const currentNormalized = normalizeContentForDeduplication(post.content);
          if (currentNormalized.length > 20) {
            const isContentDuplicate = recentLogs.some(log => {
              const logNormalized = normalizeContentForDeduplication(log.postContent);
              return logNormalized === currentNormalized && (currentNormalized.length > 40 || log.postAuthor === post.authorName);
            });

            if (isContentDuplicate) {
              console.log(`[Social Listening] Duplicate content detected for post by ${post.authorName}. Skipping.`);
              return;
            }
          }

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
              postUrl: cleanedUrl,
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

          // Add newly qualified log to cache to prevent duplicates within the same scan
          recentLogs.unshift({ postUrl: cleanedUrl, postContent: post.content, postAuthor: post.authorName });

          // 5. Telegram Notifications
          if (campaign.telegramEnabled && aiResult.score >= campaign.minScore && aiResult.decision !== 'SPAM') {
            totalLeadsFound++;
            
            const draftMsgBlock = aiResult.draftMsg 
              ? `💬 *Kịch bản phản hồi gợi ý (chạm để copy)*:\n\`\`\`\n${aiResult.draftMsg}\n\`\`\`\n\n` 
              : '';

            const alertText = `🔥 *PHÁT HIỆN KHÁCH HÀNG TIỀM NĂNG (${aiResult.decision})* - Điểm: *${aiResult.score}/100*\n\n` +
              `👥 *Người đăng*: ${post.authorName}\n` +
              `📌 *Chiến dịch*: ${campaign.name}\n\n` +
              `📝 *Nội dung bài viết*:\n"${post.content.slice(0, 100)}${post.content.length > 100 ? '...' : ''}"\n\n` +
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
              await sendTelegramAlert(finalBotToken, finalChatId, alertText, replyMarkup);
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

            // Autopilot comment reply trigger for post
            if (campaign.autopilot && aiResult.draftMsg) {
              const minDelay = campaign.autopilotDelayMin || 3;
              const maxDelay = campaign.autopilotDelayMax || 7;
              const delaySeconds = Math.floor(Math.random() * (maxDelay - minDelay + 1) + minDelay) * 60;
              console.log(`[Social Listening Autopilot] Scheduling comment reply for post ${post.postUrl} in ${delaySeconds} seconds...`);
              
              setTimeout(async () => {
                try {
                  // Fetch the latest state of the log to ensure it wasn't cancelled
                  const currentLog = await prisma.socialListeningLog.findUnique({
                    where: { id: log.id }
                  });

                  if (!currentLog || currentLog.autopilotCancelled || currentLog.repliedContent) {
                    console.log(`[Social Listening Autopilot] Comment reply skipped for log #${log.id} (cancelled or already replied)`);
                    return;
                  }

                  const { postFacebookComment } = await import('../services/facebookReply');
                  if (campaign.facebookCookie) {
                    const success = await postFacebookComment(
                      campaign.facebookCookie,
                      post.postUrl,
                      aiResult.draftMsg
                    );
                    if (success) {
                      await prisma.socialListeningLog.update({
                        where: { id: log.id },
                        data: {
                          repliedContent: aiResult.draftMsg,
                          repliedAt: new Date(),
                          status: 'NOTIFIED'
                        }
                      });
                      console.log(`[Social Listening Autopilot] Comment reply sent successfully for log #${log.id}`);
                    }
                  }
                } catch (autoErr: any) {
                  console.error(`❌ [Social Listening Autopilot Error] Failed to send comment reply for log #${log.id}:`, autoErr.message);
                }
              }, delaySeconds * 1000);
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
              // 1. Check if comment ID already exists
              const isCommentIdDuplicate = recentCommentLogs.some(log => log.commentId === comment.commentId);
              if (isCommentIdDuplicate) return;

              // Check database directly as fallback
              const existingLog = await prisma.socialListeningLog.findFirst({
                where: {
                  campaignId: campaign.id,
                  commentId: comment.commentId,
                  isComment: true,
                },
              });

              if (existingLog) return; // Skip already processed comments

              // 2. Check if comment content is duplicate
              const currentCommentNormalized = normalizeContentForDeduplication(comment.content);
              if (currentCommentNormalized.length > 15) {
                const isCommentDuplicate = recentCommentLogs.some(log => {
                  const logNormalized = normalizeContentForDeduplication(log.postContent);
                  return logNormalized === currentCommentNormalized && log.postAuthor === comment.authorName;
                });

                if (isCommentDuplicate) {
                  console.log(`[Social Listening] Duplicate comment content detected by ${comment.authorName}. Skipping.`);
                  return;
                }
              }

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

              // Add newly qualified comment to cache
              recentCommentLogs.unshift({ commentId: comment.commentId, postContent: comment.content, postAuthor: comment.authorName });

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
                  `💬 *Nội dung bình luận*:\n"${comment.content.slice(0, 100)}${comment.content.length > 100 ? '...' : ''}"\n\n` +
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
                  await sendTelegramAlert(finalBotToken, finalChatId, alertText, replyMarkup);
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

                // Autopilot comment reply trigger for comment
                if (campaign.autopilot && aiResult.draftMsg) {
                  const minDelay = campaign.autopilotDelayMin || 3;
                  const maxDelay = campaign.autopilotDelayMax || 7;
                  const delaySeconds = Math.floor(Math.random() * (maxDelay - minDelay + 1) + minDelay) * 60;
                  console.log(`[Social Listening Autopilot] Scheduling reply for comment ${comment.commentId} in ${delaySeconds} seconds...`);
                  
                  setTimeout(async () => {
                    try {
                      // Fetch the latest state of the log to ensure it wasn't cancelled
                      const currentLog = await prisma.socialListeningLog.findUnique({
                        where: { id: log.id }
                      });

                      if (!currentLog || currentLog.autopilotCancelled || currentLog.repliedContent) {
                        console.log(`[Social Listening Autopilot] Comment reply skipped for comment log #${log.id} (cancelled or already replied)`);
                        return;
                      }

                      const { postFacebookComment } = await import('../services/facebookReply');
                      if (campaign.facebookCookie) {
                        const success = await postFacebookComment(
                          campaign.facebookCookie,
                          post.postUrl,
                          aiResult.draftMsg,
                          comment.commentId
                        );
                        if (success) {
                          await prisma.socialListeningLog.update({
                            where: { id: log.id },
                            data: {
                              repliedContent: aiResult.draftMsg,
                              repliedAt: new Date(),
                              status: 'NOTIFIED'
                            }
                          });
                          console.log(`[Social Listening Autopilot] Reply sent successfully for comment log #${log.id}`);
                        }
                      }
                    } catch (autoErr: any) {
                      console.error(`❌ [Social Listening Autopilot Error] Failed to send reply for comment log #${log.id}:`, autoErr.message);
                    }
                  }, delaySeconds * 1000);
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
          await sendTelegramAlert(finalBotToken, finalChatId, warningText);
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
