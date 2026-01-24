"use client";

import {
  MessageSquare,
  Lightbulb,
  Heart,
  Repeat2,
  Quote,
  MessageCircle,
  Sparkles,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { DataSnapshot } from "@/hooks/use-weekly-report";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

interface EngagementAnalysisData {
  summary: string;
  findings?: string[];
  // 向後相容舊格式
  insights?: string[];
  recommendations?: string[];
}

interface Props {
  data: EngagementAnalysisData;
  snapshot: DataSnapshot;
}

const INTERACTION_CONFIG = [
  {
    name: "讚",
    key: "likes",
    icon: Heart,
    color: "#f472b6",
    bgColor: "bg-pink-500/10",
    textColor: "text-pink-500",
  },
  {
    name: "回覆",
    key: "replies",
    icon: MessageCircle,
    color: "#818cf8",
    bgColor: "bg-indigo-500/10",
    textColor: "text-indigo-500",
  },
  {
    name: "轉發",
    key: "reposts",
    icon: Repeat2,
    color: "#34d399",
    bgColor: "bg-emerald-500/10",
    textColor: "text-emerald-500",
  },
  {
    name: "引用",
    key: "quotes",
    icon: Quote,
    color: "#fbbf24",
    bgColor: "bg-amber-500/10",
    textColor: "text-amber-500",
  },
];

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
}

export function EngagementAnalysisSection({ data, snapshot }: Props) {
  // 向後相容：優先使用 findings，fallback 到 insights
  const findings = data.findings || data.insights || [];

  // 準備互動類型分佈數據
  const rawData = [
    { ...INTERACTION_CONFIG[0], value: snapshot.summary.total_likes },
    { ...INTERACTION_CONFIG[1], value: snapshot.summary.total_replies },
    { ...INTERACTION_CONFIG[2], value: snapshot.summary.total_reposts },
    { ...INTERACTION_CONFIG[3], value: snapshot.summary.total_quotes },
  ];

  const interactionData = rawData.filter((d) => d.value > 0);
  const totalInteractions = interactionData.reduce(
    (sum, d) => sum + d.value,
    0
  );

  return (
    <Card className="overflow-hidden">
      <CardContent className="pt-6">
        {/* 標題區 */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/25">
            <MessageSquare className="size-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">互動分析</h2>
            <p className="text-[13px] text-muted-foreground">
              受眾參與度深度分析
            </p>
          </div>
        </div>

        {/* AI 摘要 */}
        <div className="relative overflow-hidden mb-6 p-5 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/20">
          <div className="absolute top-3 right-3">
            <Sparkles className="size-4 text-emerald-500/50" />
          </div>
          <p className="text-[14px] leading-relaxed pr-8">{data.summary}</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* 互動類型分佈 */}
          <div className="rounded-2xl border bg-gradient-to-br from-background to-muted/20 p-4">
            <h3 className="mb-3 text-[14px] font-medium">互動類型分佈</h3>
            <div className="flex items-center gap-4">
              {/* 圓餅圖 */}
              <div className="h-44 w-44 flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={interactionData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={3}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {interactionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "12px",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                      }}
                      formatter={(value: number) => [formatNumber(value), ""]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* 互動數據列表 */}
              <div className="flex-1 space-y-2">
                {interactionData.map((item, idx) => {
                  const percentage =
                    totalInteractions > 0
                      ? ((item.value / totalInteractions) * 100).toFixed(1)
                      : "0";
                  const Icon = item.icon;

                  return (
                    <div
                      key={idx}
                      className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/50 transition-colors"
                    >
                      <div className={cn("p-1.5 rounded-lg", item.bgColor)}>
                        <Icon className={cn("size-3.5", item.textColor)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-[13px] font-medium">
                            {item.name}
                          </span>
                          <span className="text-[13px] font-semibold tabular-nums">
                            {formatNumber(item.value)}
                          </span>
                        </div>
                        <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${percentage}%`,
                              backgroundColor: item.color,
                            }}
                          />
                        </div>
                      </div>
                      <span className="text-[11px] font-medium text-muted-foreground w-12 text-right tabular-nums">
                        {percentage}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

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
                  <span className="flex-shrink-0 size-1.5 rounded-full bg-emerald-500 mt-2" />
                  <span className="text-[14px] text-foreground/90 leading-relaxed">
                    {finding}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
