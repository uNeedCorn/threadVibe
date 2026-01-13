import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/**
 * POST /api/invitation/use
 * 使用邀請碼並完成註冊（建立 workspace）
 */
export async function POST(request: Request) {
  try {
    const { code } = await request.json();

    if (!code || typeof code !== "string") {
      return NextResponse.json(
        { success: false, error: "MISSING_CODE" },
        { status: 400 }
      );
    }

    // 確認用戶已登入
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const serviceClient = createServiceClient();

    // 檢查用戶是否已有 workspace（已註冊）
    const { data: existingMemberships } = await serviceClient
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", user.id)
      .limit(1);

    if (existingMemberships && existingMemberships.length > 0) {
      return NextResponse.json(
        { success: false, error: "ALREADY_REGISTERED" },
        { status: 400 }
      );
    }

    // 使用邀請碼
    const { data: useResult, error: useError } = await serviceClient.rpc(
      "use_invitation_code",
      {
        p_code: code.trim().toUpperCase(),
        p_user_id: user.id,
      }
    );

    if (useError || !useResult) {
      console.error("Use invitation code error:", useError);
      return NextResponse.json(
        { success: false, error: "INVALID_OR_USED_CODE" },
        { status: 400 }
      );
    }

    // 邀請碼驗證成功，建立 workspace
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

    if (createError || !newWorkspace) {
      console.error("Failed to create workspace:", createError);
      return NextResponse.json(
        { success: false, error: "WORKSPACE_CREATION_FAILED" },
        { status: 500 }
      );
    }

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
      return NextResponse.json(
        { success: false, error: "MEMBER_CREATION_FAILED" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      workspaceId: newWorkspace.id,
    });
  } catch (error) {
    console.error("Use invitation error:", error);
    return NextResponse.json(
      { success: false, error: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
