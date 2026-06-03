"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveAbTestContent = resolveAbTestContent;
exports.buildDispatchMessage = buildDispatchMessage;
const prisma_1 = __importDefault(require("../lib/prisma"));
const render_1 = require("../lib/dispatch/render");
function trackClickUrl(testId, variant, target) {
    const base = process.env.API_PUBLIC_URL || 'http://localhost:4000';
    return `${base}/api/abtests/track/click/${testId}?variant=${variant}&url=${encodeURIComponent(target)}`;
}
/** Chọn biến thể A/B và ghi impression khi publish (schedule / automation). */
async function resolveAbTestContent(input) {
    const base = {
        title: input.title,
        content: input.content,
        imageUrl: input.imageUrl ?? null,
        urlTarget: input.urlTarget ?? null,
    };
    if (!input.abTestId)
        return base;
    const test = await prisma_1.default.abTest.findUnique({
        where: { id: input.abTestId },
        include: { templateA: true, templateB: true },
    });
    if (!test || test.status !== 'RUNNING' || (!test.templateA && !test.templateB)) {
        return base;
    }
    const variant = test.templateA && test.templateB
        ? Math.random() < 0.5
            ? 'A'
            : 'B'
        : test.templateA
            ? 'A'
            : 'B';
    const template = variant === 'A' ? test.templateA : test.templateB;
    if (!template)
        return base;
    await prisma_1.default.abTest.update({
        where: { id: test.id },
        data: variant === 'A' ? { impressionsA: { increment: 1 } } : { impressionsB: { increment: 1 } },
    });
    const urlTarget = input.urlTarget?.trim() || null;
    const trackedUrl = urlTarget ? trackClickUrl(test.id, variant, urlTarget) : null;
    return {
        title: template.title || input.title,
        content: template.content,
        imageUrl: template.imageUrl ?? input.imageUrl ?? null,
        urlTarget: trackedUrl,
        abVariant: variant,
        abTestId: test.id,
    };
}
function buildDispatchMessage(content, vars) {
    return (0, render_1.renderContent)(content, {
        urlTarget: vars.urlTarget || undefined,
        name: vars.title,
    });
}
