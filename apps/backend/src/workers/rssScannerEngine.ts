import cron from 'node-cron';
import prisma from '../lib/prisma';
import { dispatchToAllPlatforms, parsePlatforms } from '../lib/dispatch';
import { renderContent } from '../lib/dispatch/render';
import { generateAiPostContent, generateAiImage } from '../services/aiGenerate';
import { getRandomTemplate } from '../services/automationTemplate';

function extractTag(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tag}>`, 'i');
  const m = regex.exec(xml);
  return m ? m[1].trim() : '';
}

export const startRssScannerEngine = () => {
  console.log('📰 RSS Reader Bot Engine Started...');

  // Run every 30 minutes
  cron.schedule('*/30 * * * *', async () => {
    try {
      const activeTasks = await prisma.automationTask.findMany({
        where: {
          status: 'RUNNING',
          rssUrl: { not: null }
        }
      });

      for (const task of activeTasks) {
        if (!task.rssUrl) continue;

        console.log(`[RSS BOT] Quét RSS cho chiến dịch: ${task.name} (URL: ${task.rssUrl})`);

        try {
          const response = await fetch(task.rssUrl, { signal: AbortSignal.timeout(15000) });
          if (!response.ok) {
            throw new Error(`Không tải được RSS, status: ${response.status}`);
          }
          const xmlText = await response.text();

          const items: { title: string; link: string; pubDate: string; description: string }[] = [];
          const itemRegex = /<item>([\s\S]*?)<\/item>/g;
          let match;
          while ((match = itemRegex.exec(xmlText)) !== null) {
            const itemXml = match[1];
            const title = extractTag(itemXml, 'title');
            const link = extractTag(itemXml, 'link');
            const pubDate = extractTag(itemXml, 'pubDate');
            const description = extractTag(itemXml, 'description');
            if (title && link) {
              items.push({ title, link, pubDate, description });
            }
          }

          if (items.length === 0) {
            console.log(`[RSS BOT] Không tìm thấy bài viết nào trong RSS: ${task.rssUrl}`);
            continue;
          }

          const parsedItems = items.map(item => {
            const time = Date.parse(item.pubDate);
            return {
              ...item,
              timestamp: Number.isNaN(time) ? Date.now() : time
            };
          });

          // Sort oldest to newest
          parsedItems.sort((a, b) => a.timestamp - b.timestamp);

          const latestItem = parsedItems[parsedItems.length - 1];

          let itemsToPublish: typeof parsedItems = [];
          const prevPubDate = task.rssLastPubDate;

          if (!prevPubDate) {
            // First run: just publish the single latest item to verify it works, then save state
            itemsToPublish = [latestItem];
          } else {
            const refTime = Date.parse(prevPubDate);
            const refTimestamp = Number.isNaN(refTime) ? 0 : refTime;
            itemsToPublish = parsedItems.filter(x => x.timestamp > refTimestamp);

            // Cap to maximum 3 items to avoid spamming channels in one run
            if (itemsToPublish.length > 3) {
              itemsToPublish = itemsToPublish.slice(-3);
            }
          }

          if (itemsToPublish.length === 0) {
            console.log(`[RSS BOT] Không có bài viết mới kể từ ${prevPubDate || 'lần chạy trước'}`);
            continue;
          }

          let targets: { connectionId: number; platform: string; pageName?: string }[] = [];
          if (task.targetConnectionsJson) {
            try {
              const parsed = JSON.parse(task.targetConnectionsJson);
              if (Array.isArray(parsed)) {
                targets = parsed.map((t: any) => ({
                  connectionId: Number(t.connectionId),
                  platform: String(t.platform).trim().toLowerCase(),
                  pageName: t.pageName ? String(t.pageName) : undefined
                })).filter(t => t.connectionId && t.platform);
              }
            } catch {
              // ignore
            }
          }

          if (targets.length === 0) {
            const platformList = parsePlatforms(task.platforms);
            for (const p of platformList) {
              targets.push({ connectionId: 0, platform: p });
            }
          }

          const { dispatchToPlatform } = await import('../lib/dispatch');

          for (const item of itemsToPublish) {
            console.log(`[RSS BOT] Đang đăng bài viết mới: "${item.title}"`);

            for (const target of targets) {
              let pageName = target.pageName;
              if (!pageName && target.connectionId > 0) {
                const conn = await prisma.socialConnection.findUnique({ where: { id: target.connectionId } });
                pageName = conn?.pageName || undefined;
              }

              let title = item.title;
              let content = '';
              let imageUrl: string | null = null;

              if (task.useAi) {
                try {
                  const originalPrompt = task.aiPrompt || '';
                  const customPrompt = pageName 
                    ? `${originalPrompt}\n\n[Lưu ý quan trọng]: Viết nội dung này dành riêng cho đối tượng độc giả và mang bản sắc thương hiệu của trang '${pageName}'. Điều chỉnh giọng văn và cấu trúc câu để khác biệt so với các bài đăng khác.`
                    : originalPrompt;
                  
                  const aiResult = await generateAiPostContent(item.link, customPrompt);
                  title = aiResult.title;
                  content = aiResult.content;
                  if (task.aiGenerateImage) {
                    imageUrl = await generateAiImage(title);
                  }
                } catch (err: any) {
                  console.error('[RSS BOT AI ERROR]:', err);
                  // Fallback to template/default if AI fails
                  const template = await getRandomTemplate(task.id);
                  if (template) {
                    title = template.title;
                    content = renderContent(template.content, {
                      urlTarget: item.link,
                      name: item.title,
                      description: item.description,
                      date: item.pubDate,
                    });
                    imageUrl = template.thumbnailUrl || template.imageUrl;
                  } else {
                    content = `${item.description || item.title}\n\nXem chi tiết tại: {url}`;
                  }
                }
              } else {
                const template = await getRandomTemplate(task.id);
                if (template) {
                  title = template.title;
                  content = renderContent(template.content, {
                    urlTarget: item.link,
                    name: item.title,
                    description: item.description,
                    date: item.pubDate,
                  });
                  imageUrl = template.thumbnailUrl || template.imageUrl;
                } else {
                  content = `${item.description || item.title}\n\nXem chi tiết tại: {url}`;
                }
              }

              // Replace {url} placeholder with actual item link if not done by renderer/AI
              content = content.replace(/\{url\}/g, item.link);

              // Dispatch to the target connection
              let result;
              try {
                result = await dispatchToPlatform(target.platform, {
                  title,
                  content,
                  imageUrl,
                  urlTarget: item.link,
                  emailRecipients: task.emailRecipients || undefined,
                  workspaceId: task.workspaceId || undefined,
                  connectionId: target.connectionId > 0 ? target.connectionId : undefined,
                });
              } catch (err: any) {
                result = { success: false, message: `Lỗi thực thi: ${err.message}` };
              }

              // Log results
              const displayTarget = pageName ? `${target.platform} (${pageName})` : target.platform;
              await prisma.botLog.create({
                data: {
                  taskId: task.id,
                  action: `RSS_POST_${target.platform.toUpperCase()}`,
                  message: `[RSS][Trang: ${pageName || 'Mặc định'}] ${result.message} | Bài viết: "${item.title}"`,
                  status: result.success ? 'SUCCESS' : 'ERROR'
                }
              });
              console.log(`  -> [RSS][${displayTarget}] ${result.message}`);
            }
          }

          // Update task rssLastPubDate to the latest processed item
          await prisma.automationTask.update({
            where: { id: task.id },
            data: {
              rssLastPubDate: latestItem.pubDate,
              lastRunAt: new Date()
            }
          });

        } catch (err: any) {
          console.error(`[RSS BOT ERROR] Lỗi khi xử lý tác vụ ${task.name}:`, err.message);
          await prisma.botLog.create({
            data: {
              taskId: task.id,
              action: 'RSS_SCAN',
              message: `Lỗi quét RSS: ${err.message}`,
              status: 'ERROR'
            }
          });
        }
      }
    } catch (error) {
      console.error('[RSS BOT GENERAL ERROR]:', error);
    }
  });
};
