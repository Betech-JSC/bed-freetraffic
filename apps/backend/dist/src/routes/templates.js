"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const aiGenerate_1 = require("../services/aiGenerate");
const router = (0, express_1.Router)();
// Cấu hình thư mục lưu ảnh upload
const uploadDir = path_1.default.join(__dirname, '../../uploads');
if (!fs_1.default.existsSync(uploadDir)) {
    fs_1.default.mkdirSync(uploadDir, { recursive: true });
}
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path_1.default.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});
const upload = (0, multer_1.default)({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // Max 10MB
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|gif|webp/;
        const ext = allowed.test(path_1.default.extname(file.originalname).toLowerCase());
        const mime = allowed.test(file.mimetype);
        if (ext && mime)
            cb(null, true);
        else
            cb(new Error('Chỉ chấp nhận file ảnh (jpg, png, gif, webp)'));
    }
});
// Lấy danh sách tất cả nội dung mẫu
router.get('/', async (req, res) => {
    try {
        const taskId = req.query.taskId ? parseInt(req.query.taskId) : undefined;
        const templates = await prisma_1.default.postTemplate.findMany({
            where: taskId ? { taskId, workspaceId: req.workspaceId } : { workspaceId: req.workspaceId },
            orderBy: { createdAt: 'desc' },
            include: { task: { select: { name: true } } }
        });
        res.json(templates);
    }
    catch (error) {
        res.status(500).json({ error: 'Lỗi máy chủ' });
    }
});
// Tạo nội dung mẫu mới (có kèm ảnh)
router.post('/', upload.single('image'), async (req, res) => {
    try {
        const { title, content, taskId } = req.body;
        if (!title || !content) {
            res.status(400).json({ error: 'Thiếu tiêu đề hoặc nội dung' });
            return;
        }
        const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
        const template = await prisma_1.default.postTemplate.create({
            data: {
                title,
                content,
                imageUrl,
                taskId: taskId ? parseInt(taskId) : null,
                workspaceId: req.workspaceId
            }
        });
        res.status(201).json(template);
    }
    catch (error) {
        res.status(500).json({ error: 'Lỗi máy chủ' });
    }
});
// Cập nhật nội dung mẫu
router.put('/:id', upload.single('image'), async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { title, content, taskId, isActive } = req.body;
        const existing = await prisma_1.default.postTemplate.findFirst({
            where: { id, workspaceId: req.workspaceId }
        });
        if (!existing) {
            res.status(404).json({ error: 'Không tìm thấy mẫu nội dung' });
            return;
        }
        const updateData = {};
        if (title)
            updateData.title = title;
        if (content)
            updateData.content = content;
        if (taskId !== undefined)
            updateData.taskId = taskId ? parseInt(taskId) : null;
        if (isActive !== undefined)
            updateData.isActive = isActive === 'true' || isActive === true;
        if (req.file)
            updateData.imageUrl = `/uploads/${req.file.filename}`;
        const template = await prisma_1.default.postTemplate.update({
            where: { id },
            data: updateData
        });
        res.json(template);
    }
    catch (error) {
        res.status(500).json({ error: 'Lỗi máy chủ' });
    }
});
// Xóa nội dung mẫu
router.delete('/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const existing = await prisma_1.default.postTemplate.findFirst({
            where: { id, workspaceId: req.workspaceId }
        });
        if (!existing) {
            res.status(404).json({ error: 'Không tìm thấy mẫu nội dung' });
            return;
        }
        if (existing.imageUrl) {
            const filePath = path_1.default.join(__dirname, '../../', existing.imageUrl);
            if (fs_1.default.existsSync(filePath))
                fs_1.default.unlinkSync(filePath);
        }
        await prisma_1.default.postTemplate.delete({ where: { id } });
        res.json({ message: 'Đã xóa thành công' });
    }
    catch (error) {
        res.status(500).json({ error: 'Lỗi máy chủ' });
    }
});
// Tạo bài viết tự động bằng AI (GPT + DALL-E)
router.post('/generate-ai', async (req, res) => {
    const { urlTarget, aiPrompt, generateImage } = req.body;
    if (!urlTarget?.trim()) {
        res.status(400).json({ error: 'URL đích là bắt buộc để AI phân tích' });
        return;
    }
    try {
        let result;
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            let domain = 'website';
            try {
                domain = new URL(urlTarget).hostname.replace('www.', '');
            }
            catch { }
            result = {
                title: `⚡ Khám phá giải pháp từ ${domain}`,
                content: `🔥 Giải pháp tối ưu hóa doanh số và thu hút khách hàng tiềm năng bền vững. Khám phá chi tiết ngay tại {url}!\n\n#freeship #sales #traffic #viral`
            };
        }
        else {
            result = await (0, aiGenerate_1.generateAiPostContent)(urlTarget, aiPrompt);
        }
        let imageUrl = null;
        if (generateImage) {
            imageUrl = await (0, aiGenerate_1.generateAiImage)(aiPrompt || result.title || 'Marketing banner');
        }
        res.json({
            title: result.title,
            content: result.content,
            imageUrl,
            isDemo: !apiKey
        });
    }
    catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : 'Lỗi gọi AI GPT' });
    }
});
// Render ảnh AI từ tiêu đề/prompt (sử dụng Pollinations/DALL-E)
router.post('/generate-image', async (req, res) => {
    const { prompt } = req.body;
    if (!prompt?.trim()) {
        res.status(400).json({ error: 'Tiêu đề hoặc prompt là bắt buộc để sinh ảnh' });
        return;
    }
    try {
        const imageUrl = await (0, aiGenerate_1.generateAiImage)(prompt);
        res.json({ imageUrl });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Lỗi sinh ảnh AI' });
    }
});
// Lên kế hoạch nội dung tự động bằng AI Copilot
router.post('/copilot-plan', async (req, res) => {
    const { topic, industry, tone, postCount, generateImage } = req.body;
    if (!topic || !industry || !tone) {
        res.status(400).json({ error: 'Chủ đề, ngành nghề và giọng điệu là bắt buộc' });
        return;
    }
    try {
        const plan = await (0, aiGenerate_1.generateAiContentPlan)(topic, industry, tone, postCount ? parseInt(postCount) : 5);
        if (generateImage) {
            for (const item of plan) {
                try {
                    item.imageUrl = await (0, aiGenerate_1.generateAiImage)(item.title);
                }
                catch (e) {
                    console.error('Error generating image for copilot item:', e);
                    item.imageUrl = null;
                }
            }
        }
        res.json({
            plan,
            isDemo: !process.env.OPENAI_API_KEY
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Lỗi sinh kế hoạch nội dung' });
    }
});
// Lưu kế hoạch Copilot thành các mẫu nội dung
router.post('/copilot-save', async (req, res) => {
    const { plan } = req.body;
    if (!Array.isArray(plan) || plan.length === 0) {
        res.status(400).json({ error: 'Kế hoạch không hợp lệ' });
        return;
    }
    try {
        const createdTemplates = [];
        for (const item of plan) {
            const template = await prisma_1.default.postTemplate.create({
                data: {
                    title: item.title,
                    content: item.content,
                    imageUrl: item.imageUrl || null,
                    workspaceId: req.workspaceId
                }
            });
            createdTemplates.push(template);
        }
        res.status(201).json({
            message: `Đã lưu thành công ${createdTemplates.length} mẫu nội dung`,
            templates: createdTemplates
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Lỗi lưu mẫu nội dung' });
    }
});
exports.default = router;
