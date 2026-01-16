import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/**
 * POST /api/invitation/validate
 * 驗證邀請碼是否有效
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

    // 確認使用者已登入
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { valid: false, error: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    // 使用 service client 呼叫驗證函數
    const serviceClient = createServiceClient();
    const { data, error } = await serviceClient.rpc("validate_invitation_code", {
      p_code: code.trim().toUpperCase(),
    });

    if (error) {
      console.error("Validate invitation code error:", error);
      return NextResponse.json(
        { valid: false, error: "VALIDATION_FAILED" },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Invitation validation error:", error);
    return NextResponse.json(
      { valid: false, error: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
