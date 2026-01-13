import { NextResponse } from "next/server";

const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY;
const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * POST /api/turnstile/verify
 * 驗證 Cloudflare Turnstile token
 */
export async function POST(request: Request) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json(
        { success: false, error: "MISSING_TOKEN" },
        { status: 400 }
      );
    }

    if (!TURNSTILE_SECRET_KEY) {
      console.error("TURNSTILE_SECRET_KEY is not configured");
      // 如果沒有設定 secret key，視為開發模式，直接通過
      return NextResponse.json({ success: true, dev: true });
    }

    // 向 Cloudflare 驗證 token
    const formData = new URLSearchParams();
    formData.append("secret", TURNSTILE_SECRET_KEY);
    formData.append("response", token);

    const verifyResponse = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    const result = await verifyResponse.json();

    if (result.success) {
      return NextResponse.json({ success: true });
    } else {
      console.error("Turnstile verification failed:", result);
      return NextResponse.json(
        { success: false, error: "VERIFICATION_FAILED", details: result["error-codes"] },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Turnstile verification error:", error);
    return NextResponse.json(
      { success: false, error: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
