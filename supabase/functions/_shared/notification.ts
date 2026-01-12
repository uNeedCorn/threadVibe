/**
 * Telegram 通知模組
 * 用於同步異常時發送即時通知
 */

interface NotifyOptions {
  jobType: string;
  error: string;
  context?: Record<string, unknown>;
}

/**
 * 取得 Telegram 認證資訊
 */
function getTelegramCredentials(): { token: string; chatId: string } | null {
  const token = Deno.env.get('TELEGRAM_BOT_TOKEN');
  const chatId = Deno.env.get('TELEGRAM_CHAT_ID');

  if (!token || !chatId) {
    return null;
  }

  return { token, chatId };
}

/**
 * 發送錯誤通知到 Telegram
 */
export async function notifyError(options: NotifyOptions): Promise<TelegramResult> {
  const credentials = getTelegramCredentials();
  if (!credentials) {
    return { success: false, error: 'Telegram credentials not configured' };
  }

  const { jobType, error, context } = options;

  let message = `🚨 *同步異常*\n\n`;
  message += `*Job:* \`${jobType}\`\n`;
  message += `*Error:* ${escapeMarkdown(error)}\n`;
  message += `*Time:* ${new Date().toISOString()}\n`;

  if (context) {
    message += `\n*Context:*\n\`\`\`json\n${JSON.stringify(context, null, 2)}\n\`\`\``;
  }

  return await sendTelegram(credentials, message);
}

/**
 * 發送測試訊息
 */
export async function notifyTest(): Promise<TelegramResult> {
  const credentials = getTelegramCredentials();
  if (!credentials) {
    return { success: false, error: 'Telegram credentials not configured' };
  }

  const message = `✅ *ThreadsVibe 通知測試*\n\n` +
    `Telegram 通知功能運作正常！\n` +
    `Time: ${new Date().toISOString()}`;

  return await sendTelegram(credentials, message);
}

/**
 * 發送 Telegram 訊息
 */
export interface TelegramResult {
  success: boolean;
  error?: string;
  status?: number;
}

async function sendTelegram(
  credentials: { token: string; chatId: string },
  text: string
): Promise<TelegramResult> {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${credentials.token}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: credentials.chatId,
          text,
          parse_mode: 'Markdown',
        }),
      }
    );

    const responseData = await response.text();

    if (!response.ok) {
      return { success: false, error: responseData, status: response.status };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/**
 * 轉義 Markdown 特殊字元
 */
function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}
