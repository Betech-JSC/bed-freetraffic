"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_1 = require("../middleware/auth");
const jimp_1 = require("jimp");
// @ts-ignore
const fonts_1 = require("jimp/fonts");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const router = (0, express_1.Router)();
const uploadDir = path_1.default.join(__dirname, '../../uploads');
if (!fs_1.default.existsSync(uploadDir)) {
    fs_1.default.mkdirSync(uploadDir, { recursive: true });
}
// Generate procedural abstract gradients using math
async function generateProceduralBackground(title, filename) {
    const width = 1200;
    const height = 630;
    // Derive unique seed colors based on title string hash
    let hash = 0;
    for (let i = 0; i < title.length; i++) {
        hash = title.charCodeAt(i) + ((hash << 5) - hash);
    }
    // Generate nice HSL colors to ensure bright, professional aesthetic
    const h1 = Math.abs(hash % 360);
    const h2 = (h1 + 60) % 360; // secondary color
    // Convert HSL to RGB
    const hslToRgb = (h, s, l) => {
        h /= 360;
        s /= 100;
        l /= 100;
        let r, g, b;
        if (s === 0) {
            r = g = b = l; // achromatic
        }
        else {
            const hue2rgb = (p, q, t) => {
                if (t < 0)
                    t += 1;
                if (t > 1)
                    t -= 1;
                if (t < 1 / 6)
                    return p + (q - p) * 6 * t;
                if (t < 1 / 2)
                    return q;
                if (t < 2 / 3)
                    return p + (q - p) * (2 / 3 - t) * 6;
                return p;
            };
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h + 1 / 3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1 / 3);
        }
        return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
    };
    // Create start and end RGB gradient colors
    const rgbStart = hslToRgb(h1, 65, 12); // dark background color
    const rgbEnd = hslToRgb(h2, 75, 25); // vibrant accent color
    // Create Jimp image with solid starting color
    const image = new jimp_1.Jimp({ width, height, color: 0x111827ff });
    // 1. Draw linear gradient from top-left to bottom-right
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const t = (x + y) / (width + height); // normalized position diagonal
            const r = Math.round(rgbStart[0] + (rgbEnd[0] - rgbStart[0]) * t);
            const g = Math.round(rgbStart[1] + (rgbEnd[1] - rgbStart[1]) * t);
            const b = Math.round(rgbStart[2] + (rgbEnd[2] - rgbStart[2]) * t);
            const hex = (r << 24) | (g << 16) | (b << 8) | 0xff;
            image.setPixelColor(hex, x, y);
        }
    }
    // 2. Add abstract organic glowing shapes (circles)
    const drawGlowCircle = (cx, cy, radius, h) => {
        const color = hslToRgb(h, 85, 45);
        for (let y = Math.max(0, cy - radius); y < Math.min(height, cy + radius); y++) {
            for (let x = Math.max(0, cx - radius); x < Math.min(width, cx + radius); x++) {
                const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
                if (dist < radius) {
                    const intensity = (1 - (dist / radius)) ** 2; // exponential falloff for soft glow
                    const currentHex = image.getPixelColor(x, y);
                    const pr = (currentHex >> 24) & 0xff;
                    const pg = (currentHex >> 16) & 0xff;
                    const pb = (currentHex >> 8) & 0xff;
                    const nr = Math.min(255, Math.round(pr + color[0] * intensity * 0.35));
                    const ng = Math.min(255, Math.round(pg + color[1] * intensity * 0.35));
                    const nb = Math.min(255, Math.round(pb + color[2] * intensity * 0.35));
                    image.setPixelColor((nr << 24) | (ng << 16) | (nb << 8) | 0xff, x, y);
                }
            }
        }
    };
    // Draw glowing blobs at opposite sides
    drawGlowCircle(Math.round(width * 0.8), Math.round(height * 0.75), 320, h2);
    drawGlowCircle(Math.round(width * 0.15), Math.round(height * 0.2), 240, h1);
    // 3. Add modern digital branding grids
    const gridColor = 0xffffff15; // semi-transparent white
    const gridStep = 40;
    for (let x = 0; x < width; x += gridStep) {
        for (let y = 0; y < height; y++) {
            image.setPixelColor(gridColor, x, y);
        }
    }
    for (let y = 0; y < height; y += gridStep) {
        for (let x = 0; x < width; x++) {
            image.setPixelColor(gridColor, x, y);
        }
    }
    const relativePath = `/uploads/${filename}`;
    const absolutePath = path_1.default.join(uploadDir, filename);
    await image.write(absolutePath);
    return relativePath;
}
// ==========================================
// ADMIN PORTAL ROUTES
// ==========================================
// POST /api/og-image/generate - Generates abstract wallpaper for a blog post or landing page
router.post('/generate', auth_1.authenticate, async (req, res) => {
    try {
        const { type, id } = req.body;
        if (!type || !id) {
            res.status(400).json({ error: 'Loại nội dung (type) và ID là bắt buộc' });
            return;
        }
        const targetId = parseInt(String(id), 10);
        if (isNaN(targetId)) {
            res.status(400).json({ error: 'ID không hợp lệ' });
            return;
        }
        let title = 'Growth OS Branding';
        if (type === 'blog') {
            const blog = await prisma_1.default.blogPost.findFirst({
                where: { id: targetId, workspaceId: req.workspaceId }
            });
            if (!blog) {
                res.status(404).json({ error: 'Không tìm thấy bài viết Blog' });
                return;
            }
            title = blog.title;
            const filename = `og-bg-blog-${blog.id}-${Date.now()}.png`;
            const bgUrl = await generateProceduralBackground(title, filename);
            await prisma_1.default.blogPost.update({
                where: { id: blog.id },
                data: { ogImageUrl: bgUrl }
            });
            res.json({ success: true, ogImageUrl: bgUrl });
        }
        else if (type === 'landing') {
            const lp = await prisma_1.default.landingPage.findFirst({
                where: { id: targetId, workspaceId: req.workspaceId }
            });
            if (!lp) {
                res.status(404).json({ error: 'Không tìm thấy Landing Page' });
                return;
            }
            title = lp.title;
            const filename = `og-bg-lp-${lp.id}-${Date.now()}.png`;
            const bgUrl = await generateProceduralBackground(title, filename);
            await prisma_1.default.landingPage.update({
                where: { id: lp.id },
                data: { ogImageUrl: bgUrl }
            });
            res.json({ success: true, ogImageUrl: bgUrl });
        }
        else {
            res.status(400).json({ error: 'Loại nội dung không hợp lệ (hỗ trợ blog hoặc landing)' });
        }
    }
    catch (err) {
        console.error('Error generating OG image background:', err);
        res.status(500).json({ error: err.message || 'Lỗi tạo ảnh bìa tự động' });
    }
});
// ==========================================
// PUBLIC ROUTE (Accessible by social crawlers)
// ==========================================
// GET /api/public/og-image/:type/:id - Serve dynamic OpenGraph PNG image with text overlays
router.get('/public/og-image/:type/:id', async (req, res) => {
    try {
        const { type, id } = req.params;
        const targetId = parseInt(String(id), 10);
        const typeStr = String(type);
        if (isNaN(targetId) || !['blog', 'landing'].includes(typeStr)) {
            res.status(400).send('Tham số không hợp lệ.');
            return;
        }
        let title = '';
        let ogBgUrl = null;
        if (typeStr === 'blog') {
            const blog = await prisma_1.default.blogPost.findUnique({ where: { id: targetId } });
            if (!blog) {
                res.status(404).send('Không tìm thấy bài đăng.');
                return;
            }
            title = blog.title;
            ogBgUrl = blog.ogImageUrl;
        }
        else {
            const lp = await prisma_1.default.landingPage.findUnique({ where: { id: targetId } });
            if (!lp) {
                res.status(404).send('Không tìm thấy landing page.');
                return;
            }
            title = lp.title;
            ogBgUrl = lp.ogImageUrl;
        }
        // Load background image or generate procedural one on the fly
        let bgImg;
        let absolutePath = '';
        if (ogBgUrl) {
            absolutePath = path_1.default.join(__dirname, '../../', ogBgUrl);
        }
        if (absolutePath && fs_1.default.existsSync(absolutePath)) {
            bgImg = await jimp_1.Jimp.read(absolutePath);
        }
        else {
            // Procedural background fallback
            const filename = `og-temp-${Date.now()}.png`;
            const tempPath = await generateProceduralBackground(title, filename);
            const tempAbs = path_1.default.join(__dirname, '../../', tempPath);
            bgImg = await jimp_1.Jimp.read(tempAbs);
            // Cleanup temp procedural background
            setTimeout(() => {
                try {
                    fs_1.default.unlinkSync(tempAbs);
                }
                catch { }
            }, 5000);
        }
        // Overlay text using Jimp loadFont
        const font = await (0, jimp_1.loadFont)(fonts_1.SANS_64_WHITE);
        const subFont = await (0, jimp_1.loadFont)(fonts_1.SANS_32_WHITE);
        // Write Brand Watermark "GROWTH OS" at the top center
        const brand = 'GROWTH OS AUTOMATION';
        const brandWidth = (0, jimp_1.measureText)(subFont, brand);
        const bx = Math.round((1200 - brandWidth) / 2);
        bgImg.print({ font: subFont, x: bx, y: 80, text: brand });
        // Word wrapping for title
        const words = title.split(' ');
        let line = '';
        const lines = [];
        for (let i = 0; i < words.length; i++) {
            const testLine = line ? line + ' ' + words[i] : words[i];
            const testWidth = (0, jimp_1.measureText)(font, testLine);
            if (testWidth > 1050 && line) {
                lines.push(line);
                line = words[i];
            }
            else {
                line = testLine;
            }
        }
        if (line) {
            lines.push(line);
        }
        // Print wrapped lines centered
        const fontHeight = (0, jimp_1.measureTextHeight)(font, 'Q', 1050);
        const totalHeight = lines.length * (fontHeight + 16);
        let startY = Math.round((630 - totalHeight) / 2) + 20;
        for (const l of lines.slice(0, 3)) { // max 3 lines to fit safely
            const textWidth = (0, jimp_1.measureText)(font, l);
            const tx = Math.round((1200 - textWidth) / 2);
            bgImg.print({ font, x: tx, y: startY, text: l });
            startY += fontHeight + 16;
        }
        // Write Call to action bottom center
        const ctaText = 'KÉO TRAFFIC MIỄN PHÍ HIỆU QUẢ';
        const ctaWidth = (0, jimp_1.measureText)(subFont, ctaText);
        const cx = Math.round((1200 - ctaWidth) / 2);
        bgImg.print({ font: subFont, x: cx, y: 500, text: ctaText });
        // Get buffer and send as direct image response
        const buffer = await bgImg.getBuffer('image/png');
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24h
        res.send(buffer);
    }
    catch (err) {
        console.error('Failed to generate sharing image:', err);
        res.status(500).send('Error drawing sharing image.');
    }
});
exports.default = router;
