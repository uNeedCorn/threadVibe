/**
 * CORS Headers 設定
 */

function getAllowedOrigins(): string[] {
  const envOrigins = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const frontendUrl = Deno.env.get('FRONTEND_URL');
  const frontendOrigin = (() => {
    if (!frontendUrl) return null;
    try {
      return new URL(frontendUrl).origin;
    } catch {
      return null;
    }
  })();

  const defaults = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ];

  const merged = [
    ...envOrigins,
    ...(frontendOrigin ? [frontendOrigin] : []),
    ...defaults,
  ];

  return Array.from(new Set(merged));
}

const allowedOrigins = getAllowedOrigins();

export function getCorsHeaders(req: Request): Record<string, string> {
  const requestOrigin = req.headers.get('Origin');

  let allowOrigin = '*';
  if (requestOrigin) {
    if (allowedOrigins.length === 0) {
      allowOrigin = requestOrigin;
    } else if (allowedOrigins.includes(requestOrigin)) {
      allowOrigin = requestOrigin;
    } else {
      allowOrigin = 'null';
    }
  }

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

/**
 * 處理 CORS preflight 請求
 */
export function handleCors(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) });
  }
  return null;
}
