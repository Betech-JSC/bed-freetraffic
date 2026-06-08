import fs from 'fs';
import path from 'path';

export function renderContent(
  content: string,
  vars: { urlTarget?: string; name?: string; description?: string; date?: string | Date }
): string {
  const dateStr = vars.date
    ? new Date(vars.date).toLocaleDateString('vi-VN')
    : new Date().toLocaleDateString('vi-VN');
  return content
    .replace(/\{url\}/g, vars.urlTarget || '')
    .replace(/\{name\}/g, vars.name || '')
    .replace(/\{description\}/g, vars.description || '')
    .replace(/\{date\}/g, dateStr);
}

export function resolveUploadPath(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null;
  const rel = imageUrl.startsWith('/') ? imageUrl.slice(1) : imageUrl;
  const imagePath = path.join(__dirname, '../../../', rel);
  return fs.existsSync(imagePath) ? imagePath : null;
}
