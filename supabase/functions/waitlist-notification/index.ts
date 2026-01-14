import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/**
 * Waitlist Notification Edge Function
 * 當有新用戶申請加入 waitlist 時發送 Telegram 通知
 */

interface WaitlistData {
  email: string;
  name?: string | null;
  threadsUsername?: string | null;
  userType?: string | null;
  followerTier?: string | null;
  referralSource?: string | null;
  reason?: string | null;
}

Deno.serve(async (req: Request) => {
  try {
    // 驗證請求方法
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    // 解析請求
    const data: WaitlistData = await req.json();

    if (!data.email) {
      return new Response("Email is required", { status: 400 });
    }

    // 取得 Telegram 認證
    const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const chatId = Deno.env.get("TELEGRAM_CHAT_ID");

    if (!token || !chatId) {
      console.error("Telegram credentials not configured");
      return new Response(JSON.stringify({ success: false, error: "Telegram not configured" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 組成通知訊息
    const message = formatMessage(data);

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
      return new Response(JSON.stringify({ success: false, error: errorText }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Waitlist notification error:", error);
    return new Response(JSON.stringify({ success: false, error: String(error) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

/**
 * 格式化通知訊息
 */
function formatMessage(data: WaitlistData): string {
  const lines = [
    `📬 *Waitlist 新申請*`,
    ``,
    `*Email:* ${escapeMarkdown(data.email)}`,
  ];

  if (data.name) {
    lines.push(`*姓名:* ${escapeMarkdown(data.name)}`);
  }

  if (data.threadsUsername) {
    lines.push(`*Threads:* @${escapeMarkdown(data.threadsUsername)}`);
  }

  if (data.userType) {
    lines.push(`*類型:* ${escapeMarkdown(data.userType)}`);
  }

  if (data.followerTier) {
    lines.push(`*粉絲數:* ${escapeMarkdown(data.followerTier)}`);
  }

  if (data.referralSource) {
    lines.push(`*來源:* ${escapeMarkdown(data.referralSource)}`);
  }

  if (data.reason) {
    lines.push(`*原因:* ${escapeMarkdown(data.reason)}`);
  }

  lines.push(``);
  lines.push(`_${new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })}_`);

  return lines.join("\n");
}

/**
 * 轉義 Markdown 特殊字元
 */
function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&");
}
