import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/**
 * POST /api/waitlist
 * 加入 Beta 等待名單（支援登入/未登入用戶）
 */
export async function POST(request: Request) {
  try {
    const { email, name, reason, threadsUsername, userType, followerTier, managedAccounts, referralSource, contentType } = await request.json();

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // 如果未登入，必須提供 email
    if (!user && !email) {
      return NextResponse.json(
        { success: false, error: "EMAIL_REQUIRED" },
        { status: 400 }
      );
    }

    // 驗證 email 格式
    const targetEmail = user?.email || email;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(targetEmail)) {
      return NextResponse.json(
        { success: false, error: "INVALID_EMAIL" },
        { status: 400 }
      );
    }

    // 使用 service client 來繞過 RLS（未登入用戶無法直接寫入）
    const serviceClient = createServiceClient();

    // 檢查是否已在 waitlist（用 email 檢查）
    const { data: existing } = await serviceClient
      .from("beta_waitlist")
      .select("id, status")
      .eq("email", targetEmail)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({
        success: true,
        alreadyExists: true,
        status: existing.status,
      });
    }

    // 新增到 waitlist
    const { error: insertError } = await serviceClient
      .from("beta_waitlist")
      .insert({
        user_id: user?.id || null,
        email: targetEmail,
        name: name?.trim() || user?.user_metadata?.name || user?.user_metadata?.full_name || null,
        threads_username: threadsUsername?.trim() || null,
        user_type: userType || null,
        follower_tier: followerTier || null,
        managed_accounts: managedAccounts?.trim() || null,
        referral_source: referralSource || null,
        content_type: contentType || null,
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
