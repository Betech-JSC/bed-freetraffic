import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireWrite } from '../middleware/auth';
import { WorkspaceRequest } from '../middleware/workspace';
import { cache, invalidateWorkspaceCache } from '../lib/cache';
import multer from 'multer';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { syncKnowledgeBaseEmbeddings } from '../lib/embeddings';

const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});


// Load CSKH Config
router.get('/config', authenticate, async (req: WorkspaceRequest, res: Response): Promise<void> => {
  const cacheKey = `ws:${req.workspaceId}:cskh-config`;
  try {
    const cached = await cache.get<any>(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    let config = await prisma.cskhConfig.findUnique({
      where: { workspaceId: req.workspaceId },
    });
    if (!config) {
      config = await prisma.cskhConfig.create({
        data: {
          workspaceId: req.workspaceId,
          liveChatEnabled: false,
          aiChatbotEnabled: false,
        },
      });
    }
    await cache.set(cacheKey, config, 600); // Cache for 10 minutes
    res.json(config);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi lấy cấu hình CSKH' });
  }
});

// Save CSKH Config
router.post('/config', authenticate, requireWrite, async (req: WorkspaceRequest, res: Response): Promise<void> => {
  try {
    const {
      liveChatEnabled,
      aiChatbotEnabled,
      knowledgeBaseText,
      notificationChannels,
      followUpDelayHours,
      followUpEmailSubject,
      followUpEmailBody,
      // new fields
      autoCareEnabled,
      autoCareScheduleType,
      autoCareDelayHours,
      autoCareIntervalDays,
      autoCareEmailSubject,
      autoCareEmailBody,
      autoCareChannels,
      widgetSettings,
    } = req.body;

    const existing = await prisma.cskhConfig.findUnique({
      where: { workspaceId: req.workspaceId },
    });

    const delayHours = followUpDelayHours !== undefined ? (followUpDelayHours === null ? null : parseInt(String(followUpDelayHours), 10)) : undefined;

    let config;
    if (existing) {
      config = await prisma.cskhConfig.update({
        where: { id: existing.id },
        data: {
          liveChatEnabled: liveChatEnabled !== undefined ? !!liveChatEnabled : existing.liveChatEnabled,
          aiChatbotEnabled: aiChatbotEnabled !== undefined ? !!aiChatbotEnabled : existing.aiChatbotEnabled,
          knowledgeBaseText: knowledgeBaseText !== undefined ? knowledgeBaseText : existing.knowledgeBaseText,
          notificationChannels: notificationChannels !== undefined ? notificationChannels : existing.notificationChannels,
          followUpDelayHours: delayHours !== undefined ? delayHours : existing.followUpDelayHours,
          followUpEmailSubject: followUpEmailSubject !== undefined ? followUpEmailSubject : existing.followUpEmailSubject,
          followUpEmailBody: followUpEmailBody !== undefined ? followUpEmailBody : existing.followUpEmailBody,
          // new fields
          autoCareEnabled: autoCareEnabled !== undefined ? !!autoCareEnabled : existing.autoCareEnabled,
          autoCareScheduleType: autoCareScheduleType !== undefined ? autoCareScheduleType : existing.autoCareScheduleType,
          autoCareDelayHours: autoCareDelayHours !== undefined ? parseInt(String(autoCareDelayHours), 10) : existing.autoCareDelayHours,
          autoCareIntervalDays: autoCareIntervalDays !== undefined ? parseInt(String(autoCareIntervalDays), 10) : existing.autoCareIntervalDays,
          autoCareEmailSubject: autoCareEmailSubject !== undefined ? autoCareEmailSubject : existing.autoCareEmailSubject,
          autoCareEmailBody: autoCareEmailBody !== undefined ? autoCareEmailBody : existing.autoCareEmailBody,
          autoCareChannels: autoCareChannels !== undefined ? autoCareChannels : existing.autoCareChannels,
          widgetSettings: widgetSettings !== undefined ? widgetSettings : existing.widgetSettings,
        },
      });
    } else {
      config = await prisma.cskhConfig.create({
        data: {
          workspaceId: req.workspaceId,
          liveChatEnabled: !!liveChatEnabled,
          aiChatbotEnabled: !!aiChatbotEnabled,
          knowledgeBaseText: knowledgeBaseText || null,
          notificationChannels: notificationChannels || null,
          followUpDelayHours: delayHours !== undefined ? delayHours : 0,
          followUpEmailSubject: followUpEmailSubject || null,
          followUpEmailBody: followUpEmailBody || null,
          // new fields
          autoCareEnabled: !!autoCareEnabled,
          autoCareScheduleType: autoCareScheduleType || "AFTER_CREATION",
          autoCareDelayHours: autoCareDelayHours !== undefined ? parseInt(String(autoCareDelayHours), 10) : 24,
          autoCareIntervalDays: autoCareIntervalDays !== undefined ? parseInt(String(autoCareIntervalDays), 10) : 7,
          autoCareEmailSubject: autoCareEmailSubject || null,
          autoCareEmailBody: autoCareEmailBody || null,
          autoCareChannels: autoCareChannels || "email",
          widgetSettings: widgetSettings || null,
        },
      });
    }

    if (knowledgeBaseText !== undefined || !existing) {
      void syncKnowledgeBaseEmbeddings(req.workspaceId!, config.knowledgeBaseText || '');
    }

    if (req.workspaceId) {
      void invalidateWorkspaceCache(req.workspaceId, ['cskh-config']).catch(err => {
        console.error('[Cache Invalidation Error]:', err);
      });
    }

    res.json({ success: true, config });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi lưu cấu hình CSKH' });
  }
});

// Get all Chat Sessions for the Workspace
router.get('/sessions', authenticate, async (req: WorkspaceRequest, res: Response): Promise<void> => {
  try {
    const sessions = await prisma.chatSession.findMany({
      where: { workspaceId: req.workspaceId },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(sessions);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi lấy danh sách hội thoại' });
  }
});

// Get Chat Messages for a Chat Session
router.get('/sessions/:id/messages', authenticate, async (req: WorkspaceRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const session = await prisma.chatSession.findFirst({
      where: { id, workspaceId: req.workspaceId },
    });

    if (!session) {
      res.status(404).json({ error: 'Không tìm thấy phiên hội thoại này' });
      return;
    }

    const messages = await prisma.chatMessage.findMany({
      where: { sessionId: id },
      orderBy: { createdAt: 'asc' },
    });

    res.json(messages);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi lấy tin nhắn hội thoại' });
  }
});

// Send Agent Reply (Human Takeover)
router.post('/sessions/:id/send-agent', authenticate, requireWrite, async (req: WorkspaceRequest, res: Response): Promise<void> => {
  try {
    const sessionId = req.params.id as string;
    const { content } = req.body;
    if (!content?.trim()) {
      res.status(400).json({ error: 'Nội dung tin nhắn không được trống' });
      return;
    }

    const session = await prisma.chatSession.findFirst({
      where: { id: sessionId, workspaceId: req.workspaceId },
    });

    if (!session) {
      res.status(404).json({ error: 'Không tìm thấy phiên hội thoại này' });
      return;
    }

    const message = await prisma.chatMessage.create({
      data: {
        sessionId,
        sender: 'agent',
        content: content.trim(),
      },
    });

    await prisma.chatSession.update({
      where: { id: sessionId },
      data: { updatedAt: new Date() },
    });

    res.json({ success: true, message });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi gửi tin nhắn agent' });
  }
});

// Delete a Chat Session
router.delete('/sessions/:id', authenticate, async (req: WorkspaceRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const session = await prisma.chatSession.findFirst({
      where: { id, workspaceId: req.workspaceId },
    });

    if (!session) {
      res.status(404).json({ error: 'Không tìm thấy phiên hội thoại này' });
      return;
    }

    await prisma.chatSession.delete({
      where: { id },
    });

    res.json({ success: true, message: 'Đã xóa phiên hội thoại thành công' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi khi xóa phiên hội thoại' });
  }
});

// Upload File tri thức (PDF, DOCX, TXT)
router.post('/knowledge/upload', authenticate, requireWrite, upload.single('file'), async (req: WorkspaceRequest, res: Response): Promise<void> => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'Vui lòng cung cấp tệp tin tải lên (PDF, DOCX, TXT)' });
      return;
    }

    let extractedText = '';
    const extension = file.originalname.split('.').pop()?.toLowerCase();

    if (extension === 'txt') {
      extractedText = file.buffer.toString('utf-8');
    } else if (extension === 'pdf') {
      const parsed = await pdfParse(file.buffer);
      extractedText = parsed.text;
    } else if (extension === 'docx') {
      const parsed = await mammoth.extractRawText({ buffer: file.buffer });
      extractedText = parsed.value;
    } else {
      res.status(400).json({ error: 'Định dạng tệp không được hỗ trợ. Vui lòng tải lên .pdf, .docx, hoặc .txt' });
      return;
    }

    if (!extractedText.trim()) {
      res.status(400).json({ error: 'Không thể trích xuất văn bản từ tệp tin hoặc tệp rỗng.' });
      return;
    }

    // Load config hiện tại
    let config = await prisma.cskhConfig.findUnique({
      where: { workspaceId: req.workspaceId },
    });

    if (!config) {
      config = await prisma.cskhConfig.create({
        data: { workspaceId: req.workspaceId }
      });
    }

    // Ghép text mới vào tri thức
    const prefix = `\n\n--- [Nguồn tài liệu: ${file.originalname}] ---\n`;
    const newKnowledge = (config.knowledgeBaseText || '') + prefix + extractedText.trim();

    // Cập nhật danh sách file đã học
    let files: any[] = [];
    if (config.knowledgeFiles) {
      try {
        files = JSON.parse(config.knowledgeFiles);
      } catch (e) {
        files = [];
      }
    }
    
    // Tránh trùng lặp file cùng tên
    files = files.filter((f: any) => f.name !== file.originalname);
    files.push({
      name: file.originalname,
      size: file.size,
      learnedAt: new Date().toISOString()
    });

    const updated = await prisma.cskhConfig.update({
      where: { id: config.id },
      data: {
        knowledgeBaseText: newKnowledge,
        knowledgeFiles: JSON.stringify(files)
      }
    });

    void syncKnowledgeBaseEmbeddings(req.workspaceId!, newKnowledge);

    if (req.workspaceId) {
      void invalidateWorkspaceCache(req.workspaceId, ['cskh-config']).catch(err => {
        console.error('[Cache Invalidation Error]:', err);
      });
    }

    res.json({
      success: true,
      message: `Đã học thành công tri thức từ tài liệu: ${file.originalname}`,
      config: updated
    });
  } catch (error: any) {
    console.error('Lỗi upload tri thức:', error);
    res.status(500).json({ error: error.message || 'Lỗi xử lý tệp tin tri thức' });
  }
});

// Crawl Website
router.post('/knowledge/crawl', authenticate, requireWrite, async (req: WorkspaceRequest, res: Response): Promise<void> => {
  try {
    const { url } = req.body;
    if (!url) {
      res.status(400).json({ error: 'Vui lòng cung cấp URL trang web muốn học' });
      return;
    }

    // Fetch HTML
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 10000
    });

    const html = response.data;
    const $ = cheerio.load(html);

    // Loại bỏ các thẻ không liên quan đến nội dung văn bản chính
    $('script, style, iframe, nav, header, footer, noscript').remove();

    // Lấy tiêu đề trang
    const title = $('title').text().trim() || 'Trang web';

    // Thu thập nội dung văn bản chính
    const texts: string[] = [];
    $('h1, h2, h3, h4, h5, p, li').each((_, element) => {
      const text = $(element).text().trim();
      if (text.length > 20) { // Chỉ lấy các câu hoặc đoạn văn có nghĩa
        texts.push(text);
      }
    });

    const extractedText = texts.join('\n');

    if (!extractedText.trim()) {
      res.status(400).json({ error: 'Không thể thu thập đủ nội dung văn bản từ URL này.' });
      return;
    }

    // Load config hiện tại
    let config = await prisma.cskhConfig.findUnique({
      where: { workspaceId: req.workspaceId },
    });

    if (!config) {
      config = await prisma.cskhConfig.create({
        data: { workspaceId: req.workspaceId }
      });
    }

    // Ghép text mới vào tri thức
    const prefix = `\n\n--- [Nguồn URL: ${url}] ---\n`;
    const newKnowledge = (config.knowledgeBaseText || '') + prefix + extractedText.trim();

    // Cập nhật danh sách URL đã học
    let urls: any[] = [];
    if (config.knowledgeUrls) {
      try {
        urls = JSON.parse(config.knowledgeUrls);
      } catch (e) {
        urls = [];
      }
    }

    // Tránh trùng lặp URL
    urls = urls.filter((u: any) => u.url !== url);
    urls.push({
      url,
      title,
      learnedAt: new Date().toISOString()
    });

    const updated = await prisma.cskhConfig.update({
      where: { id: config.id },
      data: {
        knowledgeBaseText: newKnowledge,
        knowledgeUrls: JSON.stringify(urls)
      }
    });

    void syncKnowledgeBaseEmbeddings(req.workspaceId!, newKnowledge);

    if (req.workspaceId) {
      void invalidateWorkspaceCache(req.workspaceId, ['cskh-config']).catch(err => {
        console.error('[Cache Invalidation Error]:', err);
      });
    }

    res.json({
      success: true,
      message: `Đã học thành công tri thức từ URL: ${title}`,
      config: updated
    });
  } catch (error: any) {
    console.error('Lỗi crawl tri thức:', error);
    res.status(500).json({ error: error.message || 'Lỗi cào dữ liệu từ URL' });
  }
});

// Reset Tri thức
router.post('/knowledge/reset', authenticate, requireWrite, async (req: WorkspaceRequest, res: Response): Promise<void> => {
  try {
    const config = await prisma.cskhConfig.findUnique({
      where: { workspaceId: req.workspaceId },
    });

    if (!config) {
      res.status(404).json({ error: 'Cấu hình không tồn tại' });
      return;
    }

    const updated = await prisma.cskhConfig.update({
      where: { id: config.id },
      data: {
        knowledgeBaseText: null,
        knowledgeFiles: null,
        knowledgeUrls: null
      }
    });

    void syncKnowledgeBaseEmbeddings(req.workspaceId!, '');

    if (req.workspaceId) {
      void invalidateWorkspaceCache(req.workspaceId, ['cskh-config']).catch(err => {
        console.error('[Cache Invalidation Error]:', err);
      });
    }

    res.json({ success: true, message: 'Đã đặt lại tri thức doanh nghiệp', config: updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi đặt lại tri thức' });
  }
});

export default router;
