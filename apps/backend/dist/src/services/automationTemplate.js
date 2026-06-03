"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveAutomationPost = resolveAutomationPost;
const prisma_1 = __importDefault(require("../lib/prisma"));
const abTestPublish_1 = require("./abTestPublish");
const aiGenerate_1 = require("./aiGenerate");
async function getRandomTemplate(taskId) {
    const templates = await prisma_1.default.postTemplate.findMany({
        where: {
            isActive: true,
            OR: [{ taskId }, { taskId: null }],
        },
    });
    if (templates.length === 0)
        return null;
    return templates[Math.floor(Math.random() * templates.length)];
}
async function resolveAutomationPost(task) {
    if (task.useAi) {
        try {
            console.log(`[AI GENERATOR] Tác vụ ${task.name} đang dùng AI để tạo bài đăng...`);
            const generated = await (0, aiGenerate_1.generateAiPostContent)(task.urlTarget, task.aiPrompt);
            let imageUrl = null;
            if (task.aiGenerateImage) {
                console.log(`[AI GENERATOR] Tạo hình ảnh cho bài đăng: "${generated.title}"...`);
                imageUrl = await (0, aiGenerate_1.generateAiImage)(generated.title);
            }
            return {
                title: generated.title,
                content: generated.content,
                imageUrl,
                urlTarget: task.urlTarget,
            };
        }
        catch (err) {
            console.error('[AI GENERATOR ERROR] Gặp lỗi khi tạo bài đăng bằng AI:', err.message);
            throw new Error(`AI lỗi: ${err.message}`);
        }
    }
    if (task.abTestId) {
        const r = await (0, abTestPublish_1.resolveAbTestContent)({
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
    if (!template)
        return null;
    return {
        title: template.title,
        content: template.content,
        imageUrl: template.thumbnailUrl || template.imageUrl,
        urlTarget: task.urlTarget,
    };
}
