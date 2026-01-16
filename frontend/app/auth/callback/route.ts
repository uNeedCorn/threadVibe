import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const userAgent = request.headers.get("user-agent") || "unknown";
  const isSafari = userAgent.includes("Safari") && !userAgent.includes("Chrome");

  // 偵錯：列出所有收到的 cookies
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();
  const cookieNames = allCookies.map(c => c.name);
  const hasCodeVerifier = cookieNames.some(name => name.includes("code-verifier"));

  console.log("[OAuth Callback] Request:", {
    hasCode: !!code,
    codeLength: code?.length,
    isSafari,
    cookieCount: allCookies.length,
    cookieNames,
    hasCodeVerifier,
    userAgent: userAgent.substring(0, 100),
  });

  if (code) {
    const supabase = await createClient();
    console.log("[OAuth Callback] Exchanging code for session...");

    const { error, data: sessionData } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("[OAuth Callback] Exchange failed:", {
        message: error.message,
        status: error.status,
        name: error.name,
        isSafari,
      });
      return NextResponse.redirect(`${origin}/login?error=auth_failed&reason=${encodeURIComponent(error.message)}`);
    }

    if (sessionData?.user) {
      console.log("[OAuth Callback] Success! User:", sessionData.user.email);
      // 簡化版：直接導向 dashboard
      return NextResponse.redirect(`${origin}/dashboard`);
    }
  }

  console.log("[OAuth Callback] No code provided");
  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
