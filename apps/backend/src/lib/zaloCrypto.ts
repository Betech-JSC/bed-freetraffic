import crypto from 'crypto';

export function generateCodeVerifier(): string {
  // 32 bytes generates a base64url string of length 43
  return crypto.randomBytes(32).toString('base64url').substring(0, 43);
}

export function generateCodeChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

// In-memory map to store verification codes for the unified connect flow
// Key: state, Value: code_verifier
export const zaloVerifiers = new Map<string, string>();
