"use client";

import { useMemo } from "react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

export interface TrendDataPoint {
  date: string;
  [key: string]: string | number; // accountId: value
}

export interface TrendChartProps {
  title: string;
  data: TrendDataPoint[];
  accounts: { id: string; username: string }[];
  selectedAccountId?: string | null;
  isLoading?: boolean;
}

// 使用實際顏色值（避免 CSS 變數在 SVG 中無法解析的問題）
const CHART_COLORS = [
  "#2563eb", // blue-600
  "#16a34a", // green-600
  "#dc2626", // red-600
  "#ca8a04", // yellow-600
  "#9333ea", // purple-600
];

export function TrendChart({
  title,
  data,
  accounts,
  selectedAccountId,
  isLoading = false,
}: TrendChartProps) {
  const displayAccounts = selectedAccountId
    ? accounts.filter((a) => a.id === selectedAccountId)
    : accounts;

  // 建立 accountId -> 簡單 key 的映射（避免 UUID 作為 CSS 變數名稱的問題）
  const accountKeyMap = useMemo(() => {
    const map: Record<string, string> = {};
    displayAccounts.forEach((account, index) => {
      map[account.id] = `account${index}`;
    });
    return map;
  }, [displayAccounts]);

  // 轉換資料，將 accountId 替換為簡單 key
  const transformedData = useMemo(() => {
    return data.map((point) => {
      const newPoint: TrendDataPoint = { date: point.date };
      displayAccounts.forEach((account) => {
        const simpleKey = accountKeyMap[account.id];
        if (simpleKey && point[account.id] !== undefined) {
          newPoint[simpleKey] = point[account.id];
        }
      });
      return newPoint;
    });
  }, [data, displayAccounts, accountKeyMap]);

  // 建立 chart config（使用簡單 key）
  const chartConfig: ChartConfig = useMemo(() => {
    const config: ChartConfig = {};
    displayAccounts.forEach((account, index) => {
      const simpleKey = accountKeyMap[account.id];
      if (simpleKey) {
        config[simpleKey] = {
          label: `@${account.username}`,
          color: CHART_COLORS[index % CHART_COLORS.length],
        };
      }
    });
    return config;
  }, [displayAccounts, accountKeyMap]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-[300px] items-center justify-center text-muted-foreground">
            尚無資料
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <LineChart data={transformedData} margin={{ left: 12, right: 12 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => {
                const date = new Date(value);
                return `${date.getMonth() + 1}/${date.getDate()}`;
              }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => {
                if (value >= 1000) {
                  return `${(value / 1000).toFixed(0)}K`;
                }
                return value.toString();
              }}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent />}
            />
            {displayAccounts.length > 1 && (
              <ChartLegend content={<ChartLegendContent />} />
            )}
            {displayAccounts.map((account, index) => {
              const simpleKey = accountKeyMap[account.id];
              const color = CHART_COLORS[index % CHART_COLORS.length];
              return (
                <Line
                  key={account.id}
                  type="monotone"
                  dataKey={simpleKey}
                  stroke={color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                  connectNulls
                />
              );
            })}
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
