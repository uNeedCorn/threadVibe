"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type TimeRange = "24h" | "7d" | "30d" | "all";

interface TimeRangeTabsProps {
  value: TimeRange;
  onValueChange: (value: TimeRange) => void;
}

export function TimeRangeTabs({ value, onValueChange }: TimeRangeTabsProps) {
  return (
    <Tabs value={value} onValueChange={(v) => onValueChange(v as TimeRange)}>
      <TabsList>
        <TabsTrigger value="24h">24 小時</TabsTrigger>
        <TabsTrigger value="7d">7 天</TabsTrigger>
        <TabsTrigger value="30d">30 天</TabsTrigger>
        <TabsTrigger value="all">全部</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
