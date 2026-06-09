import { renderContent, resolveUploadPath } from './render';
import type { DispatchPayload, DispatchResult } from './types';
import { publishToFacebookPage } from '../facebookPost';

export async function dispatchFacebook(payload: DispatchPayload): Promise<DispatchResult> {
  const postContent = renderContent(payload.content, {
    urlTarget: payload.urlTarget,
    name: payload.title,
  });
  const result = await publishToFacebookPage({
    message: postContent,
    link: payload.urlTarget,
    imagePath: resolveUploadPath(payload.imageUrl),
    workspaceId: payload.workspaceId,
    connectionId: payload.connectionId,
  });
  if (!result.success) return { success: false, message: result.message };
  return { success: true, message: 'Đăng Fanpage thành công' };
}
