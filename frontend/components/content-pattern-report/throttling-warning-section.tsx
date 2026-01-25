"use client";

import { Zap, AlertTriangle, TrendingDown, Clock, Lightbulb, Eye, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { iconGradients, typography, spacing, semanticColors } from "@/components/report-shared";
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

  if (!throttling || !data) return null;

  if (!throttling.has_risk || !data.has_risk) {
    return (
      <Card>
        <CardContent className="pt-6 space-y-6">
          <div className="flex items-center gap-3">
            <div className={cn("p-2.5 rounded-xl", iconGradients.emerald)}>
              <Zap className="size-5 text-white" />
            </div>
            <div>
              <h2 className={typography.cardTitle}>限流風險分析</h2>
              <p className={typography.caption}>分析高爆文後的限流現象</p>
            </div>
          </div>
          <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50/50 p-5">
            <div className="flex items-center gap-2 text-emerald-700">
              <Zap className="size-5" />
              <span className="font-medium">未偵測到限流風險</span>
            </div>
            <p className={cn(typography.body, "mt-2")}>
              目前帳號沒有明顯的「高爆文後限流」現象，後續貼文曝光表現正常。
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6 space-y-6">
        {/* 標題區 */}
        <div className="flex items-center gap-3">
          <div className={cn("p-2.5 rounded-xl", iconGradients.purple)}>
            <Zap className="size-5 text-white" />
          </div>
          <div>
            <h2 className={typography.cardTitle}>限流風險分析</h2>
            <p className={typography.caption}>分析高爆文後的限流現象</p>
          </div>
        </div>

        {/* 警告框 */}
        <div className="relative rounded-xl border-2 border-purple-200 bg-purple-50/50 p-5">
          <AlertTriangle className="absolute top-4 right-4 size-5 text-purple-400/30" />

          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="size-5 text-purple-600" />
            <span className={cn(typography.sectionTitle, "text-purple-700")}>偵測到限流風險</span>
          </div>

          <p className={cn(typography.body, "mb-4")}>{data.summary}</p>

          <div className="text-xs text-purple-700/80 mb-4 flex items-center gap-2">
            <Users className="size-3.5" />
            <span>觸及倍數 = 曝光 ÷ 粉絲數 | 基準: {throttling.baseline_vfr?.toFixed(1) ?? "-"}x | 爆文門檻: ≥200x</span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-purple-500/10 p-3 text-center">
              <div className={cn(typography.bigNumber, "text-purple-700")}>{throttling.viral_posts_count}</div>
              <div className="text-xs text-muted-foreground">爆文（VFR≥200）</div>
            </div>
            <div className="rounded-xl bg-purple-500/10 p-3 text-center">
              <div className={cn(typography.bigNumber, "text-purple-700")}>{throttling.potentially_throttled_count}</div>
              <div className="text-xs text-muted-foreground">受影響貼文</div>
            </div>
            <div className="rounded-xl bg-purple-500/10 p-3 text-center">
              <div className={cn(typography.bigNumber, "text-purple-700")}>-{(throttling.avg_drop_rate * 100).toFixed(0)}%</div>
              <div className="text-xs text-muted-foreground">觸及倍數下降</div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* 左側：受影響的案例 */}
          {throttling.affected_posts.length > 0 && (
            <div className={spacing.content}>
              <div className="flex items-center gap-2">
                <TrendingDown className="size-5 text-purple-500" />
                <h3 className={typography.sectionTitle}>受影響的案例</h3>
              </div>

              {throttling.affected_posts.map((item, idx) => (
                <div key={idx} className="rounded-xl border bg-muted/30 p-4">
                  <div className="mb-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className={semanticColors.warning.badge}>爆文</Badge>
                      <Badge variant="outline" className="text-xs text-amber-600 border-amber-500/40">
                        {formatReachMultiplier(item.viral_post.vfr)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{item.viral_post.published_at}</span>
                    </div>
                    <p className="text-sm line-clamp-2 mb-2">{item.viral_post.text || "(無文字內容)"}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Eye className="size-3 text-amber-500" />
                        <span className={cn("font-medium text-amber-700", typography.number)}>{formatNumber(item.viral_post.views)}</span>
                      </span>
                      <span>{item.viral_post.media_type}</span>
                    </div>
                  </div>

                  <div className="border-t pt-3 space-y-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="size-3" />
                      <span>後續 7 天內的貼文（觸及倍數明顯下降）：</span>
                    </div>
                    {item.following_posts.slice(0, 3).map((fp, fpIdx) => {
                      const fpVfr = fp.vfr;
                      const isThrottled = fpVfr !== undefined && fpVfr < 20;
                      return (
                        <div key={fpIdx} className={cn("rounded-lg p-2 border", isThrottled ? "bg-rose-50/50 border-rose-200" : "bg-muted/30")}>
                          <p className="text-xs line-clamp-1 mb-1">{fp.text || "(無文字內容)"}</p>
                          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                            <span className="flex items-center gap-1"><Clock className="size-2.5" />{fp.hours_after}h 後</span>
                            <span className={cn("font-medium", isThrottled ? "text-rose-600" : "text-foreground")}>{formatReachMultiplier(fpVfr)}</span>
                            <span className="flex items-center gap-1"><Eye className="size-2.5" />{formatNumber(fp.views)}</span>
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
          <div className={spacing.content}>
            {data.affected_examples.length > 0 && (
              <section className="rounded-xl border-2 border-purple-200 bg-purple-50/50 p-4">
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle className="size-5 text-purple-600" />
                  <h3 className={cn(typography.sectionTitle, "text-purple-700")}>AI 分析</h3>
                </div>
                <ul className={spacing.listCompact}>
                  {data.affected_examples.map((example, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <span className="shrink-0 size-1.5 rounded-full bg-purple-500 mt-2" />
                      <span className={typography.caption}>{example}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {data.recommendations.length > 0 && (
              <section className="rounded-xl border-2 border-emerald-200 bg-emerald-50/50 p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Lightbulb className="size-5 text-emerald-600" />
                  <h3 className={cn(typography.sectionTitle, "text-emerald-700")}>建議策略</h3>
                </div>
                <ul className={spacing.list}>
                  {data.recommendations.map((rec, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <span className="shrink-0 size-1.5 rounded-full bg-emerald-500 mt-2" />
                      <span className={typography.body}>{rec}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
