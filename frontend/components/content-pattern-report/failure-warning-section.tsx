"use client";

import { AlertTriangle, XCircle, TrendingDown, AlertCircle, Lightbulb } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { iconGradients, typography, spacing, semanticColors } from "@/components/report-shared";
import { PostCard } from "./post-card";
import type { ContentPatternReportContent, ContentPatternSnapshot } from "@/hooks/use-content-pattern-report";

interface Props {
  data: ContentPatternReportContent["failure_warning"];
  snapshot: ContentPatternSnapshot;
}

export function FailureWarningSection({ data, snapshot }: Props) {
  const bottomPosts = snapshot.failure_patterns.bottom_posts;

  return (
    <Card>
      <CardContent className="pt-6 space-y-6">
        {/* 標題區 */}
        <div className="flex items-center gap-3">
          <div className={cn("p-2.5 rounded-xl", iconGradients.rose)}>
            <AlertTriangle className="size-5 text-white" />
          </div>
          <div>
            <h2 className={typography.cardTitle}>低效模式警示</h2>
            <p className={typography.caption}>識別表現不佳的內容模式</p>
          </div>
        </div>

        {/* 應避免的模式 - 警告框 */}
        {data.patterns_to_avoid.length > 0 && (
          <div className="relative rounded-xl border-2 border-rose-200 bg-rose-50/50 p-5">
            <XCircle className="absolute top-4 right-4 size-5 text-rose-400/30" />

            <div className="flex items-center gap-2 mb-3">
              <XCircle className="size-5 text-rose-600" />
              <span className={cn(typography.sectionTitle, "text-rose-700")}>應避免的模式</span>
            </div>

            <ul className={spacing.list}>
              {data.patterns_to_avoid.map((pattern, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <span className="shrink-0 size-1.5 rounded-full bg-rose-500 mt-2" />
                  <span className={typography.body}>{pattern}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          {/* 左側：常見問題 + 改善方向 */}
          <div className={spacing.content}>
            {/* 常見問題標籤牆 */}
            {data.common_mistakes.length > 0 && (
              <section className="rounded-xl border-2 border-rose-200 bg-rose-50/50 p-4">
                <div className="flex items-center gap-2 mb-4">
                  <AlertCircle className="size-5 text-rose-600" />
                  <h3 className={cn(typography.sectionTitle, "text-rose-700")}>常見問題</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {data.common_mistakes.map((mistake, idx) => (
                    <Badge key={idx} className={semanticColors.error.badge}>
                      {mistake}
                    </Badge>
                  ))}
                </div>
              </section>
            )}

            {/* 低表現貼文共同特徵 */}
            {snapshot.failure_patterns.common_issues.length > 0 && (
              <section className="rounded-xl border-2 border-amber-200 bg-amber-50/50 p-4">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingDown className="size-5 text-amber-600" />
                  <h3 className={cn(typography.sectionTitle, "text-amber-700")}>低表現貼文共同特徵</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {snapshot.failure_patterns.common_issues.map((issue, idx) => (
                    <Badge key={idx} className={semanticColors.warning.badge}>
                      {issue}
                    </Badge>
                  ))}
                </div>
              </section>
            )}

            {/* 改善方向 */}
            {snapshot.failure_patterns.avoid.length > 0 && (
              <section className="rounded-xl border-2 border-emerald-200 bg-emerald-50/50 p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Lightbulb className="size-5 text-emerald-600" />
                  <h3 className={cn(typography.sectionTitle, "text-emerald-700")}>改善方向</h3>
                </div>
                <ul className={spacing.list}>
                  {snapshot.failure_patterns.avoid.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <span className="shrink-0 size-1.5 rounded-full bg-emerald-500 mt-2" />
                      <span className={typography.body}>避免：{item}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          {/* 右側：Bottom 5 貼文 */}
          {bottomPosts.length > 0 && (
            <div className="rounded-xl border bg-muted/30 p-4">
              <div className="flex items-center gap-2 mb-4">
                <TrendingDown className="size-5 text-rose-500" />
                <h3 className={typography.sectionTitle}>Bottom 5 低表現貼文</h3>
              </div>
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent">
                {bottomPosts.slice(0, 5).map((post, idx) => (
                  <PostCard key={post.id} post={post} rank={idx + 1} variant="failure" />
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
