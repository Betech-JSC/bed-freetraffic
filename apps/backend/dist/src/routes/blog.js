"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_1 = require("../middleware/auth");
const markdown_1 = require("../lib/markdown");
const router = (0, express_1.Router)();
// Retrieve all blog posts for the current workspace
router.get('/', auth_1.authenticate, async (req, res) => {
    try {
        const posts = await prisma_1.default.blogPost.findMany({
            where: { workspaceId: req.workspaceId },
            orderBy: { createdAt: 'desc' },
        });
        res.json(posts);
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Lỗi hệ thống khi lấy danh sách bài viết' });
    }
});
// Retrieve single blog post details
router.get('/:id', auth_1.authenticate, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const post = await prisma_1.default.blogPost.findFirst({
            where: { id, workspaceId: req.workspaceId },
        });
        if (!post) {
            res.status(404).json({ error: 'Không tìm thấy bài viết' });
            return;
        }
        res.json(post);
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Lỗi khi lấy chi tiết bài viết' });
    }
});
// Create a new blog post
router.post('/', auth_1.authenticate, auth_1.requireWrite, async (req, res) => {
    try {
        const { title, slug, summary, content, published, authorName, tags } = req.body;
        if (!title || !slug || content == null) {
            res.status(400).json({ error: 'Tiêu đề, đường dẫn (slug) và nội dung là bắt buộc.' });
            return;
        }
        // Check slug uniqueness
        const existing = await prisma_1.default.blogPost.findFirst({
            where: { slug },
        });
        if (existing) {
            res.status(400).json({ error: 'Đường dẫn (slug) đã tồn tại trong hệ thống. Vui lòng chọn đường dẫn khác.' });
            return;
        }
        const htmlContent = (0, markdown_1.markdownToHtml)(content);
        const post = await prisma_1.default.blogPost.create({
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
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Lỗi khi tạo bài viết' });
    }
});
// Update a blog post
router.put('/:id', auth_1.authenticate, auth_1.requireWrite, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { title, slug, summary, content, published, authorName, tags } = req.body;
        const existing = await prisma_1.default.blogPost.findFirst({
            where: { id, workspaceId: req.workspaceId },
        });
        if (!existing) {
            res.status(404).json({ error: 'Không tìm thấy bài viết để cập nhật' });
            return;
        }
        // Check slug uniqueness if changed
        if (slug && slug !== existing.slug) {
            const slugConflict = await prisma_1.default.blogPost.findFirst({
                where: { slug },
            });
            if (slugConflict) {
                res.status(400).json({ error: 'Đường dẫn (slug) này đã được bài viết khác sử dụng.' });
                return;
            }
        }
        const htmlContent = content != null ? (0, markdown_1.markdownToHtml)(content) : existing.htmlContent;
        const publishedAt = published === true && !existing.published
            ? new Date()
            : published === false
                ? null
                : existing.publishedAt;
        const updated = await prisma_1.default.blogPost.update({
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
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Lỗi khi cập nhật bài viết' });
    }
});
// Delete a blog post
router.delete('/:id', auth_1.authenticate, auth_1.requireWrite, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const existing = await prisma_1.default.blogPost.findFirst({
            where: { id, workspaceId: req.workspaceId },
        });
        if (!existing) {
            res.status(404).json({ error: 'Không tìm thấy bài viết để xóa' });
            return;
        }
        await prisma_1.default.blogPost.delete({
            where: { id },
        });
        res.status(204).send();
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Lỗi khi xóa bài viết' });
    }
});
exports.default = router;
