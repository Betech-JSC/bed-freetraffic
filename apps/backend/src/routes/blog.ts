import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest, requireWrite } from '../middleware/auth';
import { markdownToHtml } from '../lib/markdown';

const router = Router();

// Retrieve all blog posts for the current workspace
router.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const posts = await prisma.blogPost.findMany({
      where: { workspaceId: req.workspaceId },
      select: {
        id: true,
        slug: true,
        title: true,
        summary: true,
        published: true,
        publishedAt: true,
        authorName: true,
        tags: true,
        targetKeyword: true,
        ogImageUrl: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(posts);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi hệ thống khi lấy danh sách bài viết' });
  }
});

// Retrieve single blog post details
router.get('/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string);
    const post = await prisma.blogPost.findFirst({
      where: { id, workspaceId: req.workspaceId },
    });
    if (!post) {
      res.status(404).json({ error: 'Không tìm thấy bài viết' });
      return;
    }
    res.json(post);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi khi lấy chi tiết bài viết' });
  }
});

// Create a new blog post
router.post('/', authenticate, requireWrite, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, slug, summary, content, published, authorName, tags } = req.body;
    if (!title || !slug || content == null) {
      res.status(400).json({ error: 'Tiêu đề, đường dẫn (slug) và nội dung là bắt buộc.' });
      return;
    }

    // Check slug uniqueness
    const existing = await prisma.blogPost.findFirst({
      where: { slug },
    });
    if (existing) {
      res.status(400).json({ error: 'Đường dẫn (slug) đã tồn tại trong hệ thống. Vui lòng chọn đường dẫn khác.' });
      return;
    }

    const htmlContent = markdownToHtml(content);

    const post = await prisma.blogPost.create({
      data: {
        title,
        slug,
        summary,
        content,
        htmlContent,
        published: !!published,
        publishedAt: published ? new Date() : null,
        authorName: authorName || 'Admin',
        tags,
        workspaceId: req.workspaceId,
      },
    });

    res.status(201).json(post);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi khi tạo bài viết' });
  }
});

// Update a blog post
router.put('/:id', authenticate, requireWrite, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string);
    const { title, slug, summary, content, published, authorName, tags } = req.body;

    const existing = await prisma.blogPost.findFirst({
      where: { id, workspaceId: req.workspaceId },
    });
    if (!existing) {
      res.status(404).json({ error: 'Không tìm thấy bài viết để cập nhật' });
      return;
    }

    // Check slug uniqueness if changed
    if (slug && slug !== existing.slug) {
      const slugConflict = await prisma.blogPost.findFirst({
        where: { slug },
      });
      if (slugConflict) {
        res.status(400).json({ error: 'Đường dẫn (slug) này đã được bài viết khác sử dụng.' });
        return;
      }
    }

    const htmlContent = content != null ? markdownToHtml(content) : existing.htmlContent;

    const publishedAt = published === true && !existing.published 
      ? new Date() 
      : published === false 
        ? null 
        : existing.publishedAt;

    const updated = await prisma.blogPost.update({
      where: { id },
      data: {
        title: title !== undefined ? title : existing.title,
        slug: slug !== undefined ? slug : existing.slug,
        summary: summary !== undefined ? summary : existing.summary,
        content: content !== undefined ? content : existing.content,
        htmlContent,
        published: published !== undefined ? !!published : existing.published,
        publishedAt,
        authorName: authorName !== undefined ? authorName : existing.authorName,
        tags: tags !== undefined ? tags : existing.tags,
      },
    });

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi khi cập nhật bài viết' });
  }
});

// Delete a blog post
router.delete('/:id', authenticate, requireWrite, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string);
    const existing = await prisma.blogPost.findFirst({
      where: { id, workspaceId: req.workspaceId },
    });
    if (!existing) {
      res.status(404).json({ error: 'Không tìm thấy bài viết để xóa' });
      return;
    }
    await prisma.blogPost.delete({
      where: { id },
    });
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi khi xóa bài viết' });
  }
});

export default router;
