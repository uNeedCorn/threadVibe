"use client";

import { User, Target, Zap, TrendingUp, CheckCircle, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { getScoreStyle as getSharedScoreStyle, typography, spacing } from "@/components/report-shared";
import type { PersonaReportContent, PersonaDataSnapshot } from "@/hooks/use-persona-report";

interface Props {
  executiveSummary: PersonaReportContent["executive_summary"];
  dataSnapshot: PersonaDataSnapshot | null;
}

export function ExecutiveSummarySection({ executiveSummary, dataSnapshot }: Props) {
  const { health_score, stage, core_bottleneck, breakthrough, top_action, strengths, improvements } = executiveSummary;

  const scoreStyle = getSharedScoreStyle(health_score);

  const stageStyles = {
    building: { bg: "bg-amber-50/50", text: "text-amber-700", border: "border-amber-200" },
    growing: { bg: "bg-blue-50/50", text: "text-blue-700", border: "border-blue-200" },
    stable: { bg: "bg-emerald-50/50", text: "text-emerald-700", border: "border-emerald-200" },
    influential: { bg: "bg-purple-50/50", text: "text-purple-700", border: "border-purple-200" },
  };

  const stageStyle = stageStyles[stage.current];

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <User className="size-5" />
          <span className={typography.cardTitle}>總覽</span>
        </CardTitle>
      </CardHeader>
      <CardContent className={spacing.section}>
        {/* 頂部：定位 + 分數 + 階段 */}
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          {/* 左側：定位 */}
          <div className="flex-1 space-y-4">
            <h2 className="text-2xl font-bold leading-tight">{executiveSummary.positioning}</h2>

            {/* 發展階段 */}
            <div className={cn("inline-flex items-center gap-3 rounded-lg border px-4 py-2.5", stageStyle.bg, stageStyle.border)}>
              <TrendingUp className={cn("size-5", stageStyle.text)} />
              <div>
                <span className={cn("font-semibold", stageStyle.text)}>{stage.label}</span>
                <span className="mx-2 text-muted-foreground">·</span>
                <span className="text-sm text-muted-foreground">{stage.description}</span>
              </div>
            </div>
          </div>

          {/* 右側：健康分數 */}
          <div className={cn("flex flex-col items-center justify-center rounded-2xl p-6 ring-4", scoreStyle.ring, "bg-background")}>
            <span className={cn(typography.label, "mb-1")}>健康分數</span>
            <span className={cn(typography.heroNumber, scoreStyle.text)}>{health_score}</span>
            <div className="w-20 mt-2">
              <Progress value={health_score} className="h-1.5" />
            </div>
          </div>
        </div>

        {/* 關鍵數據 */}
        {dataSnapshot && (
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border bg-muted/30 p-4">
              <p className={typography.label}>粉絲數</p>
              <p className={cn(typography.bigNumber, "mt-1")}>{dataSnapshot.account.followers_count.toLocaleString()}</p>
            </div>
            <div className="rounded-xl border bg-muted/30 p-4">
              <p className={typography.label}>分析貼文</p>
              <p className={cn(typography.bigNumber, "mt-1")}>{dataSnapshot.stats.post_count}</p>
            </div>
            <div className="rounded-xl border bg-muted/30 p-4">
              <p className={typography.label}>分析回覆</p>
              <p className={cn(typography.bigNumber, "mt-1")}>{dataSnapshot.stats.reply_count}</p>
            </div>
          </div>
        )}

        {/* 核心瓶頸 */}
        <div className="rounded-xl border-2 border-amber-200 bg-amber-50/50 p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="size-5 text-amber-600" />
            <span className={cn(typography.sectionTitle, "text-amber-700")}>核心瓶頸</span>
          </div>
          <h3 className={cn(typography.cardTitle, "text-amber-900 mb-2")}>{core_bottleneck.title}</h3>
          <p className={cn(typography.body, "text-amber-800 mb-3")}>{core_bottleneck.implication}</p>
          {core_bottleneck.evidence.length > 0 && (
            <ul className={spacing.listCompact}>
              {core_bottleneck.evidence.map((e, i) => (
                <li key={i} className="text-sm text-amber-700 flex items-start gap-2">
                  <span className="text-amber-500 mt-1 shrink-0">•</span>
                  {e}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 突破方向 */}
        <div className="rounded-xl border-2 border-blue-200 bg-blue-50/50 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Target className="size-5 text-blue-600" />
            <span className={cn(typography.sectionTitle, "text-blue-700")}>突破方向</span>
          </div>
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <span className="text-blue-700">{breakthrough.from_state}</span>
            <span className="text-xl text-blue-400">→</span>
            <span className={cn(typography.cardTitle, "text-blue-900")}>{breakthrough.to_state}</span>
          </div>
          <p className={cn(typography.body, "text-blue-800")}>{breakthrough.how}</p>
        </div>

        {/* 最重要行動 */}
        <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="size-5 text-primary" />
            <span className={cn(typography.sectionTitle, "text-primary")}>最重要行動</span>
          </div>
          <p className={cn(typography.cardTitle, "font-medium")}>{top_action}</p>
        </div>

        {/* 優勢與待改善 */}
        <div className="grid gap-6 sm:grid-cols-2">
          <div className={spacing.list}>
            <div className="flex items-center gap-2">
              <CheckCircle className="size-5 text-emerald-500" />
              <h3 className={typography.sectionTitle}>優勢</h3>
            </div>
            <ul className={spacing.listCompact}>
              {strengths.map((s, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="text-emerald-500 mt-0.5 shrink-0">✓</span>
                  <span className={typography.body}>{s}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className={spacing.list}>
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-amber-500" />
              <h3 className={typography.sectionTitle}>待改善</h3>
            </div>
            <ul className={spacing.listCompact}>
              {improvements.map((s, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="text-amber-500 mt-0.5 shrink-0">!</span>
                  <span className={typography.body}>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
