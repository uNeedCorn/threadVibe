"use client";

import { useState, useEffect } from "react";
import { Globe } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";

/**
 * 取得時區的 UTC 偏移量（例如 +8, -5）
 */
function getTimezoneOffset(): string {
  const offset = -new Date().getTimezoneOffset() / 60;
  const sign = offset >= 0 ? "+" : "";
  return `UTC${sign}${offset}`;
}

/**
 * 取得 IANA 時區名稱（例如 Asia/Taipei）
 */
function getTimezoneName(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function PreferencesSection() {
  const [mounted, setMounted] = useState(false);
  const [timezone, setTimezone] = useState({ name: "", offset: "" });

  useEffect(() => {
    setMounted(true);
    setTimezone({
      name: getTimezoneName(),
      offset: getTimezoneOffset(),
    });
  }, []);

  // 避免 hydration mismatch
  if (!mounted) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>偏好設定</CardTitle>
          <CardDescription>顯示與分析的相關設定</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-10 animate-pulse rounded-lg bg-muted" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>偏好設定</CardTitle>
        <CardDescription>顯示與分析的相關設定</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Globe className="size-4" />
            時區
          </Label>
          <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2">
            <span className="text-sm">
              {timezone.name}
            </span>
            <span className="text-sm text-muted-foreground">
              ({timezone.offset})
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            系統自動偵測你的時區，所有日期與時間將以此時區顯示
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
