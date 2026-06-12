export type DispatchPayload = {
  title: string;
  content: string;
  imageUrl?: string | null;
  urlTarget?: string;
  emailRecipients?: string;
  workspaceId?: number;
  connectionId?: number;
};

export type DispatchResult = {
  success: boolean;
  message: string;
};

export type ChannelResult = {
  platform: string;
  success: boolean;
  message: string;
  at: string;
};

export const DISPATCH_PLATFORMS = ['facebook', 'email', 'zalo', 'youtube', 'community', 'telegram', 'reddit', 'tiktok', 'wordpress'] as const;
export type DispatchPlatform = (typeof DISPATCH_PLATFORMS)[number];
