import { dispatchCommunity } from './community';
import { dispatchEmail } from './email';
import { dispatchFacebook } from './facebook';
import { dispatchYoutube } from './youtube';
import { dispatchZalo } from './zalo';
import { dispatchTelegram } from './telegram';
import { dispatchReddit } from './reddit';
import type { ChannelResult, DispatchPayload, DispatchPlatform, DispatchResult } from './types';

export type { ChannelResult, DispatchPayload, DispatchPlatform, DispatchResult };
export { DISPATCH_PLATFORMS } from './types';

export async function dispatchToPlatform(
  platform: string,
  payload: DispatchPayload
): Promise<DispatchResult> {
  const p = platform.trim().toLowerCase();
  if (p === 'facebook') return dispatchFacebook(payload);
  if (p === 'email') return dispatchEmail(payload);
  if (p === 'zalo') return dispatchZalo(payload);
  if (p === 'youtube') return dispatchYoutube(payload);
  if (p === 'community') return dispatchCommunity(payload);
  if (p === 'telegram') return dispatchTelegram(payload);
  if (p === 'reddit') return dispatchReddit(payload);
  return { success: false, message: `Kênh "${platform}" chưa hỗ trợ` };
}

export function parsePlatforms(platforms: string | null | undefined): string[] {
  if (!platforms) return [];
  const trimmed = platforms.trim();
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((p: any) => String(p).trim().toLowerCase()).filter(Boolean);
      }
    } catch {
      // ignore and fall through
    }
  }
  return trimmed
    .split(',')
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
}

export async function dispatchToAllPlatforms(
  platforms: string | null | undefined,
  payload: DispatchPayload
): Promise<ChannelResult[]> {
  const list = parsePlatforms(platforms);
  const results: ChannelResult[] = [];

  for (const platform of list) {
    const r = await dispatchToPlatform(platform, {
      ...payload,
      emailRecipients: platform === 'email' ? payload.emailRecipients : undefined,
    });
    results.push({
      platform,
      success: r.success,
      message: r.message,
      at: new Date().toISOString(),
    });
  }

  return results;
}

export function summarizeChannelResults(results: ChannelResult[]): {
  status: 'PUBLISHED' | 'PARTIAL' | 'FAILED';
  errorMessage: string | null;
} {
  if (results.length === 0) {
    return { status: 'FAILED', errorMessage: 'Không có kênh nào' };
  }
  const ok = results.filter((r) => r.success).length;
  if (ok === results.length) return { status: 'PUBLISHED', errorMessage: null };
  if (ok === 0) {
    return {
      status: 'FAILED',
      errorMessage: results.map((r) => `${r.platform}: ${r.message}`).join(' | '),
    };
  }
  return {
    status: 'PARTIAL',
    errorMessage: results
      .filter((r) => !r.success)
      .map((r) => `${r.platform}: ${r.message}`)
      .join(' | '),
  };
}
