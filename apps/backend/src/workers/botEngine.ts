import cron from 'node-cron';
import prisma from '../lib/prisma';
import { resolveAutomationPost } from '../services/automationTemplate';

function parsePlatforms(platformsStr: string | null | undefined): string[] {
  if (!platformsStr) return ['facebook'];
  const trimmed = platformsStr.trim();
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((p: any) => String(p).trim().toLowerCase()).filter(Boolean);
      }
    } catch (err) {
      // ignore and fall through
    }
  }
  return trimmed
    .split(',')
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
}

/** @deprecated Dùng lib/dispatch — giữ cho tương thích nội bộ */
export async function publishScheduledContent(opts: {
  title: string;
  content: string;
  imageUrl?: string | null;
  urlTarget?: string;
  platform: string;
  emailRecipients?: string;
}): Promise<{ success: boolean; message: string }> {
  const { dispatchToPlatform } = await import('../lib/dispatch');
  return dispatchToPlatform(opts.platform, {
    title: opts.title,
    content: opts.content,
    imageUrl: opts.imageUrl,
    urlTarget: opts.urlTarget,
    emailRecipients: opts.emailRecipients,
  });
}

export async function executeAutomationTask(task: any) {
  console.log(`[BOT] Thực thi: ${task.name} (ID: ${task.id})`);

  const platforms = parsePlatforms(task.platforms);

  if (platforms.length === 0) {
    console.log(`[BOT] Tác vụ ${task.name} không cấu hình kênh đăng nào.`);
    await prisma.automationTask.update({
      where: { id: task.id },
      data: { lastRunAt: new Date() }
    });
    return;
  }

  const resolved = await resolveAutomationPost(task);
  if (!resolved) {
    const errorMsg = '⚠️ Chưa có nội dung bài đăng. Vui lòng tạo trong Content Editor hoặc gắn A/B test.';
    for (const platform of platforms) {
      await prisma.botLog.create({
        data: {
          taskId: task.id,
          action: `POST_${platform.toUpperCase()}`,
          message: errorMsg,
          status: 'ERROR'
        }
      });
      console.log(`  -> [${platform}] ${errorMsg}`);
    }
    await prisma.automationTask.update({
      where: { id: task.id },
      data: { lastRunAt: new Date() }
    });
    return;
  }

  const { dispatchToPlatform } = await import('../lib/dispatch');

  for (const platform of platforms) {
    let result;
    try {
      result = await dispatchToPlatform(platform, {
        title: resolved.title,
        content: resolved.content,
        imageUrl: resolved.imageUrl,
        urlTarget: resolved.urlTarget,
        emailRecipients: task.emailRecipients || undefined,
        workspaceId: task.workspaceId || undefined,
      });
    } catch (err: any) {
      result = { success: false, message: `Lỗi thực thi: ${err.message}` };
    }

    await prisma.botLog.create({
      data: {
        taskId: task.id,
        action: `POST_${platform.toUpperCase()}`,
        message: result.message,
        status: result.success ? 'SUCCESS' : 'ERROR'
      }
    });

    console.log(`  -> [${platform}] ${result.message}`);
  }

  await prisma.automationTask.update({
    where: { id: task.id },
    data: { lastRunAt: new Date() }
  });
}

export const startBots = () => {
  console.log("🤖 Automation Bot Engine Started...");

  cron.schedule('* * * * *', async () => {
    try {
      const activeTasks = await prisma.automationTask.findMany({
        where: { status: 'RUNNING' }
      });

      const now = new Date();

      for (const task of activeTasks) {
        const lastRun = task.lastRunAt?.getTime() || 0;
        const intervalMs = task.interval * 60 * 1000;

        if (now.getTime() - lastRun >= intervalMs) {
          await executeAutomationTask(task);
        }
      }
    } catch (error) {
      console.error("[BOT ENGINE ERROR]:", error);
    }
  });
};
