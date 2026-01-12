"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface CurrentUser {
  id: string;
  email: string | undefined;
  isAdmin: boolean;
}

interface UseCurrentUserResult {
  user: CurrentUser | null;
  isLoading: boolean;
  isAdmin: boolean;
}

/**
 * 取得當前登入用戶的資料（包含管理員狀態）
 *
 * 管理員狀態從 system_admins 表查詢
 */
export function useCurrentUser(): UseCurrentUserResult {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function fetchUser() {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();

        if (!authUser) {
          setUser(null);
          return;
        }

        // 查詢是否為系統管理員
        // 使用 maybeSingle() 而非 single()，避免查詢結果為空時拋出 406 錯誤
        const { data: adminRecord } = await supabase
          .from("system_admins")
          .select("user_id")
          .eq("user_id", authUser.id)
          .maybeSingle();

        setUser({
          id: authUser.id,
          email: authUser.email,
          isAdmin: !!adminRecord,
        });
      } catch (error) {
        console.error("Failed to fetch current user:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchUser();
  }, []);

  return {
    user,
    isLoading,
    isAdmin: user?.isAdmin ?? false,
  };
}
