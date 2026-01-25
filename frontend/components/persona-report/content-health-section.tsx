"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, FileText, BarChart3, Lightbulb, PieChart, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { getScoreStyle as getSharedScoreStyle, typography, spacing } from "@/components/report-shared";
import type { PersonaReportContent } from "@/hooks/use-persona-report";

interface Props {
  contentHealth: PersonaReportContent["content_health"];
}

export function ContentHealthSection({ contentHealth }: Props) {
  const [isExpanded, setIsExpanded] = useState(true);

  const { type_distribution, stage_analysis, value_scores } = contentHealth;

  // 漏斗順序：從上到下依序進展
  const stageOrder = ["attraction", "retention", "engagement", "trust_building"] as const;
  const audienceOrder = ["passerby", "engager", "truster", "advocate"] as const;

  // 階段標籤（中文）
  const stageLabels: Record<string, string> = {
    attraction: "吸引",
    retention: "留存",
    engagement: "互動",
    trust_building: "信任",
  };

  const audienceLabels: Record<string, string> = {
    passerby: "路人",
    engager: "互動者",
    truster: "信任者",
    advocate: "擁護者",
  };


  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="size-5" />
            <span className={typography.cardTitle}>內容健檢</span>
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setIsExpanded(!isExpanded)}>
            {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </Button>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className={spacing.section}>
          {/* 內容類型分佈 */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <PieChart className="size-5" />
              <h3 className={typography.sectionTitle}>內容類型分佈</h3>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 mb-4">
              {/* 目前分佈 */}
              <div className="rounded-xl border bg-muted/30 p-4">
                <p className={cn(typography.label, "text-muted-foreground mb-3")}>目前分佈</p>
                <div className={spacing.list}>
                  {type_distribution.current.map((item, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-sm w-20 shrink-0 font-medium">{item.type}</span>
                      <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-muted-foreground/50 rounded-full transition-all"
                          style={{ width: `${item.percentage}%` }}
                        />
                      </div>
                      <span className={cn("text-sm text-muted-foreground w-12 text-right", typography.number)}>
                        {item.percentage}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 建議分佈 */}
              <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-4">
                <p className={cn(typography.label, "text-primary mb-3")}>建議分佈</p>
                <div className={spacing.list}>
                  {type_distribution.recommended.map((item, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-sm w-20 shrink-0 font-medium">{item.type}</span>
                      <div className="flex-1 h-3 bg-primary/20 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${item.percentage}%` }}
                        />
                      </div>
                      <span className={cn("text-sm font-medium w-12 text-right", typography.number)}>
                        {item.percentage}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 問題 */}
            {type_distribution.issues.length > 0 && (
              <div className={spacing.list}>
                {type_distribution.issues.map((issue, i) => (
                  <div key={i} className="rounded-xl border-2 border-amber-200 bg-amber-50/50 p-4">
                    <p className={cn(typography.sectionTitle, "text-amber-900 mb-2")}>{issue.problem}</p>
                    <p className={cn(typography.body, "text-amber-800 mb-2")}>{issue.detail}</p>
                    <p className={cn(typography.body, "text-amber-700")}>
                      <span className="font-medium">影響：</span>
                      {issue.impact}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 階段分析 */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="size-5" />
              <h3 className={typography.sectionTitle}>內容服務階段 vs 受眾分佈</h3>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 mb-4">
              {/* 內容服務 */}
              <div className="rounded-xl border-2 border-blue-200 bg-blue-50/50 p-4">
                <p className={cn(typography.label, "text-blue-600 mb-3")}>內容服務階段</p>
                <div className={spacing.list}>
                  {stageOrder.map((key) => {
                    const value = stage_analysis.content_serving[key];
                    if (value === undefined) return null;
                    return (
                      <div key={key} className="flex items-center gap-3">
                        <span className="text-sm w-16 shrink-0 font-medium">
                          {stageLabels[key]}
                        </span>
                        <div className="flex-1 h-3 bg-blue-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full transition-all"
                            style={{ width: `${value}%` }}
                          />
                        </div>
                        <span className={cn("text-sm text-muted-foreground w-12 text-right", typography.number)}>{value}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 受眾分佈 */}
              <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50/50 p-4">
                <p className={cn(typography.label, "text-emerald-600 mb-3")}>受眾分佈</p>
                <div className={spacing.list}>
                  {audienceOrder.map((key) => {
                    const value = stage_analysis.audience_at[key];
                    if (value === undefined) return null;
                    return (
                      <div key={key} className="flex items-center gap-3">
                        <span className="text-sm w-16 shrink-0 font-medium">
                          {audienceLabels[key]}
                        </span>
                        <div className="flex-1 h-3 bg-emerald-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full transition-all"
                            style={{ width: `${value}%` }}
                          />
                        </div>
                        <span className={cn("text-sm text-muted-foreground w-12 text-right", typography.number)}>{value}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 落差分析 */}
            <div className="rounded-xl border-2 border-blue-200 bg-blue-50/50 p-4">
              <div className="flex items-start gap-3">
                <Lightbulb className="size-5 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <p className={cn(typography.sectionTitle, "text-blue-900 mb-2")}>{stage_analysis.gap_analysis}</p>
                  <p className={cn(typography.body, "text-blue-800")}>{stage_analysis.adjustment}</p>
                </div>
              </div>
            </div>
          </section>

          {/* 價值分數 */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="size-5" />
              <h3 className={typography.sectionTitle}>內容價值分數</h3>
            </div>

            <div className={spacing.list}>
              {value_scores.map((item, i) => {
                const style = getSharedScoreStyle(item.score);
                return (
                  <div key={i} className={cn("rounded-xl border-2 p-4", style.ring)}>
                    <div className="flex items-center justify-between mb-3">
                      <span className={typography.sectionTitle}>{item.dimension}</span>
                      <span className={cn(typography.bigNumber, style.text)}>
                        {item.score}
                      </span>
                    </div>
                    <Progress value={item.score} className="h-2 mb-3" />
                    <p className={typography.caption}>{item.interpretation}</p>
                  </div>
                );
              })}
            </div>
          </section>
        </CardContent>
      )}
    </Card>
  );
}
