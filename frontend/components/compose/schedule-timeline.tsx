"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Clock,
  Send,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Zap,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

interface ScheduledPost {
  id: string;
  text: string | null;
  scheduled_at: string;
  publish_status: string;
}

interface ScheduleTimelineProps {
  accountId: string | null;
  scheduledAt: string | null;
  onScheduledAtChange: (value: string | null) => void;
  suggestedHour?: number;
  disabled?: boolean;
}

// 時間格子（每 3 小時一格，共 8 格）
const TIME_SLOTS = [0, 3, 6, 9, 12, 15, 18, 21];

// 常用時間快捷選項
const QUICK_TIMES = [
  { hour: 9, label: "早上" },
  { hour: 12, label: "中午" },
  { hour: 18, label: "傍晚" },
  { hour: 21, label: "晚上" },
];

export function ScheduleTimeline({
  accountId,
  scheduledAt,
  onScheduledAtChange,
  suggestedHour = 20,
  disabled,
}: ScheduleTimelineProps) {
  // 發布模式：now | schedule
  const [mode, setMode] = useState<"now" | "schedule">(
    scheduledAt ? "schedule" : "now"
  );

  // 選擇的日期（預設今天）
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    if (scheduledAt) {
      return new Date(scheduledAt);
    }
    return new Date();
  });

  // 自訂時間輸入
  const [customTime, setCustomTime] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);

  // 該日已排程的貼文
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // 取得日期標籤
  const getDateLabel = useCallback((date: Date) => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const dateStr = date.toDateString();
    if (dateStr === today.toDateString()) return "今天";
    if (dateStr === tomorrow.toDateString()) return "明天";
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }, []);

  // 切換日期
  const navigateDate = (direction: "prev" | "next") => {
    setSelectedDate((prev) => {
      const newDate = new Date(prev);
      newDate.setDate(newDate.getDate() + (direction === "next" ? 1 : -1));
      return newDate;
    });
  };

  // 是否可以往前（不能選過去的日期）
  const canGoPrev = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selected = new Date(selectedDate);
    selected.setHours(0, 0, 0, 0);
    return selected > today;
  }, [selectedDate]);

  // 載入該日排程貼文
  useEffect(() => {
    if (!accountId) {
      setScheduledPosts([]);
      return;
    }

    async function fetchScheduledPosts() {
      setIsLoading(true);
      const supabase = createClient();

      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(startOfDay);
      endOfDay.setDate(endOfDay.getDate() + 1);

      const { data } = await supabase
        .from("workspace_threads_outbound_posts")
        .select("id, text, scheduled_at, publish_status")
        .eq("workspace_threads_account_id", accountId)
        .gte("scheduled_at", startOfDay.toISOString())
        .lt("scheduled_at", endOfDay.toISOString())
        .in("publish_status", ["scheduled", "publishing"])
        .order("scheduled_at", { ascending: true });

      if (data) setScheduledPosts(data);
      setIsLoading(false);
    }

    fetchScheduledPosts();
  }, [accountId, selectedDate]);

  // 取得時間軸上的貼文位置
  const getPostsInSlot = useCallback(
    (slotHour: number) => {
      return scheduledPosts.filter((post) => {
        const hour = new Date(post.scheduled_at).getHours();
        return hour >= slotHour && hour < slotHour + 3;
      });
    },
    [scheduledPosts]
  );

  // 選擇時間
  const selectTime = useCallback(
    (hour: number) => {
      if (mode === "now") return;

      const newDate = new Date(selectedDate);
      newDate.setHours(hour, 0, 0, 0);

      // 確保時間在未來
      const now = new Date();
      if (newDate <= now) {
        newDate.setMinutes(now.getMinutes() + 15);
      }

      onScheduledAtChange(newDate.toISOString());
      setShowCustomInput(false);
    },
    [mode, selectedDate, onScheduledAtChange]
  );

  // 處理自訂時間
  const handleCustomTime = useCallback(() => {
    if (!customTime) return;

    const [hours, minutes] = customTime.split(":").map(Number);
    const newDate = new Date(selectedDate);
    newDate.setHours(hours, minutes, 0, 0);

    // 確保時間在未來
    const now = new Date();
    if (newDate <= now) {
      return; // 忽略過去的時間
    }

    onScheduledAtChange(newDate.toISOString());
    setShowCustomInput(false);
    setCustomTime("");
  }, [customTime, selectedDate, onScheduledAtChange]);

  // 目前選擇的時間 hour
  const selectedHour = scheduledAt ? new Date(scheduledAt).getHours() : null;

  // 切換模式
  const handleModeChange = (newMode: "now" | "schedule") => {
    setMode(newMode);
    if (newMode === "now") {
      onScheduledAtChange(null);
    } else if (!scheduledAt) {
      // 預設選擇建議時間
      selectTime(suggestedHour);
    }
  };

  return (
    <div className="space-y-4">
      {/* 模式切換 */}
      <div className="flex items-center gap-2 p-1 bg-muted rounded-lg w-fit">
        <button
          type="button"
          onClick={() => handleModeChange("now")}
          disabled={disabled}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200",
            mode === "now"
              ? "bg-background text-foreground shadow-sm scale-[1.02]"
              : "text-muted-foreground hover:text-foreground hover:bg-background/50"
          )}
        >
          <Send className={cn("size-4 transition-transform duration-200", mode === "now" && "scale-110")} />
          立即發布
        </button>
        <button
          type="button"
          onClick={() => handleModeChange("schedule")}
          disabled={disabled}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200",
            mode === "schedule"
              ? "bg-background text-foreground shadow-sm scale-[1.02]"
              : "text-muted-foreground hover:text-foreground hover:bg-background/50"
          )}
        >
          <Clock className={cn("size-4 transition-transform duration-200", mode === "schedule" && "scale-110")} />
          排程發布
        </button>
      </div>

      {/* 排程區域 */}
      {mode === "schedule" && (
        <div className="rounded-xl border bg-card overflow-hidden">
          {/* 日期導覽 */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => navigateDate("prev")}
              disabled={disabled || !canGoPrev}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <div className="flex items-center gap-2">
              <CalendarDays className="size-4 text-muted-foreground" />
              <span className="font-medium">{getDateLabel(selectedDate)}</span>
              <span className="text-sm text-muted-foreground">
                {selectedDate.toLocaleDateString("zh-TW", {
                  weekday: "short",
                })}
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => navigateDate("next")}
              disabled={disabled}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>

          {/* 時間軸 */}
          <div className="p-4 space-y-3">
            {/* 快捷時間 */}
            <div className="flex items-center gap-2 flex-wrap">
              {QUICK_TIMES.map(({ hour, label }) => {
                const isSelected = selectedHour === hour;
                const isSuggested = hour === suggestedHour;
                const postsInSlot = getPostsInSlot(hour);

                return (
                  <button
                    key={hour}
                    type="button"
                    onClick={() => selectTime(hour)}
                    disabled={disabled}
                    className={cn(
                      "relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium",
                      "border-2 transition-all duration-200 ease-out",
                      "hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]",
                      isSelected
                        ? "border-primary bg-primary/10 text-primary shadow-sm shadow-primary/20"
                        : isSuggested
                        ? "border-primary/30 bg-primary/5 text-foreground hover:border-primary/50 hover:shadow-sm"
                        : "border-transparent bg-muted hover:bg-muted/80 hover:shadow-sm"
                    )}
                  >
                    {isSuggested && !isSelected && (
                      <Zap className="size-3 text-primary" />
                    )}
                    <span>{hour}:00</span>
                    <span className="text-xs text-muted-foreground">
                      {label}
                    </span>
                    {postsInSlot.length > 0 && (
                      <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
                        {postsInSlot.length}
                      </span>
                    )}
                  </button>
                );
              })}

              {/* 自訂時間按鈕 */}
              {!showCustomInput ? (
                <button
                  type="button"
                  onClick={() => setShowCustomInput(true)}
                  disabled={disabled}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border-2 border-dashed border-muted-foreground/30 text-muted-foreground hover:border-muted-foreground/50 hover:bg-muted/50 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
                >
                  <Plus className="size-3" />
                  自訂
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <Input
                    type="time"
                    value={customTime}
                    onChange={(e) => setCustomTime(e.target.value)}
                    className="w-28 h-9"
                    disabled={disabled}
                  />
                  <Button
                    size="sm"
                    onClick={handleCustomTime}
                    disabled={disabled || !customTime}
                  >
                    確定
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setShowCustomInput(false);
                      setCustomTime("");
                    }}
                  >
                    取消
                  </Button>
                </div>
              )}
            </div>

            {/* 時間軸視覺化 */}
            <div className="relative">
              <div className="flex items-end h-16 border-b border-muted">
                {TIME_SLOTS.map((hour) => {
                  const postsInSlot = getPostsInSlot(hour);
                  const isInSelectedSlot =
                    selectedHour !== null &&
                    selectedHour >= hour &&
                    selectedHour < hour + 3;

                  return (
                    <div
                      key={hour}
                      className="flex-1 relative h-full flex flex-col justify-end"
                    >
                      {/* 已排程貼文標記 */}
                      {postsInSlot.map((post, idx) => (
                        <div
                          key={post.id}
                          className="absolute bottom-2 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-amber-500"
                          style={{ bottom: `${8 + idx * 12}px` }}
                          title={`${new Date(post.scheduled_at).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })} - ${post.text?.slice(0, 20) || "(無文字)"}`}
                        />
                      ))}

                      {/* 選擇的時間標記 */}
                      {isInSelectedSlot && selectedHour !== null && (
                        <div
                          className="absolute bottom-0 w-1 bg-primary rounded-t-full"
                          style={{
                            height: "100%",
                            left: `${((selectedHour - hour) / 3) * 100}%`,
                          }}
                        />
                      )}

                      {/* 時間刻度 */}
                      <div className="absolute -bottom-5 left-0 text-[10px] text-muted-foreground">
                        {hour}
                      </div>
                    </div>
                  );
                })}
                <div className="absolute -bottom-5 right-0 text-[10px] text-muted-foreground">
                  24
                </div>
              </div>
            </div>

            {/* 當日排程摘要 */}
            {scheduledPosts.length > 0 && (
              <div className="mt-6 space-y-2">
                <p className="text-xs text-muted-foreground">
                  {getDateLabel(selectedDate)}已排程 {scheduledPosts.length} 篇
                </p>
                <div className="space-y-1 max-h-24 overflow-y-auto">
                  {scheduledPosts.map((post) => (
                    <div
                      key={post.id}
                      className="flex items-center gap-2 text-xs px-2 py-1.5 rounded bg-muted/50"
                    >
                      <span className="font-medium tabular-nums text-amber-600 dark:text-amber-400">
                        {new Date(post.scheduled_at).toLocaleTimeString(
                          "zh-TW",
                          { hour: "2-digit", minute: "2-digit" }
                        )}
                      </span>
                      <span className="truncate text-muted-foreground">
                        {post.text?.slice(0, 30) || "(無文字)"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 建議時間提示 */}
            {suggestedHour && selectedHour !== suggestedHour && (
              <div className="flex items-center gap-2 mt-3 px-3 py-2 rounded-lg bg-primary/5 border border-primary/20">
                <Zap className="size-4 text-primary shrink-0" />
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {suggestedHour}:00
                  </span>{" "}
                  是你的粉絲最活躍時段
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
