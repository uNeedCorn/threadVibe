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
    const response = NextResponse.redirect(new URL("/login_2026Q1", request.url));
    request.cookies.getAll().forEach((cookie) => {
      if (cookie.name.includes("auth-token")) {
        response.cookies.delete(cookie.name);
      }
    });
    return response;
  }

  const pathname = request.nextUrl.pathname;

  // 需要登入才能存取的路由（受保護的 app 路由）
  const protectedPrefixes = [
    "/dashboard",
    "/settings",
    "/posts",
    "/insights",
    "/reports",
    "/scheduled",
    "/tags",
    "/admin",
  ];

  const isProtectedRoute = protectedPrefixes.some(prefix =>
    pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
  const isLoginPage = pathname === "/login_2026Q1";

  // 未登入且在受保護路由 → 導向登入頁
  if (!user && isProtectedRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login_2026Q1";
    return NextResponse.redirect(url);
  }

  // 已登入且在登入頁 → 導向 Dashboard 或設定頁
  if (user && isLoginPage) {
    // 檢查是否有連結 Threads 帳號
    const { data: accounts } = await supabase
      .from("workspace_threads_accounts")
      .select("id")
      .limit(1);

    const url = request.nextUrl.clone();
    url.pathname = accounts && accounts.length > 0 ? "/dashboard" : "/settings";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
