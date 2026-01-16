import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  // 登出並清除 session
  await supabase.auth.signOut();

  // 重定向到登入頁
  return NextResponse.redirect(new URL("/login_2026Q1", process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3001"));
}
