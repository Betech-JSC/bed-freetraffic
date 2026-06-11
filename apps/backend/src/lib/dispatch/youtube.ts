import { google } from 'googleapis';
import { getOAuth2Client } from '../google';
import { renderContent } from './render';
import type { DispatchPayload, DispatchResult } from './types';
import fs from 'fs';
import path from 'path';

/**
 * YouTube - Publishes scheduled video using Google YouTube Data API v3.
 * Automatically obtains the user's OAuth tokens from the database.
 */
export async function dispatchYoutube(payload: DispatchPayload): Promise<DispatchResult> {
  const description = renderContent(payload.content, {
    urlTarget: payload.urlTarget,
    name: payload.title,
  });

  if (!payload.workspaceId) {
    return {
      success: false,
      message: 'Không xác định được Workspace ID để lấy thông tin YouTube (Google OAuth)',
    };
  }

  try {
    // 1. Lấy OAuth2 client từ db
    const oauth2Client = await getOAuth2Client(payload.workspaceId);
    if (!oauth2Client) {
      return {
        success: false,
        message: 'Chưa kết nối tài khoản Google OAuth trong Cài đặt (yêu cầu quyền youtube.upload)',
      };
    }

    // 2. Kiểm tra file video đính kèm
    if (!payload.imageUrl) {
      return {
        success: false,
        message: 'Kênh YouTube yêu cầu tải lên tệp tin video (MP4/WebM/AVI/MOV)',
      };
    }

    const filename = payload.imageUrl.split('/').pop() || '';
    const fileExt = path.extname(filename).toLowerCase();
    const isVideo = ['.mp4', '.webm', '.avi', '.mov', '.mkv'].includes(fileExt);

    if (!isVideo) {
      return {
        success: false,
        message: `Tệp tin "${filename}" không phải định dạng video được hỗ trợ. Vui lòng chọn tệp video.`,
      };
    }

    // Dùng đường dẫn tương đối hoặc tuyệt đối phòng trường hợp chạy dev/build khác nhau
    const possiblePaths = [
      path.join(__dirname, '../../../../uploads', filename),
      path.join(__dirname, '../../../uploads', filename),
      path.join(process.cwd(), 'uploads', filename),
      path.join(process.cwd(), 'apps/backend/uploads', filename),
    ];
    let uploadPath = '';
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        uploadPath = p;
        break;
      }
    }

    if (!uploadPath) {
      return {
        success: false,
        message: `Không tìm thấy tệp video trên máy chủ: ${filename}`,
      };
    }

    console.log(`[YouTube Upload] Bắt đầu tải video lên channel: ${filename} (Path: ${uploadPath})`);

    // 3. Khởi tạo YouTube client và thực hiện upload
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
    const response = await youtube.videos.insert({
      part: ['snippet', 'status'],
      requestBody: {
        snippet: {
          title: payload.title,
          description: description,
          tags: ['freetraffic', 'growthos', 'marketing'],
        },
        status: {
          privacyStatus: 'public',
        },
      },
      media: {
        body: fs.createReadStream(uploadPath),
      },
    });

    const videoId = response.data.id;
    const videoUrl = videoId ? `https://www.youtube.com/watch?v=${videoId}` : '';

    return {
      success: true,
      message: `Đã đăng video trực tiếp lên YouTube thành công! Video URL: ${videoUrl}`,
    };
  } catch (err: any) {
    console.error('[YouTube Upload] Lỗi API YouTube:', err);
    return {
      success: false,
      message: `Lỗi tải video lên YouTube: ${err.message || err}`,
    };
  }
}
