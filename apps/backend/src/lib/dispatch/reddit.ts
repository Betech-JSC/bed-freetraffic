import { renderContent } from './render';
import type { DispatchPayload, DispatchResult } from './types';
import prisma from '../../lib/prisma';

interface RedditTokenResponse {
  access_token?: string;
  error?: string;
}

interface RedditSubmitResponse {
  json?: {
    errors?: Array<[string, string, string]>;
    data?: {
      url?: string;
      id?: string;
    };
  };
}

export async function dispatchReddit(payload: DispatchPayload): Promise<DispatchResult> {
  const conn = await prisma.socialConnection.findFirst({
    where: { platform: 'reddit', workspaceId: payload.workspaceId }
  });
  let clientId = process.env.REDDIT_CLIENT_ID;
  let clientSecret = process.env.REDDIT_CLIENT_SECRET;
  let username = process.env.REDDIT_USERNAME;
  let password = process.env.REDDIT_PASSWORD;
  let subreddit = process.env.REDDIT_SUBREDDIT || 'test';

  if (conn) {
    try {
      const config = JSON.parse(conn.accessToken);
      clientId = config.clientId || clientId;
      clientSecret = config.clientSecret || clientSecret;
      username = config.username || username;
      password = config.password || password;
      subreddit = conn.pageId || config.subreddit || subreddit;
    } catch (e) {
      console.error('Failed to parse Reddit config from DB', e);
    }
  }

  if (!clientId || !clientSecret || !username || !password) {
    return {
      success: false,
      message: 'Chưa cấu hình thông tin API Reddit trong hệ thống (Client ID, etc.)',
    };
  }

  const text = renderContent(payload.content, {
    urlTarget: payload.urlTarget,
    name: payload.title,
  });

  const userAgent = `BeTrafficBot/1.0 (by /u/${username})`;

  try {
    // 1. Get Access Token via password grant
    const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const tokenUrl = 'https://www.reddit.com/api/v1/access_token';
    const tokenBody = new URLSearchParams({
      grant_type: 'password',
      username,
      password,
    });

    const tokenRes = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authHeader}`,
        'User-Agent': userAgent,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenBody.toString(),
      signal: AbortSignal.timeout(10000),
    });

    if (!tokenRes.ok) {
      return {
        success: false,
        message: `Reddit Auth failed: HTTP ${tokenRes.status}`,
      };
    }

    const tokenData = await tokenRes.json() as RedditTokenResponse;
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      return {
        success: false,
        message: `Reddit Auth failed: ${tokenData.error || 'no token received'}`,
      };
    }

    // 2. Submit post to Subreddit
    // If we have a target URL, we submit as a link post, otherwise as a self/text post.
    const isLinkPost = !!payload.urlTarget;
    const submitUrl = 'https://oauth.reddit.com/api/submit';
    
    const submitBody = new URLSearchParams({
      sr: subreddit,
      title: payload.title,
      kind: isLinkPost ? 'link' : 'self',
      api_type: 'json',
    });

    if (isLinkPost) {
      submitBody.append('url', payload.urlTarget || '');
    } else {
      submitBody.append('text', text);
    }

    const submitRes = await fetch(submitUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'User-Agent': userAgent,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: submitBody.toString(),
      signal: AbortSignal.timeout(15000),
    });

    if (!submitRes.ok) {
      return {
        success: false,
        message: `Reddit Submission failed: HTTP ${submitRes.status}`,
      };
    }

    const submitData = await submitRes.json() as RedditSubmitResponse;
    const errors = submitData.json?.errors;
    if (errors && errors.length > 0) {
      return {
        success: false,
        message: `Reddit API error: ${errors[0][1]} (${errors[0][0]})`,
      };
    }

    const postUrl = submitData.json?.data?.url || `https://reddit.com/r/${subreddit}`;
    return {
      success: true,
      message: `Đã đăng bài lên Reddit (r/${subreddit}): ${postUrl}`,
    };
  } catch (e: any) {
    return {
      success: false,
      message: `Lỗi kết nối Reddit: ${e.message || e}`,
    };
  }
}
