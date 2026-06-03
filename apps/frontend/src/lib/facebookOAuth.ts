/** OAuth URL khi backend chưa chạy — scopes mặc định khớp backend */
export function buildFacebookOAuthUrl(appId: string, redirectUri: string): string {
  const graphVersion = 'v21.0';
  const scopes = 'public_profile,pages_show_list,pages_read_engagement,pages_manage_posts';
  const params = new URLSearchParams({
    client_id: appId.trim(),
    redirect_uri: redirectUri,
    scope: scopes,
    response_type: 'code',
  });
  return `https://www.facebook.com/${graphVersion}/dialog/oauth?${params.toString()}`;
}
