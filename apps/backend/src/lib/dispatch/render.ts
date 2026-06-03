import fs from 'fs';
import path from 'path';

export function renderContent(
  content: string,
  vars: { urlTarget?: string; name?: string }
): string {
  return content
    .replace(/\{url\}/g, vars.urlTarget || '')
    .replace(/\{name\}/g, vars.name || '')
    .replace(/\{date\}/g, new Date().toLocaleDateString('vi-VN'));
}

export function resolveUploadPath(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null;
  const rel = imageUrl.startsWith('/') ? imageUrl.slice(1) : imageUrl;
  const imagePath = path.join(__dirname, '../../../', rel);
  return fs.existsSync(imagePath) ? imagePath : null;
}
