"use client";

import { useMemo, useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export type TimeRangePreset =
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "custom";

export type ReportType = "summary" | "detail";

export interface ReportFiltersValue {
  timeRange: TimeRangePreset;
  reportType: ReportType;
  customStartDate?: string;
  customEndDate?: string;
}

interface ReportFiltersProps {
  filters: ReportFiltersValue;
  onFiltersChange: (filters: ReportFiltersValue) => void;
  children?: React.ReactNode;
}

/**
 * 根據預設選項計算日期範圍
 */
export function getDateRange(
  preset: TimeRangePreset,
  customStart?: string,
  customEnd?: string
): { start: Date; end: Date } {
  const now = new Date();

  switch (preset) {
    case "this_week": {
      // 本週一到今天
      const dayOfWeek = now.getDay();
      const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // 週一為起點
      const start = new Date(now);
      start.setDate(now.getDate() - diff);
      start.setHours(0, 0, 0, 0);
      return { start, end: now };
    }

    case "last_week": {
      // 上週一到上週日
      const dayOfWeek = now.getDay();
      const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const thisWeekStart = new Date(now);
      thisWeekStart.setDate(now.getDate() - diff);
      const lastWeekStart = new Date(thisWeekStart);
      lastWeekStart.setDate(thisWeekStart.getDate() - 7);
      lastWeekStart.setHours(0, 0, 0, 0);
      const lastWeekEnd = new Date(thisWeekStart);
      lastWeekEnd.setDate(thisWeekStart.getDate() - 1);
      lastWeekEnd.setHours(23, 59, 59, 999);
      return { start: lastWeekStart, end: lastWeekEnd };
    }

    case "this_month": {
      // 本月 1 日到今天
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start, end: now };
    }

    case "last_month": {
      // 上月 1 日到上月最後一天
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return { start, end };
    }

    case "custom": {
      // 自訂日期
      const start = customStart ? new Date(customStart) : now;
      const end = customEnd ? new Date(customEnd) : now;
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }

    default:
      return { start: now, end: now };
  }
}

/**
 * 格式化日期範圍為顯示文字
 */
export function formatDateRange(start: Date, end: Date): string {
  const format = (d: Date) => d.toLocaleDateString("zh-TW");
  return `${format(start)} ~ ${format(end)}`;
}

export function ReportFilters({
  filters,
  onFiltersChange,
  children,
}: ReportFiltersProps) {
  const handleChange = <K extends keyof ReportFiltersValue>(
    key: K,
    value: ReportFiltersValue[K]
  ) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const dateRange = useMemo(() => {
    return getDateRange(
      filters.timeRange,
      filters.customStartDate,
      filters.customEndDate
    );
  }, [filters.timeRange, filters.customStartDate, filters.customEndDate]);

  // 避免 hydration 不匹配：日期格式化只在客戶端執行
  const [dateRangeText, setDateRangeText] = useState<string>("");
  useEffect(() => {
    setDateRangeText(formatDateRange(dateRange.start, dateRange.end));
  }, [dateRange]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        {/* 報表類型 */}
        <div className="space-y-2">
          <Label>報表類型</Label>
          <Select
            value={filters.reportType}
            onValueChange={(v) => handleChange("reportType", v as ReportType)}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="選擇類型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="summary">彙總報表</SelectItem>
              <SelectItem value="detail">明細報表</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 時間範圍 */}
        <div className="space-y-2">
          <Label>時間範圍</Label>
          <Select
            value={filters.timeRange}
            onValueChange={(v) => handleChange("timeRange", v as TimeRangePreset)}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="選擇時間" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="this_week">本週</SelectItem>
              <SelectItem value="last_week">上週</SelectItem>
              <SelectItem value="this_month">本月</SelectItem>
              <SelectItem value="last_month">上月</SelectItem>
              <SelectItem value="custom">自訂日期</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 自訂日期 */}
        {filters.timeRange === "custom" && (
          <>
            <div className="space-y-2">
              <Label>開始日期</Label>
              <Input
                type="date"
                value={filters.customStartDate || ""}
                onChange={(e) => handleChange("customStartDate", e.target.value)}
                className="w-[160px]"
              />
            </div>
            <div className="space-y-2">
              <Label>結束日期</Label>
              <Input
                type="date"
                value={filters.customEndDate || ""}
                onChange={(e) => handleChange("customEndDate", e.target.value)}
                className="w-[160px]"
              />
            </div>
          </>
        )}

        {/* 按鈕區域 */}
        {children}
      </div>

      {/* 日期範圍提示 */}
      {dateRangeText && (
        <p className="text-sm text-muted-foreground">
          資料範圍：{dateRangeText}
        </p>
      )}
    </div>
  );
}
