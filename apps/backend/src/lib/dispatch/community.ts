import { renderContent } from './render';
import type { DispatchPayload, DispatchResult } from './types';

/** Forum / Community — hướng dẫn đăng tay (Reddit, FB Group, v.v.) */
export async function dispatchCommunity(payload: DispatchPayload): Promise<DispatchResult> {
  const text = renderContent(payload.content, {
    urlTarget: payload.urlTarget,
    name: payload.title,
  });
  const preview = text.length > 280 ? `${text.slice(0, 277)}...` : text;
  return {
    success: true,
    message: `[Community] Sao chép & đăng thủ công: "${payload.title}" — ${preview}`,
  };
}
