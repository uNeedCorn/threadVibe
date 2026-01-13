import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = {
  name: string;
  value: string;
  options?: Record<string, unknown>;
};

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Do not run code between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  // 如果 JWT 無效，清除 cookies 中的 session
  if (authError?.message?.includes("Invalid JWT") || authError?.code === "bad_jwt") {
    // 清除 auth cookies
    const response = NextResponse.redirect(new URL("/login", request.url));
    request.cookies.getAll().forEach((cookie) => {
      if (cookie.name.includes("auth-token")) {
        response.cookies.delete(cookie.name);
      }
    });
    return response;
  }

  const isLoginPage = request.nextUrl.pathname === "/login";
  const isAuthCallback = request.nextUrl.pathname.startsWith("/auth/callback");
  const isInvitationPage = request.nextUrl.pathname.startsWith("/register/invitation");
  const isPublicApiRoute = request.nextUrl.pathname.startsWith("/api/turnstile") ||
                           request.nextUrl.pathname.startsWith("/api/waitlist");
  const isWaitlistPendingPage = request.nextUrl.pathname === "/waitlist/pending";
  const isMarketingPage = request.nextUrl.pathname === "/" ||
                          request.nextUrl.pathname.startsWith("/#");
  const isPublicPath = isLoginPage || isAuthCallback || isInvitationPage || isPublicApiRoute || isMarketingPage;

  // 未登入且不在公開頁面 → 導向登入頁
  if (!user && !isPublicPath && !isWaitlistPendingPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // 已登入用戶：檢查是否為現有會員或已通過 waitlist 審核
  if (user && !isPublicPath && !isWaitlistPendingPage) {
    // 檢查是否已是現有會員（有 workspace_members 記錄）
    const { data: membership } = await supabase
      .from("workspace_members")
      .select("id")
      .eq("user_id", user.id)
      .limit(1);

    const isExistingMember = membership && membership.length > 0;

    if (!isExistingMember) {
      // 非現有會員，檢查 waitlist 狀態（用 email 比對）
      const { data: waitlistEntry } = await supabase
        .from("beta_waitlist")
        .select("status")
        .eq("email", user.email)
        .maybeSingle();

      // 如果不在 waitlist 或狀態不是 approved，導向等待頁
      if (!waitlistEntry || waitlistEntry.status !== "approved") {
        const url = request.nextUrl.clone();
        url.pathname = "/waitlist/pending";
        return NextResponse.redirect(url);
      }
    }
  }

  // 已登入且在登入頁 → 導向 Dashboard 或設定頁
  if (user && isLoginPage) {
    // 先檢查 waitlist 狀態
    const { data: membership } = await supabase
      .from("workspace_members")
      .select("id")
      .eq("user_id", user.id)
      .limit(1);

    const isExistingMember = membership && membership.length > 0;

    if (!isExistingMember) {
      const { data: waitlistEntry } = await supabase
        .from("beta_waitlist")
        .select("status")
        .eq("email", user.email)
        .maybeSingle();

      if (!waitlistEntry || waitlistEntry.status !== "approved") {
        const url = request.nextUrl.clone();
        url.pathname = "/waitlist/pending";
        return NextResponse.redirect(url);
      }
    }

    // 檢查是否有連結 Threads 帳號
    const { data: accounts } = await supabase
      .from("workspace_threads_accounts")
      .select("id")
      .limit(1);

    const url = request.nextUrl.clone();
    url.pathname = accounts && accounts.length > 0 ? "/dashboard" : "/settings";
    return NextResponse.redirect(url);
  }

  // 已登入且在 waitlist pending 頁面，但已通過審核 → 導向設定頁
  if (user && isWaitlistPendingPage) {
    const { data: membership } = await supabase
      .from("workspace_members")
      .select("id")
      .eq("user_id", user.id)
      .limit(1);

    const isExistingMember = membership && membership.length > 0;

    if (isExistingMember) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }

    const { data: waitlistEntry } = await supabase
      .from("beta_waitlist")
      .select("status")
      .eq("email", user.email)
      .maybeSingle();

    if (waitlistEntry?.status === "approved") {
      const url = request.nextUrl.clone();
      url.pathname = "/settings";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
