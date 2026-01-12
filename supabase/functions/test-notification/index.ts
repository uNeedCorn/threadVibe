/**
 * 測試 Telegram 通知功能
 * 驗證 secrets 設定是否正確
 *
 * 需要 CRON_SECRET 認證
 */

import { handleCors } from '../_shared/cors.ts';
import { jsonResponse, unauthorizedResponse } from '../_shared/response.ts';
import { notifyTest, notifyError } from '../_shared/notification.ts';

const CRON_SECRET = Deno.env.get('CRON_SECRET');

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // 驗證 CRON_SECRET
  const authHeader = req.headers.get('Authorization');
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return unauthorizedResponse(req, 'Invalid cron secret');
  }

  const url = new URL(req.url);
  const type = url.searchParams.get('type') || 'test';

  // 檢查 Telegram credentials 是否有設定
  const token = Deno.env.get('TELEGRAM_BOT_TOKEN');
  const chatId = Deno.env.get('TELEGRAM_CHAT_ID');

  if (!token || !chatId) {
    return jsonResponse(req, {
      success: false,
      error: 'Telegram credentials not configured',
    });
  }

  try {
    let result;

    if (type === 'error') {
      // 測試錯誤通知格式
      result = await notifyError({
        jobType: 'test-notification',
        error: '這是測試錯誤訊息',
        context: { test: true, timestamp: Date.now() },
      });
    } else {
      // 一般測試訊息
      result = await notifyTest();
    }

    return jsonResponse(req, result);
  } catch (err) {
    console.error('Error:', err);
    return jsonResponse(req, { success: false, error: String(err) });
  }
});
