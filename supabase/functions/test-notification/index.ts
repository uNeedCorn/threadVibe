/**
 * 測試 Telegram 通知功能
 * 驗證 secrets 設定是否正確
 */

import { handleCors } from '../_shared/cors.ts';
import { jsonResponse, errorResponse } from '../_shared/response.ts';
import { notifyTest, notifyError } from '../_shared/notification.ts';

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const url = new URL(req.url);
  const type = url.searchParams.get('type') || 'test';

  // 檢查 credentials 是否有設定
  const token = Deno.env.get('TELEGRAM_BOT_TOKEN');
  const chatId = Deno.env.get('TELEGRAM_CHAT_ID');

  console.log('TELEGRAM_BOT_TOKEN exists:', !!token);
  console.log('TELEGRAM_CHAT_ID exists:', !!chatId);

  if (!token || !chatId) {
    return jsonResponse(req, {
      success: false,
      error: 'Telegram credentials not configured',
      hasToken: !!token,
      hasChatId: !!chatId,
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
