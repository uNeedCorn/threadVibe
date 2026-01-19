import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  // 驗證 next 參數為站內路徑，防止 Open Redirect 攻擊
  const rawNext = searchParams.get("next") ?? "/dashboard";
  let next = "/dashboard";
  try {
    // 使用 URL 解析器驗證，確保是同源相對路徑
    const testUrl = new URL(rawNext, origin);
    if (testUrl.origin === origin && testUrl.pathname.startsWith("/")) {
      next = testUrl.pathname + testUrl.search + testUrl.hash;
    }
  } catch {
    // URL 解析失敗，使用預設值
    next = "/dashboard";
  }

  if (code) {
    const supabase = await createClient();
    const { error, data: sessionData } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("[OAuth Callback] Exchange failed:", error.message);
      return NextResponse.redirect(`${origin}/login_2026Q1?error=auth_failed`);
    }

    if (sessionData?.user) {
      const user = sessionData.user;

      // 使用 service role client 繞過 RLS 進行 workspace 操作
      const serviceClient = createServiceClient();

      // 檢查是否有 Workspace（判斷是否為新使用者）
      const { data: memberships } = await serviceClient
        .from("workspace_members")
        .select("workspace_id, workspaces(id, name)")
        .eq("user_id", user.id)
        .limit(1);

      let workspaceId: string | null = null;
      const isNewUser = !memberships || memberships.length === 0;

      if (isNewUser) {
        // 新使用者：自動建立 workspace
        const displayName =
          user.user_metadata?.name ||
          user.user_metadata?.full_name ||
          user.email?.split("@")[0] ||
          "我";

        const { data: newWorkspace, error: createError } = await serviceClient
          .from("workspaces")
          .insert({
            name: `${displayName} 的工作區`,
            created_by_user_id: user.id,
          })
          .select()
          .single();

        if (createError) {
          console.error("Failed to create workspace:", createError);
          return NextResponse.redirect(`${origin}/login_2026Q1?error=workspace_failed`);
        }

        if (newWorkspace) {
          // 建立成員關係（owner）
          const { error: memberError } = await serviceClient
            .from("workspace_members")
            .insert({
              workspace_id: newWorkspace.id,
              user_id: user.id,
              role: "owner",
              joined_at: new Date().toISOString(),
            });

          if (memberError) {
            console.error("Failed to create workspace member:", memberError);
          }

          workspaceId = newWorkspace.id;
        }

        // 新使用者導向設定頁
        return NextResponse.redirect(`${origin}/settings?workspace_id=${workspaceId}`);
      } else {
        // 已有 Workspace（舊使用者）
        const workspace = memberships[0].workspaces as unknown as { id: string; name: string } | null;
        workspaceId = workspace?.id || null;
      }

      // 檢查是否有連結 Threads 帳號
      let hasThreadsAccount = false;
      if (workspaceId) {
        const { data: accounts } = await serviceClient
          .from("workspace_threads_accounts")
          .select("id")
          .eq("workspace_id", workspaceId)
          .eq("is_active", true)
          .limit(1);

        hasThreadsAccount = !!(accounts && accounts.length > 0);
      }

      // 決定導向頁面，並帶上 workspace_id 讓前端儲存
      const redirectPath = hasThreadsAccount ? next : "/settings";
      const redirectUrl = new URL(redirectPath, origin);
      if (workspaceId) {
        redirectUrl.searchParams.set("workspace_id", workspaceId);
      }

      return NextResponse.redirect(redirectUrl.toString());
    }
  }

  return NextResponse.redirect(`${origin}/login_2026Q1?error=auth_failed`);
}
