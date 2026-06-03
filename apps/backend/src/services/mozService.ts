import crypto from 'crypto';
import prisma from '../lib/prisma';

export interface MozMetrics {
  domainAuthority: number;
  pageAuthority: number;
}

export async function fetchMozMetrics(targetUrl: string, workspaceId?: number): Promise<MozMetrics | null> {
  const conn = await prisma.socialConnection.findFirst({
    where: { platform: 'moz', workspaceId }
  });
  const accessId = conn?.pageId || process.env.MOZ_ACCESS_ID;
  const secretKey = conn?.accessToken || process.env.MOZ_SECRET_KEY;

  if (!accessId || !secretKey) {
    return null;
  }

  // 1. Calculate expires (current time + 300 seconds)
  const expires = Math.floor(Date.now() / 1000) + 300;

  // 2. String to sign: accessId + "\n" + expires
  const stringToSign = `${accessId}\n${expires}`;

  // 3. Compute HMAC-SHA1 hash using secretKey as the key
  const hmac = crypto.createHmac('sha1', secretKey);
  hmac.update(stringToSign);
  const signature = encodeURIComponent(hmac.digest('base64'));

  // 4. Columns: Page Authority (34359738368) + Domain Authority (68719476736) = 103079215104
  const cols = '103079215104';

  // 5. Construct URL-Metrics request url
  const targetEncoded = encodeURIComponent(targetUrl);
  const url = `https://lsapi.seomoz.com/linkscape/url-metrics/${targetEncoded}?Cols=${cols}&AccessID=${accessId}&Expires=${expires}&Signature=${signature}`;

  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(10000), // 10s timeout
    });

    if (!res.ok) {
      console.error(`Moz API error: ${res.status} ${res.statusText}`);
      return null;
    }

    const data = await res.json() as { pda?: number; upa?: number };
    
    return {
      domainAuthority: typeof data.pda === 'number' ? Math.round(data.pda) : 0,
      pageAuthority: typeof data.upa === 'number' ? Math.round(data.upa) : 0,
    };
  } catch (error) {
    console.error('Failed to fetch metrics from Moz API:', error);
    return null;
  }
}
