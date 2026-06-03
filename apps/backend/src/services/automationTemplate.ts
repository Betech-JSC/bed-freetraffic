import prisma from '../lib/prisma';
import { resolveAbTestContent } from './abTestPublish';
import { generateAiPostContent, generateAiImage } from './aiGenerate';

export type ResolvedPost = {
  title: string;
  content: string;
  imageUrl: string | null;
  urlTarget: string;
};

async function getRandomTemplate(taskId: number) {
  const templates = await prisma.postTemplate.findMany({
    where: {
      isActive: true,
      OR: [{ taskId }, { taskId: null }],
    },
  });
  if (templates.length === 0) return null;
  return templates[Math.floor(Math.random() * templates.length)];
}

export async function resolveAutomationPost(task: {
  id: number;
  name: string;
  urlTarget: string;
  abTestId?: number | null;
  useAi?: boolean;
  aiPrompt?: string | null;
  aiGenerateImage?: boolean;
}): Promise<ResolvedPost | null> {
  if (task.useAi) {
    try {
      console.log(`[AI GENERATOR] Tác vụ ${task.name} đang dùng AI để tạo bài đăng...`);
      const generated = await generateAiPostContent(task.urlTarget, task.aiPrompt);
      let imageUrl: string | null = null;
      if (task.aiGenerateImage) {
        console.log(`[AI GENERATOR] Tạo hình ảnh cho bài đăng: "${generated.title}"...`);
        imageUrl = await generateAiImage(generated.title);
      }
      return {
        title: generated.title,
        content: generated.content,
        imageUrl,
        urlTarget: task.urlTarget,
      };
    } catch (err: any) {
      console.error('[AI GENERATOR ERROR] Gặp lỗi khi tạo bài đăng bằng AI:', err.message);
      throw new Error(`AI lỗi: ${err.message}`);
    }
  }

  if (task.abTestId) {
    const r = await resolveAbTestContent({
      title: task.name,
      content: 'Khám phá thêm tại {url}',
      imageUrl: null,
      urlTarget: task.urlTarget,
      abTestId: task.abTestId,
    });
    return {
      title: r.title,
      content: r.content,
      imageUrl: r.imageUrl,
      urlTarget: r.urlTarget ?? task.urlTarget,
    };
  }

  const template = await getRandomTemplate(task.id);
  if (!template) return null;

  return {
    title: template.title,
    content: template.content,
    imageUrl: template.thumbnailUrl || template.imageUrl,
    urlTarget: task.urlTarget,
  };
}
