"use client";

import { Zap, AlertTriangle, TrendingDown, Clock, Lightbulb, Eye, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ContentPatternReportContent, ContentPatternSnapshot } from "@/hooks/use-content-pattern-report";

interface Props {
  data: ContentPatternReportContent["throttling_warning"];
  snapshot: ContentPatternSnapshot;
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
}

function formatReachMultiplier(value: number | undefined): string {
  if (value === undefined) return "-";
  if (value >= 200) return `${value.toFixed(0)}x 🔥`;
  if (value >= 100) return `${value.toFixed(0)}x`;
  if (value >= 10) return `${value.toFixed(1)}x`;
  return `${value.toFixed(1)}x`;
}

export function ThrottlingWarningSection({ data, snapshot }: Props) {
  const throttling = snapshot.throttling_analysis;

  // 如果沒有限流資料或沒有風險，不顯示
  if (!throttling || !data) {
    return null;
  }

  // 如果沒有風險，顯示簡短說明
  if (!throttling.has_risk || !data.has_risk) {
    return (
      <Card className="overflow-hidden">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500 to-green-500 shadow-lg shadow-emerald-500/25">
              <Zap className="size-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight">限流風險分析</h2>
              <p className="text-[13px] text-muted-foreground">
                分析高爆文後的限流現象
              </p>
            </div>
          </div>
          <div className="rounded-2xl border bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 p-5">
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
              <Zap className="size-5" />
              <span className="font-medium">未偵測到限流風險</span>
            </div>
            <p className="mt-2 text-[14px] text-muted-foreground">
              目前帳號沒有明顯的「高爆文後限流」現象，後續貼文曝光表現正常。
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardContent className="pt-6">
        {/* 標題區 */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-500 to-violet-500 shadow-lg shadow-purple-500/25">
            <Zap className="size-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">限流風險分析</h2>
            <p className="text-[13px] text-muted-foreground">
              分析高爆文後的限流現象
            </p>
          </div>
        </div>

        {/* 警告框 */}
        <div className="relative overflow-hidden mb-6 p-5 rounded-2xl bg-gradient-to-br from-purple-500/15 via-purple-500/10 to-violet-500/5 border-2 border-purple-500/30">
          <div className="absolute top-3 right-3">
            <AlertTriangle className="size-5 text-purple-500/30" />
          </div>

          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 rounded-lg bg-purple-500/20">
              <AlertTriangle className="size-4 text-purple-500" />
            </div>
            <span className="text-[14px] font-semibold text-purple-700 dark:text-purple-400">
              偵測到限流風險
            </span>
          </div>

          <p className="text-[14px] text-purple-800 dark:text-purple-300 leading-relaxed mb-4">
            {data.summary}
          </p>

          {/* 觸及倍數說明 */}
          <div className="text-[12px] text-purple-700/80 dark:text-purple-300/80 mb-4 flex items-center gap-2">
            <Users className="size-3.5" />
            <span>
              觸及倍數 = 曝光 ÷ 粉絲數 | 基準: {throttling.baseline_vfr?.toFixed(1) ?? "-"}x | 爆文門檻: ≥200x
            </span>
          </div>

          {/* 統計數據 */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="rounded-xl bg-purple-500/10 p-3 text-center">
              <div className="text-2xl font-bold text-purple-700 dark:text-purple-400">
                {throttling.viral_posts_count}
              </div>
              <div className="text-[11px] text-muted-foreground">爆文（VFR≥200）</div>
            </div>
            <div className="rounded-xl bg-purple-500/10 p-3 text-center">
              <div className="text-2xl font-bold text-purple-700 dark:text-purple-400">
                {throttling.potentially_throttled_count}
              </div>
              <div className="text-[11px] text-muted-foreground">受影響貼文</div>
            </div>
            <div className="rounded-xl bg-purple-500/10 p-3 text-center">
              <div className="text-2xl font-bold text-purple-700 dark:text-purple-400">
                -{(throttling.avg_drop_rate * 100).toFixed(0)}%
              </div>
              <div className="text-[11px] text-muted-foreground">觸及倍數下降</div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* 左側：受影響的案例 */}
          {throttling.affected_posts.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <TrendingDown className="size-4 text-purple-500" />
                <h3 className="text-[14px] font-semibold">受影響的案例</h3>
              </div>

              {throttling.affected_posts.map((item, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl border bg-gradient-to-br from-background to-muted/20 p-4"
                >
                  {/* 爆文 */}
                  <div className="mb-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30">
                        爆文
                      </Badge>
                      <Badge variant="outline" className="text-[10px] text-amber-600 dark:text-amber-400 border-amber-500/40">
                        {formatReachMultiplier(item.viral_post.vfr)}
                      </Badge>
                      <span className="text-[12px] text-muted-foreground">
                        {item.viral_post.published_at}
                      </span>
                    </div>
                    <p className="text-[13px] line-clamp-2 mb-2">
                      {item.viral_post.text || "(無文字內容)"}
                    </p>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Eye className="size-3 text-amber-500" />
                        <span className="font-medium text-amber-700 dark:text-amber-400">
                          {formatNumber(item.viral_post.views)}
                        </span>
                      </span>
                      <span>{item.viral_post.media_type}</span>
                    </div>
                  </div>

                  {/* 後續貼文 */}
                  <div className="border-t pt-3 space-y-2">
                    <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                      <Clock className="size-3" />
                      <span>後續 7 天內的貼文（觸及倍數明顯下降）：</span>
                    </div>
                    {item.following_posts.slice(0, 3).map((fp, fpIdx) => {
                      const fpVfr = fp.vfr;
                      const isThrottled = fpVfr !== undefined && fpVfr < 20;
                      return (
                        <div
                          key={fpIdx}
                          className={cn(
                            "rounded-lg p-2 border",
                            isThrottled
                              ? "bg-rose-500/5 border-rose-500/20"
                              : "bg-muted/30"
                          )}
                        >
                          <p className="text-[12px] line-clamp-1 mb-1">
                            {fp.text || "(無文字內容)"}
                          </p>
                          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="size-2.5" />
                              {fp.hours_after}h 後
                            </span>
                            <span className={cn(
                              "font-medium",
                              isThrottled
                                ? "text-rose-600 dark:text-rose-400"
                                : "text-foreground"
                            )}>
                              {formatReachMultiplier(fpVfr)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Eye className="size-2.5" />
                              {formatNumber(fp.views)}
                            </span>
                            <span>{fp.media_type}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 右側：AI 建議 */}
          <div className="space-y-4">
            {/* 受影響範例 */}
            {data.affected_examples.length > 0 && (
              <div className="rounded-2xl border bg-gradient-to-br from-purple-500/5 to-transparent p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 rounded-lg bg-purple-500/10">
                    <AlertTriangle className="size-4 text-purple-500" />
                  </div>
                  <h3 className="text-[14px] font-semibold">AI 分析</h3>
                </div>
                <ul className="space-y-2">
                  {data.affected_examples.map((example, idx) => (
                    <li key={idx} className="flex items-start gap-3 text-[13px]">
                      <span className="flex-shrink-0 size-1.5 rounded-full bg-purple-500 mt-2" />
                      <span className="text-muted-foreground">{example}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 建議 */}
            {data.recommendations.length > 0 && (
              <div className="rounded-2xl border bg-gradient-to-br from-emerald-500/5 to-transparent p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 rounded-lg bg-emerald-500/10">
                    <Lightbulb className="size-4 text-emerald-500" />
                  </div>
                  <h3 className="text-[14px] font-semibold text-emerald-700 dark:text-emerald-400">
                    建議策略
                  </h3>
                </div>
                <ul className="space-y-2.5">
                  {data.recommendations.map((rec, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <span className="flex-shrink-0 size-1.5 rounded-full bg-emerald-500 mt-2" />
                      <span className="text-[14px] text-foreground/80 leading-relaxed">
                        {rec}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
