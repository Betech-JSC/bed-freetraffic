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

  // Fallback to platforms string parsing
  if (targets.length === 0) {
    const platformList = parsePlatforms(task.platforms);
    for (const p of platformList) {
      targets.push({ connectionId: 0, platform: p });
    }
  }

  if (targets.length === 0) {
    console.log(`[BOT] Tác vụ ${task.name} không cấu hình kênh đăng nào.`);
    await prisma.automationTask.update({
      where: { id: task.id },
      data: { lastRunAt: new Date() }
    });
    return;
  }

  const { dispatchToPlatform } = await import('../lib/dispatch');

  for (const target of targets) {
    let pageName = target.pageName;
    if (!pageName && target.connectionId > 0) {
      const conn = await prisma.socialConnection.findUnique({ where: { id: target.connectionId } });
      pageName = conn?.pageName || undefined;
    }

    // AI Content Spin
    let taskToResolve = { ...task };
    if (task.useAi && pageName) {
      const originalPrompt = task.aiPrompt || '';
      const customPrompt = `${originalPrompt}\n\n[Lưu ý quan trọng]: Viết nội dung này dành riêng cho đối tượng độc giả và mang bản sắc thương hiệu của trang '${pageName}'. Điều chỉnh giọng văn và cấu trúc câu để khác biệt so với các bài đăng khác.`;
      taskToResolve.aiPrompt = customPrompt;
    }

    const resolved = await resolveAutomationPost(taskToResolve);
    if (!resolved) {
      const errorMsg = `⚠️ Chưa có nội dung bài đăng cho trang ${pageName || target.platform}.`;
      await prisma.botLog.create({
        data: {
          taskId: task.id,
          action: `POST_${target.platform.toUpperCase()}`,
          message: errorMsg,
          status: 'ERROR'
        }
      });
      console.log(`  -> [${target.platform}] ${errorMsg}`);
      continue;
    }

    let result;
    try {
      result = await dispatchToPlatform(target.platform, {
        title: resolved.title,
        content: resolved.content,
        imageUrl: resolved.imageUrl,
        urlTarget: resolved.urlTarget,
        emailRecipients: task.emailRecipients || undefined,
        workspaceId: task.workspaceId || undefined,
        connectionId: target.connectionId > 0 ? target.connectionId : undefined,
      });
    } catch (err: any) {
      result = { success: false, message: `Lỗi thực thi: ${err.message}` };
    }

    const displayTarget = pageName ? `${target.platform} (${pageName})` : target.platform;
    await prisma.botLog.create({
      data: {
        taskId: task.id,
        action: `POST_${target.platform.toUpperCase()}`,
        message: pageName ? `[Trang: ${pageName}] ${result.message}` : result.message,
        status: result.success ? 'SUCCESS' : 'ERROR'
      }
    });

    console.log(`  -> [${displayTarget}] ${result.message}`);
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
