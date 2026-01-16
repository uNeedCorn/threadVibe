"use client";

import { useState, useEffect, useCallback } from "react";
import { Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

// 排程選項
type ScheduleOption = "now" | "later" | "tomorrow" | "custom";

interface ComposeSchedulerProps {
  scheduledAt: string | null;
  onScheduledAtChange: (value: string | null) => void;
  disabled?: boolean;
}

export function ComposeScheduler({
  scheduledAt,
  onScheduledAtChange,
  disabled,
}: ComposeSchedulerProps) {
  const [scheduleOption, setScheduleOption] = useState<ScheduleOption>("now");
  const [customScheduleTime, setCustomScheduleTime] = useState<string>("");

  // 取得最小可選時間（現在 + 10 分鐘）
  const getMinDateTime = () => {
    const min = new Date();
    min.setMinutes(min.getMinutes() + 10);
    return min.toISOString().slice(0, 16);
  };

  // 計算排程時間
  const calculateScheduledAt = useCallback((option: ScheduleOption, customTime: string): string | null => {
    if (option === "now") return null;

    const now = new Date();

    if (option === "later") {
      // 1 小時後
      now.setHours(now.getHours() + 1);
      return now.toISOString();
    }

    if (option === "tomorrow") {
      // 明天同一時間
      now.setDate(now.getDate() + 1);
      return now.toISOString();
    }

    if (option === "custom" && customTime) {
      return new Date(customTime).toISOString();
    }

    return null;
  }, []);

  // 當選項變更時更新 scheduledAt
  useEffect(() => {
    const newScheduledAt = calculateScheduledAt(scheduleOption, customScheduleTime);
    onScheduledAtChange(newScheduledAt);
  }, [scheduleOption, customScheduleTime, calculateScheduledAt, onScheduledAtChange]);

  // 處理選項變更
  const handleOptionChange = (value: ScheduleOption) => {
    setScheduleOption(value);
    // 如果切換到自訂但沒有時間，不更新（等待用戶輸入）
    if (value === "custom" && !customScheduleTime) {
      onScheduledAtChange(null);
    }
  };

  // 處理自訂時間變更
  const handleCustomTimeChange = (value: string) => {
    setCustomScheduleTime(value);
  };

  return (
    <div className="space-y-3">
      <Label className="flex items-center gap-1.5 text-sm font-medium">
        <Clock className="size-3.5" />
        發布時間
      </Label>

      <RadioGroup
        value={scheduleOption}
        onValueChange={(v) => handleOptionChange(v as ScheduleOption)}
        className="space-y-2"
        disabled={disabled}
      >
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="now" id="schedule-now" disabled={disabled} />
          <Label htmlFor="schedule-now" className="text-sm cursor-pointer font-normal">
            立即發布
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="later" id="schedule-later" disabled={disabled} />
          <Label htmlFor="schedule-later" className="text-sm cursor-pointer font-normal">
            稍後（1 小時後）
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="tomorrow" id="schedule-tomorrow" disabled={disabled} />
          <Label htmlFor="schedule-tomorrow" className="text-sm cursor-pointer font-normal">
            明天同一時間
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="custom" id="schedule-custom" disabled={disabled} />
          <Label htmlFor="schedule-custom" className="text-sm cursor-pointer font-normal">
            自訂時間
          </Label>
        </div>
      </RadioGroup>

      {scheduleOption === "custom" && (
        <div className="ml-6 space-y-1.5">
          <Input
            type="datetime-local"
            min={getMinDateTime()}
            value={customScheduleTime}
            onChange={(e) => handleCustomTimeChange(e.target.value)}
            disabled={disabled}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground">
            排程時間必須在 10 分鐘後
          </p>
        </div>
      )}
    </div>
  );
}
