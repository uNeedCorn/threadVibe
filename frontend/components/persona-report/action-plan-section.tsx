"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Rocket, Zap, Calendar, Target, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { typography, spacing } from "@/components/report-shared";
import type { PersonaReportContent } from "@/hooks/use-persona-report";

interface Props {
  actionPlan: PersonaReportContent["action_plan"];
}

export function ActionPlanSection({ actionPlan }: Props) {
  const [isExpanded, setIsExpanded] = useState(true);

  const { priority_focus, immediate_actions, weekly_content, monthly_plan } = actionPlan;

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Rocket className="size-5" />
            <span className={typography.cardTitle}>行動清單</span>
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setIsExpanded(!isExpanded)}>
            {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </Button>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className={spacing.section}>
          {/* 優先聚焦 - 最重要，視覺突出 */}
          <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Target className="size-5 text-primary" />
              <span className={cn(typography.label, "text-primary")}>優先聚焦</span>
            </div>
            <p className={typography.body}>{priority_focus}</p>
          </div>

          {/* 立即行動 */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Zap className="size-5 text-amber-500" />
              <h3 className={typography.sectionTitle}>立即行動</h3>
            </div>
            <div className={spacing.list}>
              {immediate_actions.map((action, i) => (
                <div key={i} className="group rounded-xl border bg-card p-4 hover:border-foreground/20 transition-colors">
                  <p className={cn(typography.body, "font-medium")}>{action.action}</p>
                  {(action.current_state || action.target_state) && (
                    <div className="mt-3 flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">{action.current_state}</span>
                      <ArrowRight className="size-4 text-muted-foreground/50" />
                      <span className="font-medium text-foreground">{action.target_state}</span>
                    </div>
                  )}
                  <p className={cn(typography.caption, "mt-2")}>{action.reason}</p>
                </div>
              ))}
            </div>
          </section>

          {/* 內容建議 */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="size-5" />
              <h3 className={typography.sectionTitle}>內容建議</h3>
            </div>
            <div className={spacing.list}>
              {weekly_content.map((content, i) => (
                <div key={i} className="rounded-xl border bg-card overflow-hidden">
                  {/* 卡片標題 - 主題最突出 */}
                  <div className="px-5 pt-5 pb-4 border-b bg-muted/30">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className="bg-primary/10 text-primary hover:bg-primary/20 border-0">
                            {content.content_type}
                          </Badge>
                          <Badge variant="outline" className="text-muted-foreground">
                            {content.format}
                          </Badge>
                        </div>
                        <h4 className={typography.cardTitle}>{content.topic}</h4>
                        <p className={cn(typography.caption, "mt-1")}>{content.angle}</p>
                      </div>
                      <span className={cn(typography.bigNumber, "text-muted-foreground/30")}>#{content.priority}</span>
                    </div>
                  </div>

                  {/* 卡片內容 */}
                  <div className="px-5 py-4 space-y-4">
                    {/* 開頭範例 - 視覺突出 */}
                    <div className="rounded-lg bg-muted/50 p-4">
                      <p className={cn(typography.label, "text-muted-foreground mb-2")}>開頭範例</p>
                      <p className={typography.body}>"{content.hook_example}"</p>
                    </div>

                    {/* 結尾 CTA */}
                    {content.ending_cta && (
                      <div>
                        <p className={cn(typography.label, "text-muted-foreground mb-1")}>結尾 CTA</p>
                        <p className={typography.body}>{content.ending_cta}</p>
                      </div>
                    )}

                    {/* 底部資訊 */}
                    <div className="flex flex-wrap items-start justify-between gap-4 pt-2">
                      <div>
                        <p className={cn(typography.label, "text-muted-foreground mb-1")}>解決痛點</p>
                        <p className={cn(typography.body, "font-medium text-amber-600")}>{content.solves_problem}</p>
                      </div>
                      <div className="text-right">
                        <p className={cn(typography.label, "text-muted-foreground mb-2")}>預期效果</p>
                        <div className="flex flex-wrap justify-end gap-1.5">
                          {content.expected_effects.map((effect, j) => (
                            <Badge key={j} variant="secondary" className="text-xs">
                              {effect}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 月度規劃 */}
          <section>
            <h3 className={cn(typography.sectionTitle, "mb-4")}>月度規劃</h3>
            <div className="rounded-xl border bg-card p-5">
              <p className={cn(typography.caption, "mb-4")}>{monthly_plan.purpose}</p>
              <div className="grid gap-3 sm:grid-cols-4">
                {monthly_plan.weeks.map((week, i) => (
                  <div key={i} className="rounded-lg bg-muted/50 p-4">
                    <p className={cn(typography.label, "text-muted-foreground")}>第 {week.week} 週</p>
                    <p className={cn(typography.body, "font-semibold mt-1")}>{week.content_type}</p>
                    <p className={cn(typography.caption, "mt-1")}>{week.topic}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </CardContent>
      )}
    </Card>
  );
}
