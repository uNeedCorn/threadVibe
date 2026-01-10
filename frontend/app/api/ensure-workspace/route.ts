import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/**
 * 確保用戶有 workspace 的補救機制
 * 如果用戶已登入但沒有 workspace，自動建立一個
 */
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const serviceClient = createServiceClient();

  // 檢查是否已有 workspace
  const { data: memberships } = await serviceClient
    .from("workspace_members")
    .select("workspace_id, workspaces(id, name)")
    .eq("user_id", user.id)
    .limit(1);

  if (memberships && memberships.length > 0) {
    // 已有 workspace，回傳現有的
    const workspace = memberships[0].workspaces as unknown as { id: string; name: string } | null;
    return NextResponse.json({
      workspace_id: workspace?.id,
      workspace_name: workspace?.name,
      created: false,
    });
  }

  // 沒有 workspace，建立一個
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
    return NextResponse.json({ error: "Failed to create workspace" }, { status: 500 });
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
    return NextResponse.json({ error: "Failed to create workspace member" }, { status: 500 });
  }

  return NextResponse.json({
    workspace_id: newWorkspace.id,
    workspace_name: newWorkspace.name,
    created: true,
  });
}
