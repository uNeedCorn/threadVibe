"use client";

import { useState, useCallback } from "react";
import { Bell, Play, Loader2, Check, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type NotificationType = "test" | "new_user" | "threads_connected";

interface NotificationOption {
  id: NotificationType;
  name: string;
  description: string;
}

const NOTIFICATION_TYPES: NotificationOption[] = [
  { id: "test", name: "測試訊息", description: "發送簡單的測試通知" },
  { id: "new_user", name: "新用戶註冊", description: "模擬新用戶註冊通知" },
  { id: "threads_connected", name: "Threads 連結", description: "模擬 Threads 帳號連結通知" },
];

interface TestResult {
  success: boolean;
  error?: string;
  timestamp: string;
}

export function TelegramTest() {
  const [selectedType, setSelectedType] = useState<NotificationType>("test");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  const handleTest = useCallback(async () => {
    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/admin/telegram-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: selectedType }),
      });

      const data = await response.json();

      setResult({
        success: data.success,
        error: data.error,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      setResult({
        success: false,
        error: err instanceof Error ? err.message : "發送失敗",
        timestamp: new Date().toISOString(),
      });
    } finally {
      setIsLoading(false);
    }
  }, [selectedType]);

  const currentType = NOTIFICATION_TYPES.find((t) => t.id === selectedType);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="size-5" />
          Telegram 通知測試
        </CardTitle>
        <CardDescription>
          測試 Telegram Bot 是否正常運作
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          {/* 通知類型選擇 */}
          <div className="space-y-2">
            <Label>通知類型</Label>
            <Select
              value={selectedType}
              onValueChange={(v) => setSelectedType(v as NotificationType)}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="選擇類型" />
              </SelectTrigger>
              <SelectContent>
                {NOTIFICATION_TYPES.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 執行按鈕 */}
          <Button onClick={handleTest} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                發送中...
              </>
            ) : (
              <>
                <Play className="mr-2 size-4" />
                發送測試
              </>
            )}
          </Button>
        </div>

        {/* 類型說明 */}
        {currentType && (
          <p className="text-sm text-muted-foreground">
            {currentType.description}
          </p>
        )}

        {/* 結果顯示 */}
        {result && (
          <div
            className={`flex items-center gap-2 rounded-lg p-3 ${
              result.success
                ? "bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200"
                : "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200"
            }`}
          >
            {result.success ? (
              <>
                <Check className="size-5" />
                <span>通知發送成功！請檢查 Telegram。</span>
              </>
            ) : (
              <>
                <X className="size-5" />
                <span>發送失敗：{result.error}</span>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
