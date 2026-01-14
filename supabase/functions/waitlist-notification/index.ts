import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/**
 * Waitlist Notification Edge Function
 * 當有新用戶申請加入 waitlist 時發送 Telegram 通知
 *
 * 觸發方式：Database Webhook (on INSERT to beta_waitlist)
 */

interface WaitlistRecord {
  id: string;
  email: string;
  name: string | null;
  threads_username: string | null;
  user_type: string | null;
  follower_tier: string | null;
  referral_source: string | null;
  reason: string | null;
  created_at: string;
}

interface WebhookPayload {
  type: "INSERT";
  table: "beta_waitlist";
  record: WaitlistRecord;
  schema: "public";
}

Deno.serve(async (req: Request) => {
  try {
    // 驗證請求方法
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    // 解析 webhook payload
    const payload: WebhookPayload = await req.json();

    // 只處理 INSERT 事件
    if (payload.type !== "INSERT") {
      return new Response("Ignored: not an INSERT event", { status: 200 });
    }

    const record = payload.record;

    // 取得 Telegram 認證
    const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const chatId = Deno.env.get("TELEGRAM_CHAT_ID");

    if (!token || !chatId) {
      console.error("Telegram credentials not configured");
      return new Response("Telegram not configured", { status: 200 });
    }

    // 組成通知訊息
    const message = formatMessage(record);

    // 發送 Telegram 通知
    const response = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: "Markdown",
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Telegram API error:", errorText);
      return new Response(`Telegram error: ${errorText}`, { status: 500 });
    }

    return new Response("Notification sent", { status: 200 });
  } catch (error) {
    console.error("Waitlist notification error:", error);
    return new Response(`Error: ${error}`, { status: 500 });
  }
});

/**
 * 格式化通知訊息
 */
function formatMessage(record: WaitlistRecord): string {
  const lines = [
    `📬 *Waitlist 新申請*`,
    ``,
    `*Email:* ${escapeMarkdown(record.email)}`,
  ];

  if (record.name) {
    lines.push(`*姓名:* ${escapeMarkdown(record.name)}`);
  }

  if (record.threads_username) {
    lines.push(`*Threads:* @${escapeMarkdown(record.threads_username)}`);
  }

  if (record.user_type) {
    lines.push(`*類型:* ${escapeMarkdown(record.user_type)}`);
  }

  if (record.follower_tier) {
    lines.push(`*粉絲數:* ${escapeMarkdown(record.follower_tier)}`);
  }

  if (record.referral_source) {
    lines.push(`*來源:* ${escapeMarkdown(record.referral_source)}`);
  }

  if (record.reason) {
    lines.push(`*原因:* ${escapeMarkdown(record.reason)}`);
  }

  lines.push(``);
  lines.push(`_${new Date(record.created_at).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })}_`);

  return lines.join("\n");
}

/**
 * 轉義 Markdown 特殊字元
 */
function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&");
}
