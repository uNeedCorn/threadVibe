import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/waitlist
 * 加入 Beta 等待名單
 */
export async function POST(request: Request) {
  try {
    const { reason, threadsUsername } = await request.json();

    // 確認用戶已登入
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    // 檢查是否已在 waitlist
    const { data: existing } = await supabase
      .from("beta_waitlist")
      .select("id, status")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({
        success: true,
        alreadyExists: true,
        status: existing.status,
      });
    }

    // 新增到 waitlist
    const { error: insertError } = await supabase
      .from("beta_waitlist")
      .insert({
        user_id: user.id,
        email: user.email,
        name: user.user_metadata?.name || user.user_metadata?.full_name || null,
        threads_username: threadsUsername?.trim() || null,
        reason: reason?.trim() || null,
      });

    if (insertError) {
      console.error("Failed to join waitlist:", insertError);
      return NextResponse.json(
        { success: false, error: "INSERT_FAILED" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      alreadyExists: false,
      status: "pending",
    });
  } catch (error) {
    console.error("Waitlist error:", error);
    return NextResponse.json(
      { success: false, error: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/waitlist
 * 取得目前用戶的 waitlist 狀態
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const { data: waitlistEntry } = await supabase
      .from("beta_waitlist")
      .select("id, status, created_at")
      .eq("user_id", user.id)
      .maybeSingle();

    return NextResponse.json({
      success: true,
      inWaitlist: !!waitlistEntry,
      status: waitlistEntry?.status || null,
      createdAt: waitlistEntry?.created_at || null,
    });
  } catch (error) {
    console.error("Waitlist check error:", error);
    return NextResponse.json(
      { success: false, error: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
