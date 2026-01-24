import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    // 驗證用戶是否為管理員
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    // 檢查是否為系統管理員
    const serviceClient = createServiceClient();
    const { data: admin } = await serviceClient
      .from("system_admins")
      .select("user_id")
      .eq("user_id", user.id)
      .single();

    if (!admin) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    // 解析請求
    const body = await request.json();
    const { type } = body;

    // 準備通知數據
    let event: string;
    let data: Record<string, unknown>;

    switch (type) {
      case "new_user":
        event = "new_user";
        data = {
          email: "test@example.com",
          displayName: "測試用戶",
          workspaceName: "測試工作區",
        };
        break;
      case "threads_connected":
        event = "threads_connected";
        data = {
          username: "test_account",
          followersCount: 1234,
          isNewConnection: true,
        };
        break;
      default:
        event = "test";
        data = {};
    }

    // 呼叫 user-events Edge Function
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { success: false, error: "Missing server configuration" },
        { status: 500 }
      );
    }

    // 所有類型都使用 user-events
    const response = await fetch(`${supabaseUrl}/functions/v1/user-events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ event, data }),
    });

    const result = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: result.error || "Failed to send notification" },
        { status: response.status }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Telegram test error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
