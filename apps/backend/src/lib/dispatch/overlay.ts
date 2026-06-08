import { Jimp, measureText, measureTextHeight, loadFont } from 'jimp';
// @ts-ignore
import { SANS_16_WHITE, SANS_32_WHITE, SANS_64_WHITE } from 'jimp/fonts';
import path from 'path';
import fs from 'fs';
import { resolveUploadPath } from './render';

export interface OverlayOptions {
  overlayText?: string | null;
  overlayWatermark?: string | null;
  overlayPosition?: string | null;
  overlayFontSize?: number | null;
}

/**
 * Processes the image by adding a watermark logo and/or text overlay.
 * Returns the relative URL path of the newly generated image.
 */
export async function applyImageOverlay(
  imageUrl: string,
  options: OverlayOptions
): Promise<string> {
  const { overlayText, overlayWatermark, overlayPosition = 'bottom-right', overlayFontSize = 32 } = options;

  if (!overlayText && !overlayWatermark) {
    return imageUrl; // No overlay requested
  }

  const originalPath = resolveUploadPath(imageUrl);
  if (!originalPath || !fs.existsSync(originalPath)) {
    return imageUrl; // Original image not found locally
  }

  try {
    const image = await Jimp.read(originalPath);
    const width = image.bitmap.width;
    const height = image.bitmap.height;
    let modified = false;

    // 1. Process Watermark Image
    if (overlayWatermark) {
      const watermarkPath = resolveUploadPath(overlayWatermark);
      if (watermarkPath && fs.existsSync(watermarkPath)) {
        const watermark = await Jimp.read(watermarkPath);
        
        // Resize watermark logo to be 18% of original image width, keeping aspect ratio
        const wmWidth = Math.round(width * 0.18);
        watermark.resize({ w: wmWidth });

        let wmX = 20;
        let wmY = 20;
        const pos = (overlayPosition || 'bottom-right').toLowerCase();

        if (pos === 'top-right') {
          wmX = width - watermark.bitmap.width - 20;
        } else if (pos === 'bottom-left') {
          wmY = height - watermark.bitmap.height - 20;
        } else if (pos === 'bottom-right') {
          wmX = width - watermark.bitmap.width - 20;
          wmY = height - watermark.bitmap.height - 20;
        } else if (pos === 'center') {
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
      let fontPreset = SANS_32_WHITE;
      const size = overlayFontSize || 32;
      if (size <= 16) {
        fontPreset = SANS_16_WHITE;
      } else if (size >= 64) {
        fontPreset = SANS_64_WHITE;
      }

      const font = await loadFont(fontPreset);
      const text = overlayText.trim();
      const textWidth = measureText(font, text);
      const textHeight = measureTextHeight(font, text, textWidth);

      let tx = 20;
      let ty = 20;
      const pos = (overlayPosition || 'bottom-right').toLowerCase();

      if (pos === 'top-right') {
        tx = width - textWidth - 20;
      } else if (pos === 'bottom-left') {
        ty = height - textHeight - 20;
      } else if (pos === 'bottom-right') {
        tx = width - textWidth - 20;
        ty = height - textHeight - 20;

        // If we also composite a watermark at bottom-right, offset the text upwards
        if (overlayWatermark) {
          ty -= 40;
        }
      } else if (pos === 'center') {
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
    const dir = path.dirname(originalPath);
    const ext = path.extname(originalPath);
    const base = path.basename(originalPath, ext);
    const newFilename = `${base}-overlay-${Date.now()}${ext}`;
    const newPath = path.join(dir, newFilename);

    await image.write(newPath as `${string}.${string}`);
    return `/uploads/${newFilename}`;
  } catch (error) {
    console.error('Error applying image overlay:', error);
    return imageUrl; // Fall back to original image on error
  }
}
