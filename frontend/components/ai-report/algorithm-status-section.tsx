"use client";

import { Activity, Lightbulb, Sparkles, TrendingUp, Zap, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { DataSnapshot } from "@/hooks/use-weekly-report";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

interface AlgorithmStatusData {
  summary: string;
  findings?: string[];
  status_label?: string;
  // 向後相容舊格式
  insights?: string[];
}

interface Props {
  data: AlgorithmStatusData;
  snapshot: DataSnapshot;
}

const STATUS_CONFIG = {
  normal: {
    label: "正常",
    color: "text-emerald-600",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/30",
    description: "配額充足，可正常發文或追求爆發",
  },
  elevated: {
    label: "累積中",
    color: "text-blue-600",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
    description: "配額開始累積，表現可能不穩定",
  },
  warning: {
    label: "警戒",
    color: "text-amber-600",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/30",
    description: "接近配額上限，新貼文曝光可能下降",
  },
  throttled: {
    label: "限流中",
    color: "text-rose-600",
    bgColor: "bg-rose-500/10",
    borderColor: "border-rose-500/30",
    description: "配額耗盡，等待配額消化恢復",
  },
};

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
}

export function AlgorithmStatusSection({ data, snapshot }: Props) {
  // 向後相容：優先使用 findings，fallback 到 insights
  const findings = data.findings || data.insights || [];
  const algoData = snapshot.algorithm_status;

  // 如果沒有演算法數據，不顯示此區塊
  if (!algoData) {
    return null;
  }

  const statusConfig = STATUS_CONFIG[algoData.quota_status] || STATUS_CONFIG.normal;

  // 向後相容：支援舊格式 (daily_vfr) 和新格式 (daily_reach)
  const dailyData = (algoData as any).daily_reach || (algoData as any).daily_vfr || [];
  const rolling7d = (algoData as any).rolling_7d_reach ?? (algoData as any).rolling_7d_vfr ?? 0;

  // 準備圖表數據
  const chartData = dailyData.map((d: any) => ({
    date: d.date.slice(5).replace("-", "/"), // M/D 格式
    avgReach: d.avg_reach ?? d.avg_vfr ?? 0,
    cumulativeReach: d.cumulative_reach ?? d.cumulative_vfr ?? 0,
    posts: d.post_count,
  }));

  return (
    <Card className="overflow-hidden">
      <CardContent className="pt-6">
        {/* 標題區 */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 shadow-lg shadow-cyan-500/25">
            <Activity className="size-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">演算法狀態</h2>
            <p className="text-[13px] text-muted-foreground">
              限流監測與配額分析
            </p>
          </div>
        </div>

        {/* AI 摘要 */}
        <div className="relative overflow-hidden mb-6 p-5 rounded-2xl bg-gradient-to-br from-cyan-500/10 via-cyan-500/5 to-transparent border border-cyan-500/20">
          <div className="absolute top-3 right-3">
            <Sparkles className="size-4 text-cyan-500/50" />
          </div>
          <p className="text-[14px] leading-relaxed pr-8">{data.summary}</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* 配額狀態卡片 */}
          <div className="space-y-4">
            {/* 當前狀態 */}
            <div
              className={cn(
                "p-4 rounded-2xl border-2",
                statusConfig.bgColor,
                statusConfig.borderColor
              )}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Activity className={cn("size-5", statusConfig.color)} />
                  <span className="text-[14px] font-semibold">配額狀態</span>
                </div>
                <Badge
                  className={cn(
                    "px-3 py-1 text-[13px] font-semibold border-0",
                    statusConfig.bgColor,
                    statusConfig.color
                  )}
                >
                  {statusConfig.label}
                </Badge>
              </div>
              <p className="text-[13px] text-muted-foreground mb-3">
                {statusConfig.description}
              </p>
              <div className="flex items-center justify-between p-3 rounded-xl bg-background/50">
                <span className="text-[13px] text-muted-foreground">
                  滾動 7 天累計觸及倍數
                </span>
                <span className="text-lg font-bold tabular-nums">
                  {rolling7d.toFixed(1)}
                </span>
              </div>
            </div>

            {/* 爆發事件 */}
            {algoData.burst_events.length > 0 && (
              <div className="p-4 rounded-2xl border bg-gradient-to-br from-amber-500/5 to-transparent">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 rounded-lg bg-amber-500/10">
                    <Zap className="size-4 text-amber-500" />
                  </div>
                  <h3 className="text-[14px] font-semibold">爆發事件</h3>
                  <span className="text-[11px] text-muted-foreground">
                    觸及倍數 ≥ 200
                  </span>
                </div>
                <div className="space-y-2">
                  {algoData.burst_events.map((event, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl border bg-background/50"
                    >
                      <p className="text-[13px] line-clamp-1 mb-2">
                        {event.post_text || "(無文字)"}
                      </p>
                      <div className="flex items-center gap-4 text-[12px]">
                        <span className="text-muted-foreground">
                          {event.date}
                        </span>
                        <span className="font-semibold text-amber-600">
                          觸及 {(event as any).reach_multiplier ?? (event as any).vfr ?? 0}x
                        </span>
                        <span className="text-muted-foreground">
                          {formatNumber(event.views)} 曝光
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 無爆發事件時的提示 */}
            {algoData.burst_events.length === 0 && (
              <div className="p-4 rounded-2xl border bg-muted/30">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="size-4 text-muted-foreground" />
                  <span className="text-[14px] font-medium text-muted-foreground">
                    本期無爆發事件
                  </span>
                </div>
                <p className="text-[13px] text-muted-foreground">
                  尚未有單篇貼文達到觸及倍數 ≥ 200 的爆發門檻
                </p>
              </div>
            )}
          </div>

          {/* 右側：觸及倍數趨勢圖 + AI 發現 */}
          <div className="space-y-4">
            {/* 觸及倍數趨勢圖 */}
            {chartData.length > 0 && (
              <div className="rounded-2xl border bg-gradient-to-br from-background to-muted/20 p-4">
                <h3 className="mb-3 text-[14px] font-medium">累計觸及倍數趨勢</h3>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient
                          id="reachGradient"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#06b6d4"
                            stopOpacity={0.3}
                          />
                          <stop
                            offset="95%"
                            stopColor="#06b6d4"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        className="stroke-muted/50"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="date"
                        tick={{
                          fontSize: 10,
                          fill: "hsl(var(--muted-foreground))",
                        }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tick={{
                          fontSize: 10,
                          fill: "hsl(var(--muted-foreground))",
                        }}
                        tickLine={false}
                        axisLine={false}
                        width={35}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "12px",
                          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                        }}
                        formatter={(value: number) => [
                          value.toFixed(1),
                          "累計觸及倍數",
                        ]}
                      />
                      {/* 配額警戒線 */}
                      <ReferenceLine
                        y={200}
                        stroke="#f59e0b"
                        strokeDasharray="3 3"
                        strokeOpacity={0.5}
                      />
                      <ReferenceLine
                        y={500}
                        stroke="#ef4444"
                        strokeDasharray="3 3"
                        strokeOpacity={0.5}
                      />
                      <Area
                        type="monotone"
                        dataKey="cumulativeReach"
                        stroke="#06b6d4"
                        strokeWidth={2}
                        fill="url(#reachGradient)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex items-center justify-center gap-4 mt-2 text-[10px] text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-0.5 bg-amber-500" />
                    <span>警戒線 (200)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-0.5 bg-rose-500" />
                    <span>限流線 (500)</span>
                  </div>
                </div>
              </div>
            )}

            {/* AI 發現 */}
            <div className="rounded-2xl border bg-gradient-to-br from-amber-500/5 to-transparent p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 rounded-lg bg-amber-500/10">
                  <Lightbulb className="size-4 text-amber-500" />
                </div>
                <h3 className="text-[14px] font-semibold">AI 發現</h3>
              </div>
              <ul className="space-y-2.5">
                {findings.map((finding, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <span className="flex-shrink-0 size-1.5 rounded-full bg-cyan-500 mt-2" />
                    <span className="text-[14px] text-foreground/90 leading-relaxed">
                      {finding}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* 底部說明 */}
        <div className="mt-6 p-4 rounded-xl bg-muted/30 border">
          <div className="flex items-start gap-3">
            <AlertTriangle className="size-4 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div className="text-[12px] text-muted-foreground leading-relaxed">
              <p className="font-medium mb-1">關於限流機制</p>
              <p>
                當貼文爆發（觸及倍數 ≥ 200）後，Threads
                可能會暫時降低後續新貼文的推薦權重，這是正常的平台機制。通常在
                5-10 天後會恢復正常，持續發文有助於加速恢復。
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
