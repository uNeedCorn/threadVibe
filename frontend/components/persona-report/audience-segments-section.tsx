"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Users, Target, TrendingUp, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { typography, spacing, priorityStyles } from "@/components/report-shared";
import type { PersonaReportContent } from "@/hooks/use-persona-report";

interface Props {
  segments: PersonaReportContent["audience_segments"];
}

export function AudienceSegmentsSection({ segments }: Props) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeSegment, setActiveSegment] = useState(0);

  const currentSegment = segments[activeSegment];

  // 漏斗順序：從淺到深
  const journeyOrder = ["passerby", "follower", "engager", "truster"] as const;

  const journeyLabels: Record<string, string> = {
    passerby: "路人",
    follower: "追蹤者",
    engager: "互動者",
    truster: "信任者",
  };

  // 翻譯卡關階段（處理 AI 可能回傳英文的情況）
  const translateStuckAt = (value: string): string => {
    const translations: Record<string, string> = {
      passerby: "路人",
      follower: "追蹤者",
      engager: "互動者",
      truster: "信任者",
      // 也處理可能的中文輸入
      路人: "路人",
      追蹤者: "追蹤者",
      互動者: "互動者",
      信任者: "信任者",
    };
    return translations[value.toLowerCase()] || translations[value] || value;
  };

  const urgencyStyleMap = {
    high: { text: "text-rose-600", bg: "bg-rose-50/50", border: "border-rose-200" },
    medium: { text: "text-amber-600", bg: "bg-amber-50/50", border: "border-amber-200" },
    low: { text: "text-blue-600", bg: "bg-blue-50/50", border: "border-blue-200" },
  };

  const urgencyLabels = { high: "高", medium: "中", low: "低" };

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="size-5" />
            <span className={typography.cardTitle}>你的受眾</span>
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setIsExpanded(!isExpanded)}>
            {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </Button>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className={spacing.content}>
          {/* 受眾類型切換 */}
          <div className="flex flex-wrap gap-2">
            {segments.map((seg, index) => (
              <Button
                key={index}
                variant={activeSegment === index ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveSegment(index)}
                className="h-auto py-2 px-4"
              >
                <span>{seg.name}</span>
                <Badge
                  variant={activeSegment === index ? "secondary" : "outline"}
                  className="ml-2 text-xs"
                >
                  {seg.percentage}%
                </Badge>
              </Button>
            ))}
          </div>

          {currentSegment && (
            <div className={spacing.section}>
              {/* 受眾描述 */}
              <section>
                <p className={cn(typography.body, "text-base mb-4")}>{currentSegment.description}</p>
                <div className="flex flex-wrap gap-2">
                  {currentSegment.why_follow.map((reason, i) => (
                    <Badge key={i} variant="secondary" className="text-sm px-3 py-1">
                      {reason}
                    </Badge>
                  ))}
                </div>
              </section>

              {/* 旅程分佈 */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="size-5" />
                  <h3 className={typography.sectionTitle}>受眾旅程分佈</h3>
                </div>

                <div className={cn(spacing.list, "mb-4")}>
                  {journeyOrder.map((key) => {
                    const value = currentSegment.journey.distribution[key];
                    if (value === undefined) return null;
                    return (
                      <div key={key} className="flex items-center gap-4">
                        <span className="text-sm w-16 shrink-0 font-medium">
                          {journeyLabels[key]}
                        </span>
                        <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${value}%` }} />
                        </div>
                        <span className={cn("text-sm text-muted-foreground w-12 text-right", typography.number)}>{value}%</span>
                      </div>
                    );
                  })}
                </div>

                <div className="rounded-xl border-2 border-amber-200 bg-amber-50/50 p-4">
                  <p className={cn(typography.label, "text-amber-600 mb-2")}>卡關階段</p>
                  <p className={cn(typography.sectionTitle, "text-amber-900 mb-3")}>{translateStuckAt(currentSegment.journey.stuck_at)}</p>
                  <ul className={spacing.listCompact}>
                    {currentSegment.journey.stuck_reasons.map((reason, i) => (
                      <li key={i} className="text-sm text-amber-800 flex items-start gap-2">
                        <span className="text-amber-500 mt-1 shrink-0">•</span>
                        {reason}
                      </li>
                    ))}
                  </ul>
                </div>
              </section>

              {/* 需求分析 */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <Target className="size-5" />
                  <h3 className={typography.sectionTitle}>需求分析</h3>
                </div>

                {/* 痛點 */}
                <div className="mb-6">
                  <p className={cn(typography.label, "text-muted-foreground mb-3")}>痛點</p>
                  <div className={spacing.list}>
                    {currentSegment.needs.pain_points.map((point, i) => {
                      const style = urgencyStyleMap[point.urgency];
                      return (
                        <div key={i} className={cn("rounded-xl border-2 p-4", style.bg, style.border)}>
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <h4 className={typography.sectionTitle}>{point.title}</h4>
                            <Badge className={cn("shrink-0", style.text, style.bg)}>{urgencyLabels[point.urgency]}急迫</Badge>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-muted-foreground">滿足度</span>
                            <Progress value={point.satisfaction} className="h-2 flex-1" />
                            <span className={cn("text-sm font-medium", typography.number)}>{point.satisfaction}%</span>
                          </div>
                          {point.content_gap && (
                            <p className="text-sm text-amber-700 mt-3">
                              <span className="font-medium">內容缺口：</span>{point.content_gap}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 渴望 */}
                <div>
                  <p className={cn(typography.label, "text-muted-foreground mb-3")}>渴望</p>
                  <div className={spacing.list}>
                    {currentSegment.needs.desires.map((desire, i) => (
                      <div key={i} className="rounded-xl border bg-muted/30 p-4">
                        <h4 className={cn(typography.sectionTitle, "mb-3")}>{desire.title}</h4>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground">滿足度</span>
                          <Progress value={desire.satisfaction} className="h-2 flex-1" />
                          <span className={cn("text-sm font-medium", typography.number)}>{desire.satisfaction}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              {/* 推進策略 */}
              <section>
                <h3 className={cn(typography.sectionTitle, "mb-2")}>推進策略</h3>
                <p className={cn(typography.caption, "mb-4")}>目標：{currentSegment.advancement.target}</p>
                <div className={spacing.list}>
                  {currentSegment.advancement.strategies.map((strategy, i) => (
                    <div key={i} className="rounded-xl border-2 border-primary/20 bg-primary/5 p-4">
                      <Badge className="bg-primary/10 text-primary border-0 mb-3">{strategy.content_type}</Badge>
                      <p className={cn(typography.body, "font-medium mb-2")}>{strategy.example}</p>
                      <p className={typography.caption}>
                        <span className="font-medium text-foreground">預期效果：</span>{strategy.expected_effect}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
