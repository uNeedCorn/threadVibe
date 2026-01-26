"use client";

import { useTrackActivity } from "@/hooks/use-track-activity";

/**
 * 活躍追蹤元件
 * 放在 auth layout 中，追蹤使用者最後活躍時間
 */
export function ActivityTracker() {
  useTrackActivity();
  return null;
}
