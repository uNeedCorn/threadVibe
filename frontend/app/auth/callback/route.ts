import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const userAgent = request.headers.get("user-agent") || "unknown";
  const isSafari = userAgent.includes("Safari") && !userAgent.includes("Chrome");

  console.log("[OAuth Callback]", {
    hasCode: !!code,
    codeLength: code?.length,
    isSafari,
    userAgent: userAgent.substring(0, 100),
  });

  // 驗證 next 參數為站內路徑，防止 Open Redirect 攻擊
  const rawNext = searchParams.get("next") ?? "/dashboard";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") && !rawNext.includes("://")
    ? rawNext
    : "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error, data: sessionData } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("[OAuth Callback] Exchange failed:", {
        message: error.message,
        status: error.status,
        name: error.name,
        isSafari,
      });
    }

    if (!error && sessionData.user) {
      const user = sessionData.user;
      const userEmail = user.email?.toLowerCase();

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
        // 新使用者：從 cookie 讀取邀請碼
        const cookieStore = await cookies();
        const invitationCode = cookieStore.get("invitation_code")?.value;

        if (!invitationCode) {
          // 沒有邀請碼，導回登入頁
          return NextResponse.redirect(`${origin}/login?error=no_invitation`);
        }

        // 驗證邀請碼
        const { data: invitation, error: invError } = await serviceClient
          .from("invitation_codes")
          .select("id, code, is_used, expires_at, email, used_by")
          .eq("code", invitationCode.toUpperCase())
          .maybeSingle();

        if (invError || !invitation) {
          // 邀請碼無效
          const response = NextResponse.redirect(`${origin}/login?error=invalid_invitation`);
          response.cookies.delete("invitation_code");
          return response;
        }

        if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
          // 邀請碼已過期
          const response = NextResponse.redirect(`${origin}/login?error=expired_invitation`);
          response.cookies.delete("invitation_code");
          return response;
        }

        // 檢查 email 綁定狀態
        if (invitation.email) {
          // 邀請碼已綁定 email，檢查是否匹配
          if (invitation.email.toLowerCase() !== userEmail) {
            // email 不匹配，此邀請碼已被其他人使用
            const response = NextResponse.redirect(`${origin}/login?error=email_already_bound`);
            response.cookies.delete("invitation_code");
            return response;
          }
          // email 匹配，允許登入（重複登入的情況）
        }

        // 建立 workspace
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
          return NextResponse.redirect(`${origin}/login?error=workspace_failed`);
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

          // 綁定 email 到邀請碼（首次使用時）
          if (!invitation.email) {
            await serviceClient
              .from("invitation_codes")
              .update({
                email: userEmail,
                is_used: true,
                used_by: user.id,
                used_at: new Date().toISOString(),
              })
              .eq("id", invitation.id);
          }

          workspaceId = newWorkspace.id;
        }

        // 清除邀請碼 cookie，導向設定頁
        const response = NextResponse.redirect(
          `${origin}/settings?workspace_id=${workspaceId}`
        );
        response.cookies.delete("invitation_code");
        return response;
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

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
