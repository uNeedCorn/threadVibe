"use client";

import { AlertTriangle, XCircle, TrendingDown, AlertCircle, Lightbulb } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PostCard } from "./post-card";
import type { ContentPatternReportContent, ContentPatternSnapshot } from "@/hooks/use-content-pattern-report";

interface Props {
  data: ContentPatternReportContent["failure_warning"];
  snapshot: ContentPatternSnapshot;
}

export function FailureWarningSection({ data, snapshot }: Props) {
  const bottomPosts = snapshot.failure_patterns.bottom_posts;

  return (
    <Card className="overflow-hidden">
      <CardContent className="pt-6">
        {/* 標題區 */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-rose-500 to-red-500 shadow-lg shadow-rose-500/25">
            <AlertTriangle className="size-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">低效模式警示</h2>
            <p className="text-[13px] text-muted-foreground">
              識別表現不佳的內容模式
            </p>
          </div>
        </div>

        {/* 應避免的模式 - 警告框 */}
        {data.patterns_to_avoid.length > 0 && (
          <div className="relative overflow-hidden mb-6 p-5 rounded-2xl bg-gradient-to-br from-rose-500/15 via-rose-500/10 to-red-500/5 border-2 border-rose-500/30">
            <div className="absolute top-3 right-3">
              <XCircle className="size-5 text-rose-500/30" />
            </div>

            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-lg bg-rose-500/20">
                <XCircle className="size-4 text-rose-500" />
              </div>
              <span className="text-[14px] font-semibold text-rose-700 dark:text-rose-400">
                應避免的模式
              </span>
            </div>

            <ul className="space-y-2.5">
              {data.patterns_to_avoid.map((pattern, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <span className="flex-shrink-0 size-1.5 rounded-full bg-rose-500 mt-2" />
                  <span className="text-[14px] text-rose-800 dark:text-rose-300 leading-relaxed">
                    {pattern}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          {/* 左側：常見問題 + 改善方向 */}
          <div className="space-y-5">
            {/* 常見問題標籤牆 */}
            {data.common_mistakes.length > 0 && (
              <div className="rounded-2xl border bg-gradient-to-br from-rose-500/5 to-transparent p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 rounded-lg bg-rose-500/10">
                    <AlertCircle className="size-4 text-rose-500" />
                  </div>
                  <h3 className="text-[14px] font-semibold">常見問題</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {data.common_mistakes.map((mistake, idx) => (
                    <Badge
                      key={idx}
                      variant="secondary"
                      className="px-3 py-1.5 text-[13px] bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 transition-colors"
                    >
                      {mistake}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* 低表現貼文共同特徵 */}
            {snapshot.failure_patterns.common_issues.length > 0 && (
              <div className="rounded-2xl border bg-gradient-to-br from-amber-500/5 to-transparent p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 rounded-lg bg-amber-500/10">
                    <TrendingDown className="size-4 text-amber-500" />
                  </div>
                  <h3 className="text-[14px] font-semibold">低表現貼文共同特徵</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {snapshot.failure_patterns.common_issues.map((issue, idx) => (
                    <Badge
                      key={idx}
                      variant="secondary"
                      className="px-3 py-1.5 text-[13px] bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20"
                    >
                      {issue}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* 改善方向 */}
            {snapshot.failure_patterns.avoid.length > 0 && (
              <div className="rounded-2xl border bg-gradient-to-br from-emerald-500/5 to-transparent p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 rounded-lg bg-emerald-500/10">
                    <Lightbulb className="size-4 text-emerald-500" />
                  </div>
                  <h3 className="text-[14px] font-semibold text-emerald-700 dark:text-emerald-400">
                    改善方向
                  </h3>
                </div>
                <ul className="space-y-2.5">
                  {snapshot.failure_patterns.avoid.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <span className="flex-shrink-0 size-1.5 rounded-full bg-emerald-500 mt-2" />
                      <span className="text-[14px] text-foreground/80 leading-relaxed">
                        避免：{item}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* 右側：Bottom 5 貼文 */}
          {bottomPosts.length > 0 && (
            <div className="rounded-2xl border bg-gradient-to-br from-background to-muted/20 p-4">
              <div className="flex items-center gap-2 mb-4">
                <TrendingDown className="size-4 text-rose-500" />
                <h3 className="text-[14px] font-semibold">Bottom 5 低表現貼文</h3>
              </div>
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent">
                {bottomPosts.slice(0, 5).map((post, idx) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    rank={idx + 1}
                    variant="failure"
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
