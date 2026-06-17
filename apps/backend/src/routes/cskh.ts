import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireWrite } from '../middleware/auth';
import { WorkspaceRequest } from '../middleware/workspace';
import { getIo } from '../lib/socket';
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
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB limit
});


// Lấy ID Workspace hệ thống (dùng cho Admin quản lý tri thức support toàn hệ thống)
router.get('/system-workspace-id', authenticate, async (req: WorkspaceRequest, res: Response): Promise<void> => {
  try {
    const firstWs = await prisma.workspace.findFirst({
      orderBy: { id: 'asc' }
    });
    res.json({ systemWorkspaceId: firstWs?.id || 1 });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi lấy ID workspace hệ thống' });
  }
});

// Load CSKH Config (Real-time Config)
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
      void invalidateWorkspaceCache(req.workspaceId, ['cskh-config', 'rag']).catch(err => {
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

    try {
      const io = getIo();
      if (io) {
        io.to(`session:${sessionId}`).emit('new_message', message);
        io.to(`workspace:${req.workspaceId}`).emit('new_message', message);
      }
    } catch (socketErr) {
      console.error('[Socket.io] Error broadcasting agent message:', socketErr);
    }

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

// Get all Knowledge Sources
router.get('/knowledge/sources', authenticate, async (req: WorkspaceRequest, res: Response): Promise<void> => {
  const cacheKey = `ws:${req.workspaceId}:knowledge-sources`;
  try {
    const cached = await cache.get<any[]>(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    const sources = await prisma.knowledgeSource.findMany({
      where: { workspaceId: req.workspaceId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { chunks: true }
        }
      }
    });

    await cache.set(cacheKey, sources, 600); // Cache for 10 minutes
    res.json(sources);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi lấy danh sách tài liệu tri thức' });
  }
});

// Preview Knowledge Source Text
router.get('/knowledge/sources/:id/preview', authenticate, async (req: WorkspaceRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const source = await prisma.knowledgeSource.findFirst({
      where: { id, workspaceId: req.workspaceId }
    });
    if (!source) {
      res.status(404).json({ error: 'Không tìm thấy tài liệu này' });
      return;
    }
    res.json({
      id: source.id,
      name: source.name,
      extractedText: source.extractedText
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi xem trước tài liệu' });
  }
});

// Delete Knowledge Source
router.delete('/knowledge/sources/:id', authenticate, requireWrite, async (req: WorkspaceRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const source = await prisma.knowledgeSource.findFirst({
      where: { id, workspaceId: req.workspaceId }
    });
    if (!source) {
      res.status(404).json({ error: 'Không tìm thấy tài liệu này' });
      return;
    }
    
    await prisma.knowledgeSource.delete({
      where: { id }
    });

    if (req.workspaceId) {
      void invalidateWorkspaceCache(req.workspaceId, ['rag', 'knowledge-sources']).catch(err => {
        console.error('[Cache Invalidation Error]:', err);
      });
    }

    res.json({ success: true, message: `Đã xóa tài liệu: ${source.name}` });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi khi xóa tài liệu' });
  }
});

// Re-sync Knowledge Source
router.post('/knowledge/sources/:id/re-sync', authenticate, requireWrite, async (req: WorkspaceRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const source = await prisma.knowledgeSource.findFirst({
      where: { id, workspaceId: req.workspaceId }
    });
    if (!source) {
      res.status(404).json({ error: 'Không tìm thấy tài liệu này' });
      return;
    }

    if (source.type === 'URL' && source.url) {
      const response = await axios.get(source.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        timeout: 10000
      });
      const html = response.data;
      const $ = cheerio.load(html);
      $('script, style, iframe, nav, header, footer, noscript').remove();
      const title = $('title').text().trim() || source.name;
      const texts: string[] = [];
      $('h1, h2, h3, h4, h5, p, li').each((_, element) => {
        const text = $(element).text().trim();
        if (text.length > 20) {
          texts.push(text);
        }
      });
      const extractedText = texts.join('\n');
      if (!extractedText.trim()) {
        res.status(400).json({ error: 'Không thể thu thập đủ nội dung văn bản từ URL này.' });
        return;
      }

      await prisma.knowledgeSource.update({
        where: { id },
        data: {
          name: title,
          extractedText,
          status: 'PROCESSING'
        }
      });
    } else {
      await prisma.knowledgeSource.update({
        where: { id },
        data: { status: 'PROCESSING' }
      });
    }

    if (req.workspaceId) {
      void invalidateWorkspaceCache(req.workspaceId, ['knowledge-sources']).catch(() => {});
    }

    const { syncSourceEmbeddings } = require('../lib/embeddings');
    void syncSourceEmbeddings(id);

    res.json({ success: true, message: 'Đang tiến hành đồng bộ lại tri thức...' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi khi đồng bộ lại tài liệu' });
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
      const parser = new pdfParse.PDFParse({ data: file.buffer });
      const parsed = await parser.getText();
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

    const source = await prisma.knowledgeSource.create({
      data: {
        workspaceId: req.workspaceId!,
        name: file.originalname,
        type: 'FILE',
        fileSize: file.size,
        extractedText: extractedText.trim(),
        status: 'PROCESSING'
      }
    });

    if (req.workspaceId) {
      void invalidateWorkspaceCache(req.workspaceId, ['knowledge-sources']).catch(() => {});
    }

    const { syncSourceEmbeddings } = require('../lib/embeddings');
    void syncSourceEmbeddings(source.id);

    res.json({
      success: true,
      message: `Đang xử lý tài liệu: ${file.originalname}`,
      source
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

    const source = await prisma.knowledgeSource.create({
      data: {
        workspaceId: req.workspaceId!,
        name: url,
        type: 'URL',
        url: url,
        status: 'PROCESSING'
      }
    });

    const crawlAndSync = async () => {
      try {
        const response = await axios.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          },
          timeout: 10000
        });

        const html = response.data;
        const $ = cheerio.load(html);
        $('script, style, iframe, nav, header, footer, noscript').remove();
        const title = $('title').text().trim() || url;
        const texts: string[] = [];
        $('h1, h2, h3, h4, h5, p, li').each((_, element) => {
          const text = $(element).text().trim();
          if (text.length > 20) {
            texts.push(text);
          }
        });
        const extractedText = texts.join('\n');

        if (!extractedText.trim()) {
          throw new Error('Không thể thu thập đủ nội dung văn bản từ URL này hoặc trang rỗng.');
        }

        await prisma.knowledgeSource.update({
          where: { id: source.id },
          data: {
            name: title,
            extractedText: extractedText.trim()
          }
        });

        const { syncSourceEmbeddings } = require('../lib/embeddings');
        await syncSourceEmbeddings(source.id);
        
        void invalidateWorkspaceCache(req.workspaceId!, ['knowledge-sources']).catch(() => {});
      } catch (err: any) {
        console.error(`[Crawl RAG] Lỗi crawl URL ${url}:`, err);
        await prisma.knowledgeSource.update({
          where: { id: source.id },
          data: {
            status: 'FAILED',
            errorMessage: err.message || String(err)
          }
        });
        void invalidateWorkspaceCache(req.workspaceId!, ['knowledge-sources']).catch(() => {});
      }
    };

    if (req.workspaceId) {
      void invalidateWorkspaceCache(req.workspaceId, ['knowledge-sources']).catch(() => {});
    }

    void crawlAndSync();

    res.json({
      success: true,
      message: `Đang bắt đầu cào dữ liệu từ URL: ${url}`,
      source
    });
  } catch (error: any) {
    console.error('Lỗi crawl tri thức:', error);
    res.status(500).json({ error: error.message || 'Lỗi cào dữ liệu từ URL' });
  }
});

// Reset Tri thức
router.post('/knowledge/reset', authenticate, requireWrite, async (req: WorkspaceRequest, res: Response): Promise<void> => {
  try {
    await prisma.knowledgeSource.deleteMany({
      where: { workspaceId: req.workspaceId }
    });

    if (req.workspaceId) {
      void invalidateWorkspaceCache(req.workspaceId, ['rag', 'knowledge-sources']).catch(err => {
        console.error('[Cache Invalidation Error]:', err);
      });
    }

    res.json({ success: true, message: 'Đã đặt lại và xóa sạch tri thức doanh nghiệp.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi đặt lại tri thức' });
  }
});

export default router;

