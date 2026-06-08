"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyImageOverlay = applyImageOverlay;
const jimp_1 = require("jimp");
// @ts-ignore
const fonts_1 = require("jimp/fonts");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const render_1 = require("./render");
/**
 * Processes the image by adding a watermark logo and/or text overlay.
 * Returns the relative URL path of the newly generated image.
 */
async function applyImageOverlay(imageUrl, options) {
    const { overlayText, overlayWatermark, overlayPosition = 'bottom-right', overlayFontSize = 32 } = options;
    if (!overlayText && !overlayWatermark) {
        return imageUrl; // No overlay requested
    }
    const originalPath = (0, render_1.resolveUploadPath)(imageUrl);
    if (!originalPath || !fs_1.default.existsSync(originalPath)) {
        return imageUrl; // Original image not found locally
    }
    try {
        const image = await jimp_1.Jimp.read(originalPath);
        const width = image.bitmap.width;
        const height = image.bitmap.height;
        let modified = false;
        // 1. Process Watermark Image
        if (overlayWatermark) {
            const watermarkPath = (0, render_1.resolveUploadPath)(overlayWatermark);
            if (watermarkPath && fs_1.default.existsSync(watermarkPath)) {
                const watermark = await jimp_1.Jimp.read(watermarkPath);
                // Resize watermark logo to be 18% of original image width, keeping aspect ratio
                const wmWidth = Math.round(width * 0.18);
                watermark.resize({ w: wmWidth });
                let wmX = 20;
                let wmY = 20;
                const pos = (overlayPosition || 'bottom-right').toLowerCase();
                if (pos === 'top-right') {
                    wmX = width - watermark.bitmap.width - 20;
                }
                else if (pos === 'bottom-left') {
                    wmY = height - watermark.bitmap.height - 20;
                }
                else if (pos === 'bottom-right') {
                    wmX = width - watermark.bitmap.width - 20;
                    wmY = height - watermark.bitmap.height - 20;
                }
                else if (pos === 'center') {
                    wmX = Math.round((width - watermark.bitmap.width) / 2);
                    wmY = Math.round((height - watermark.bitmap.height) / 2);
                }
                image.composite(watermark, wmX, wmY, {
                    opacitySource: 0.85,
                });
                modified = true;
            }
        }
        // 2. Process Text Overlay
        if (overlayText?.trim()) {
            let fontPreset = fonts_1.SANS_32_WHITE;
            const size = overlayFontSize || 32;
            if (size <= 16) {
                fontPreset = fonts_1.SANS_16_WHITE;
            }
            else if (size >= 64) {
                fontPreset = fonts_1.SANS_64_WHITE;
            }
            const font = await (0, jimp_1.loadFont)(fontPreset);
            const text = overlayText.trim();
            const textWidth = (0, jimp_1.measureText)(font, text);
            const textHeight = (0, jimp_1.measureTextHeight)(font, text, textWidth);
            let tx = 20;
            let ty = 20;
            const pos = (overlayPosition || 'bottom-right').toLowerCase();
            if (pos === 'top-right') {
                tx = width - textWidth - 20;
            }
            else if (pos === 'bottom-left') {
                ty = height - textHeight - 20;
            }
            else if (pos === 'bottom-right') {
                tx = width - textWidth - 20;
                ty = height - textHeight - 20;
                // If we also composite a watermark at bottom-right, offset the text upwards
                if (overlayWatermark) {
                    ty -= 40;
                }
            }
            else if (pos === 'center') {
                tx = Math.round((width - textWidth) / 2);
                ty = Math.round((height - textHeight) / 2);
            }
            image.print({ font, x: tx, y: ty, text });
            modified = true;
        }
        if (!modified) {
            return imageUrl;
        }
        // Save as a new file to preserve original upload
        const dir = path_1.default.dirname(originalPath);
        const ext = path_1.default.extname(originalPath);
        const base = path_1.default.basename(originalPath, ext);
        const newFilename = `${base}-overlay-${Date.now()}${ext}`;
        const newPath = path_1.default.join(dir, newFilename);
        await image.write(newPath);
        return `/uploads/${newFilename}`;
    }
    catch (error) {
        console.error('Error applying image overlay:', error);
        return imageUrl; // Fall back to original image on error
    }
}
