"use client";

import { MessageSquare, Lightbulb, Heart, Repeat2, Quote, MessageCircle, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { iconGradients, typography, spacing } from "@/components/report-shared";
import type { DataSnapshot } from "@/hooks/use-weekly-report";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

interface EngagementAnalysisData {
  summary: string;
  findings?: string[];
  insights?: string[];
  recommendations?: string[];
}

interface Props {
  data: EngagementAnalysisData;
  snapshot: DataSnapshot;
}

const INTERACTION_CONFIG = [
  { name: "讚", key: "likes", icon: Heart, color: "#f472b6", bgColor: "bg-pink-500/10", textColor: "text-pink-500" },
  { name: "回覆", key: "replies", icon: MessageCircle, color: "#818cf8", bgColor: "bg-indigo-500/10", textColor: "text-indigo-500" },
  { name: "轉發", key: "reposts", icon: Repeat2, color: "#34d399", bgColor: "bg-emerald-500/10", textColor: "text-emerald-500" },
  { name: "引用", key: "quotes", icon: Quote, color: "#fbbf24", bgColor: "bg-amber-500/10", textColor: "text-amber-500" },
];

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
}

export function EngagementAnalysisSection({ data, snapshot }: Props) {
  const findings = data.findings || data.insights || [];

  const rawData = [
    { ...INTERACTION_CONFIG[0], value: snapshot.summary.total_likes },
    { ...INTERACTION_CONFIG[1], value: snapshot.summary.total_replies },
    { ...INTERACTION_CONFIG[2], value: snapshot.summary.total_reposts },
    { ...INTERACTION_CONFIG[3], value: snapshot.summary.total_quotes },
  ];

  const interactionData = rawData.filter((d) => d.value > 0);
  const totalInteractions = interactionData.reduce((sum, d) => sum + d.value, 0);

  return (
    <Card>
      <CardContent className="pt-6 space-y-6">
        {/* 標題區 */}
        <div className="flex items-center gap-3">
          <div className={cn("p-2.5 rounded-xl", iconGradients.emerald)}>
            <MessageSquare className="size-5 text-white" />
          </div>
          <div>
            <h2 className={typography.cardTitle}>互動分析</h2>
            <p className={typography.caption}>受眾參與度深度分析</p>
          </div>
        </div>

        {/* AI 摘要 */}
        <div className="relative rounded-xl border-2 border-emerald-200 bg-emerald-50/50 p-5">
          <Sparkles className="absolute top-4 right-4 size-4 text-emerald-400/50" />
          <p className={cn(typography.body, "pr-8")}>{data.summary}</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* 互動類型分佈 */}
          <div className="rounded-xl border bg-muted/30 p-4">
            <h3 className={cn(typography.sectionTitle, "mb-4")}>互動類型分佈</h3>
            <div className="flex items-center gap-4">
              {/* 圓餅圖 */}
              <div className="h-44 w-44 shrink-0">
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
                  const percentage = totalInteractions > 0
                    ? ((item.value / totalInteractions) * 100).toFixed(1)
                    : "0";
                  const Icon = item.icon;

                  return (
                    <div key={idx} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/50 transition-colors">
                      <div className={cn("p-1.5 rounded-lg", item.bgColor)}>
                        <Icon className={cn("size-3.5", item.textColor)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{item.name}</span>
                          <span className={cn("text-sm font-semibold", typography.number)}>
                            {formatNumber(item.value)}
                          </span>
                        </div>
                        <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${percentage}%`, backgroundColor: item.color }}
                          />
                        </div>
                      </div>
                      <span className={cn("text-xs font-medium text-muted-foreground w-12 text-right", typography.number)}>
                        {percentage}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* AI 發現 */}
          <div className="rounded-xl border-2 border-amber-200 bg-amber-50/50 p-4">
            <div className="flex items-center gap-2 mb-4">
              <Lightbulb className="size-5 text-amber-600" />
              <h3 className={cn(typography.sectionTitle, "text-amber-700")}>AI 發現</h3>
            </div>
            <ul className={spacing.list}>
              {findings.map((finding, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <span className="shrink-0 size-1.5 rounded-full bg-emerald-500 mt-2" />
                  <span className={typography.body}>{finding}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
