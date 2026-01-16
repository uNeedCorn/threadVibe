import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * POST /api/invitation/validate-public
 * 公開驗證邀請碼是否有效（不需登入）
 */
export async function POST(request: Request) {
  try {
    const { code } = await request.json();

    if (!code || typeof code !== "string") {
      return NextResponse.json(
        { valid: false, error: "MISSING_CODE" },
        { status: 400 }
      );
    }

    // 使用 service client 查詢邀請碼
    const serviceClient = createServiceClient();
    const { data: invitation, error } = await serviceClient
      .from("invitation_codes")
      .select("id, code, is_used, expires_at")
      .eq("code", code.trim().toUpperCase())
      .maybeSingle();

    if (error) {
      console.error("Validate invitation code error:", error);
      return NextResponse.json(
        { valid: false, error: "VALIDATION_FAILED" },
        { status: 500 }
      );
    }

    if (!invitation) {
      return NextResponse.json({ valid: false, error: "INVALID_CODE" });
    }

    // 不再檢查 is_used，因為邀請碼綁定 email 後可重複登入
    // email 綁定檢查在 OAuth callback 中進行

    if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
      return NextResponse.json({ valid: false, error: "EXPIRED" });
    }

    return NextResponse.json({ valid: true });
  } catch (error) {
    console.error("Invitation validation error:", error);
    return NextResponse.json(
      { valid: false, error: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
