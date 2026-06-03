import { renderContent } from './render';
import type { DispatchPayload, DispatchResult } from './types';

/** YouTube — MVP: checklist đăng video / mô tả (API upload cần OAuth riêng) */
export async function dispatchYoutube(payload: DispatchPayload): Promise<DispatchResult> {
  const description = renderContent(payload.content, {
    urlTarget: payload.urlTarget,
    name: payload.title,
  });
  return {
    success: true,
    message: `[YouTube] Dùng mô tả sau khi upload video: Tiêu đề="${payload.title}" | Mô tả (280 ký tự đầu): ${description.slice(0, 280)}`,
  };
}
