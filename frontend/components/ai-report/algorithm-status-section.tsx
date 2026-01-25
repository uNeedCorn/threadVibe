"use client";

import { Activity, Lightbulb, Sparkles, TrendingUp, Zap, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { iconGradients, typography, spacing } from "@/components/report-shared";
import type { DataSnapshot } from "@/hooks/use-weekly-report";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

interface AlgorithmStatusData {
  summary: string;
  findings?: string[];
  status_label?: string;
  insights?: string[];
}

interface Props {
  data: AlgorithmStatusData;
  snapshot: DataSnapshot;
}

const STATUS_CONFIG = {
  normal: {
    label: "正常",
    text: "text-emerald-600",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    description: "配額充足，可正常發文或追求爆發",
  },
  elevated: {
    label: "累積中",
    text: "text-blue-600",
    bg: "bg-blue-50",
    border: "border-blue-200",
    description: "配額開始累積，表現可能不穩定",
  },
  warning: {
    label: "警戒",
    text: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-200",
    description: "接近配額上限，新貼文曝光可能下降",
  },
  throttled: {
    label: "限流中",
    text: "text-rose-600",
    bg: "bg-rose-50",
    border: "border-rose-200",
    description: "配額耗盡，等待配額消化恢復",
  },
};

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
}

export function AlgorithmStatusSection({ data, snapshot }: Props) {
  const findings = data.findings || data.insights || [];
  const algoData = snapshot.algorithm_status;

  if (!algoData) return null;

  const statusConfig = STATUS_CONFIG[algoData.quota_status] || STATUS_CONFIG.normal;

  const dailyData = (algoData as any).daily_reach || (algoData as any).daily_vfr || [];
  const rolling7d = (algoData as any).rolling_7d_reach ?? (algoData as any).rolling_7d_vfr ?? 0;

  const chartData = dailyData.map((d: any) => ({
    date: d.date.slice(5).replace("-", "/"),
    avgReach: d.avg_reach ?? d.avg_vfr ?? 0,
    cumulativeReach: d.cumulative_reach ?? d.cumulative_vfr ?? 0,
    posts: d.post_count,
  }));

  return (
    <Card>
      <CardContent className="pt-6 space-y-6">
        {/* 標題區 */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 shadow-lg shadow-cyan-500/25">
            <Activity className="size-5 text-white" />
          </div>
          <div>
            <h2 className={typography.cardTitle}>演算法狀態</h2>
            <p className={typography.caption}>限流監測與配額分析</p>
          </div>
        </div>

        {/* AI 摘要 */}
        <div className="relative rounded-xl border-2 border-cyan-200 bg-cyan-50/50 p-5">
          <Sparkles className="absolute top-4 right-4 size-4 text-cyan-400/50" />
          <p className={cn(typography.body, "pr-8")}>{data.summary}</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* 配額狀態卡片 */}
          <div className={spacing.content}>
            {/* 當前狀態 */}
            <div className={cn("rounded-xl border-2 p-4", statusConfig.bg, statusConfig.border)}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Activity className={cn("size-5", statusConfig.text)} />
                  <span className={typography.sectionTitle}>配額狀態</span>
                </div>
                <Badge className={cn("px-3 py-1 text-sm font-semibold border-0", statusConfig.bg, statusConfig.text)}>
                  {statusConfig.label}
                </Badge>
              </div>
              <p className={cn(typography.caption, "mb-3")}>{statusConfig.description}</p>
              <div className="flex items-center justify-between p-3 rounded-xl bg-background/60">
                <span className={typography.caption}>滾動 7 天累計觸及倍數</span>
                <span className={cn("text-lg font-bold", typography.number)}>{rolling7d.toFixed(1)}</span>
              </div>
            </div>

            {/* 爆發事件 */}
            {algoData.burst_events.length > 0 ? (
              <section className="rounded-xl border-2 border-amber-200 bg-amber-50/50 p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Zap className="size-5 text-amber-600" />
                  <h3 className={cn(typography.sectionTitle, "text-amber-700")}>爆發事件</h3>
                  <span className="text-xs text-muted-foreground">觸及倍數 ≥ 200</span>
                </div>
                <div className={spacing.list}>
                  {algoData.burst_events.map((event, idx) => (
                    <div key={idx} className="p-3 rounded-xl border bg-background/60">
                      <p className="text-sm line-clamp-1 mb-2">{event.post_text || "(無文字)"}</p>
                      <div className="flex items-center gap-4 text-xs">
                        <span className="text-muted-foreground">{event.date}</span>
                        <span className="font-semibold text-amber-600">
                          觸及 {(event as any).reach_multiplier ?? (event as any).vfr ?? 0}x
                        </span>
                        <span className="text-muted-foreground">{formatNumber(event.views)} 曝光</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : (
              <div className="rounded-xl border bg-muted/30 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="size-4 text-muted-foreground" />
                  <span className={cn(typography.sectionTitle, "text-muted-foreground")}>本期無爆發事件</span>
                </div>
                <p className={typography.caption}>尚未有單篇貼文達到觸及倍數 ≥ 200 的爆發門檻</p>
              </div>
            )}
          </div>

          {/* 右側：趨勢圖 + AI 發現 */}
          <div className={spacing.content}>
            {/* 趨勢圖 */}
            {chartData.length > 0 && (
              <div className="rounded-xl border bg-muted/30 p-4">
                <h3 className={cn(typography.sectionTitle, "mb-4")}>累計觸及倍數趨勢</h3>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="reachGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
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
                        formatter={(value: number) => [value.toFixed(1), "累計觸及倍數"]}
                      />
                      <ReferenceLine y={200} stroke="#f59e0b" strokeDasharray="3 3" strokeOpacity={0.5} />
                      <ReferenceLine y={500} stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.5} />
                      <Area type="monotone" dataKey="cumulativeReach" stroke="#06b6d4" strokeWidth={2} fill="url(#reachGradient)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex items-center justify-center gap-4 mt-2 text-xs text-muted-foreground">
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
            <section className="rounded-xl border-2 border-amber-200 bg-amber-50/50 p-4">
              <div className="flex items-center gap-2 mb-4">
                <Lightbulb className="size-5 text-amber-600" />
                <h3 className={cn(typography.sectionTitle, "text-amber-700")}>AI 發現</h3>
              </div>
              <ul className={spacing.list}>
                {findings.map((finding, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <span className="shrink-0 size-1.5 rounded-full bg-cyan-500 mt-2" />
                    <span className={typography.body}>{finding}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>

        {/* 底部說明 */}
        <div className="rounded-xl border bg-muted/30 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="size-4 text-muted-foreground shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium mb-1">關於限流機制</p>
              <p className={typography.caption}>
                當貼文爆發（觸及倍數 ≥ 200）後，Threads 可能會暫時降低後續新貼文的推薦權重，這是正常的平台機制。通常在 5-10 天後會恢復正常，持續發文有助於加速恢復。
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
