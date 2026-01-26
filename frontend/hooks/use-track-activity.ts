"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "./use-current-user";

const THROTTLE_MS = 10 * 60 * 1000; // 10 分鐘
const STORAGE_KEY = "lastActivityUpdate";

/**
 * 追蹤使用者活躍時間
 * - 頁面載入時更新 profiles.last_active_at
 * - 10 分鐘內不重複更新（節流）
 * - 非阻塞背景執行，不影響使用者體驗
 */
export function useTrackActivity() {
  const { user } = useCurrentUser();
  const hasTracked = useRef(false);

  useEffect(() => {
    // 避免重複執行
    if (hasTracked.current || !user?.id) return;

    const now = Date.now();
    const lastUpdate = localStorage.getItem(STORAGE_KEY);

    // 10 分鐘內不重複更新
    if (lastUpdate && now - parseInt(lastUpdate, 10) < THROTTLE_MS) {
      return;
    }

    hasTracked.current = true;

    // 背景更新，不阻塞 UI
    const updateActivity = async () => {
      try {
        const supabase = createClient();
        await supabase
          .from("profiles")
          .update({ last_active_at: new Date().toISOString() })
          .eq("id", user.id);

        localStorage.setItem(STORAGE_KEY, String(now));
      } catch (error) {
        // 靜默失敗，不影響使用者體驗
        console.debug("[useTrackActivity] Failed to update:", error);
      }
    };

    updateActivity();
  }, [user?.id]);
}
