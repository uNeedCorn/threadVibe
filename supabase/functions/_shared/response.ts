/**
 * 標準化 Response 工具
 */

import { getCorsHeaders } from './cors.ts';

const EXPOSE_ERROR_DETAILS = Deno.env.get('EXPOSE_ERROR_DETAILS') === 'true';

/**
 * 成功回應
 */
export function jsonResponse<T>(
  req: Request,
  data: T,
  status: number = 200
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...getCorsHeaders(req),
      'Content-Type': 'application/json',
    },
  });
}

/**
 * 錯誤回應
 */
export function errorResponse(
  req: Request,
  message: string,
  status: number = 400,
  code?: string
): Response {
  const safeMessage =
    status >= 500 && !EXPOSE_ERROR_DETAILS && code !== 'CONFIG_ERROR'
      ? 'Internal server error'
      : message;

  return new Response(
    JSON.stringify({
      error: safeMessage,
      code: code ?? getDefaultErrorCode(status),
    }),
    {
      status,
      headers: {
        ...getCorsHeaders(req),
        'Content-Type': 'application/json',
      },
    }
  );
}

function getDefaultErrorCode(status: number): string {
  switch (status) {
    case 400: return 'BAD_REQUEST';
    case 401: return 'UNAUTHORIZED';
    case 403: return 'FORBIDDEN';
    case 404: return 'NOT_FOUND';
    case 409: return 'CONFLICT';
    case 429: return 'RATE_LIMITED';
    case 500: return 'INTERNAL_ERROR';
    default: return 'ERROR';
  }
}

/**
 * 未授權回應
 */
export function unauthorizedResponse(
  req: Request,
  message: string = 'Unauthorized'
): Response {
  return errorResponse(req, message, 401, 'UNAUTHORIZED');
}

/**
 * 禁止存取回應
 */
export function forbiddenResponse(
  req: Request,
  message: string = 'Forbidden'
): Response {
  return errorResponse(req, message, 403, 'FORBIDDEN');
}

/**
 * 資源不存在回應
 */
export function notFoundResponse(
  req: Request,
  message: string = 'Not found'
): Response {
  return errorResponse(req, message, 404, 'NOT_FOUND');
}
