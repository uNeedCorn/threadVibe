import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  let workspaceId = searchParams.get("workspace_id");

  console.log("[threads-oauth] Starting OAuth flow for workspace:", workspaceId);

  const supabase = await createClient();

  // 先用 getUser() 驗證使用者身份（這會驗證 JWT）
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  console.log("[threads-oauth] getUser result:", { userId: user?.id, error: userError?.message });

  if (userError || !user) {
    console.error("[threads-oauth] Auth error:", userError?.message);

    // JWT 無效時，清除 session 並導向登入頁
    if (userError?.message?.includes("Invalid JWT") || userError?.code === "bad_jwt") {
      await supabase.auth.signOut();
    }

    // 導向登入頁，帶上原始目標 URL
    const loginUrl = new URL("/login_2026Q1", request.url);
    loginUrl.searchParams.set("error", "session_expired");
    return NextResponse.redirect(loginUrl);
  }

  // 如果沒有 workspaceId，從 DB 查詢使用者的 workspace
  if (!workspaceId) {
    console.log("[threads-oauth] No workspace_id provided, fetching from DB for user:", user.id);

    const serviceClient = createServiceClient();
    const { data: memberships } = await serviceClient
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", user.id)
      .not("joined_at", "is", null)
      .limit(1);

    if (memberships && memberships.length > 0) {
      workspaceId = memberships[0].workspace_id;
      console.log("[threads-oauth] Found workspace from DB:", workspaceId);
    } else {
      console.error("[threads-oauth] No workspace found for user");
      return NextResponse.json(
        { error: "No workspace found. Please create a workspace first." },
        { status: 400 }
      );
    }
  }

  // 獲取 session 以取得 access_token
  const { data: { session } } = await supabase.auth.getSession();

  console.log("[threads-oauth] Session exists:", !!session, "Token length:", session?.access_token?.length);

  if (!session?.access_token) {
    console.error("[threads-oauth] No access token in session");
    const loginUrl = new URL("/login_2026Q1", request.url);
    return NextResponse.redirect(loginUrl);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  try {
    const edgeFunctionUrl = `${supabaseUrl}/functions/v1/threads-oauth?workspace_id=${workspaceId}`;
    console.log("[threads-oauth] Calling Edge Function:", edgeFunctionUrl);

    // 呼叫 Supabase Edge Function，帶上 Authorization header
    const response = await fetch(
      edgeFunctionUrl,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        redirect: "manual",
      }
    );

    console.log("[threads-oauth] Edge Function response status:", response.status);

    // 取得 redirect URL
    const location = response.headers.get("location");

    if (location) {
      console.log("[threads-oauth] Redirecting to:", location);
      // 回傳重導向
      return NextResponse.redirect(location);
    }

    // 如果沒有 redirect，嘗試讀取錯誤訊息
    if (!response.ok) {
      const errorText = await response.text();
      console.error("[threads-oauth] Edge Function error:", errorText);
      try {
        const error = JSON.parse(errorText);
        return NextResponse.json(
          { error: error.error || error.message || "OAuth failed" },
          { status: response.status }
        );
      } catch {
        return NextResponse.json(
          { error: errorText || "OAuth failed" },
          { status: response.status }
        );
      }
    }

    return NextResponse.json(
      { error: "Unexpected response" },
      { status: 500 }
    );
  } catch (error) {
    console.error("Threads OAuth error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
