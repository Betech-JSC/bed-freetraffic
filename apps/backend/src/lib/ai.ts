export function getAiConfig(path: string = '/chat/completions') {
  const apiKey = process.env.OPENAI_API_KEY || '';
  let model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  let url = `https://api.openai.com/v1${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  };

  if (apiKey.startsWith('sk-or-')) {
    // OpenRouter integration
    url = `https://openrouter.ai/api/v1${path}`;
    headers['HTTP-Referer'] = 'http://localhost:4000';
    headers['X-Title'] = 'Growth OS';
    
    // Map default model or deprecated/rate-limited free model to a working free model on OpenRouter
    if (
      model === 'gpt-4o-mini' ||
      model === 'google/gemini-2.5-flash:free' ||
      model === 'meta-llama/llama-3.3-70b-instruct:free'
    ) {
      model = 'google/gemma-4-31b-it:free';
    }
  }

  return { apiKey, url, model, headers };
}
