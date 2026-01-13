"use client";

import { useState } from "react";
import { Calendar, Clock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

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
  const [isOpen, setIsOpen] = useState(false);

  // 取得最小可選時間（現在 + 10 分鐘）
  const getMinDateTime = () => {
    const min = new Date();
    min.setMinutes(min.getMinutes() + 10);
    return min.toISOString().slice(0, 16);
  };

  // 格式化顯示
  const formatScheduledTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString("zh-TW", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleConfirm = (value: string) => {
    onScheduledAtChange(value ? new Date(value).toISOString() : null);
    setIsOpen(false);
  };

  const handleClear = () => {
    onScheduledAtChange(null);
    setIsOpen(false);
  };

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-1">
        <Clock className="size-3" />
        排程發布
        <span className="text-xs text-muted-foreground">（選填）</span>
      </Label>

      {scheduledAt ? (
        <div className="flex items-center gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
            <Calendar className="size-4 text-muted-foreground" />
            <span className="text-sm">{formatScheduledTime(scheduledAt)}</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleClear}
            disabled={disabled}
          >
            <X className="size-4" />
          </Button>
        </div>
      ) : (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal",
                !scheduledAt && "text-muted-foreground"
              )}
              disabled={disabled}
            >
              <Calendar className="mr-2 size-4" />
              設定排程時間
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-4" align="start">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>選擇日期與時間</Label>
                <Input
                  type="datetime-local"
                  min={getMinDateTime()}
                  onChange={(e) => handleConfirm(e.target.value)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                排程時間必須在 10 分鐘後
              </p>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
