"use client";

import { Tags, Trophy, Sparkles, Crown, Medal, Award, Eye } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { typography, spacing } from "@/components/report-shared";
import type { ContentPatternReportContent, ContentPatternSnapshot, TagStats } from "@/hooks/use-content-pattern-report";

interface Props {
  data: ContentPatternReportContent["ai_tag_analysis"];
  snapshot: ContentPatternSnapshot;
}

interface TagRankingProps {
  title: string;
  tags: TagStats[];
}

const rankIcons = [Crown, Medal, Award];
const rankColors = ["text-amber-500", "text-slate-400", "text-amber-700"];

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
}

function TagRanking({ title, tags }: TagRankingProps) {
  if (tags.length === 0) return null;

  return (
    <div className="rounded-xl border bg-muted/30 p-4 hover:shadow-md transition-shadow">
      <h4 className={cn(typography.caption, "mb-3")}>{title}</h4>
      <div className={spacing.listCompact}>
        {tags.slice(0, 5).map((tag, idx) => {
          const RankIcon = rankIcons[idx] || null;
          const rankColor = rankColors[idx] || "text-muted-foreground";

          return (
            <div
              key={tag.tag}
              className={cn(
                "flex items-center gap-2 p-2 rounded-lg",
                idx === 0 ? "bg-indigo-50/50 border border-indigo-200" : "bg-muted/30"
              )}
            >
              <div className="shrink-0 w-6 text-center">
                {RankIcon ? (
                  <RankIcon className={cn("size-4 mx-auto", rankColor)} />
                ) : (
                  <span className="text-xs text-muted-foreground">{idx + 1}</span>
                )}
              </div>

              <Badge
                variant={idx === 0 ? "secondary" : "outline"}
                className={cn(
                  "text-xs font-normal",
                  idx === 0 && "bg-indigo-500/10 text-indigo-700 border-indigo-500/20"
                )}
              >
                {tag.tag}
              </Badge>

              <div className="ml-auto flex items-center gap-2 text-xs">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Eye className="size-3" />
                  {formatNumber(tag.avg_views)}
                </div>
                <span className="text-muted-foreground">({tag.count} 篇)</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AITagSection({ data, snapshot }: Props) {
  const tags = snapshot.ai_tags;
  const hasAnyTags =
    tags.content_type.length > 0 ||
    tags.tone.length > 0 ||
    tags.intent.length > 0 ||
    tags.topic.length > 0 ||
    tags.format.length > 0;

  const iconGradient = "bg-gradient-to-br from-indigo-500 to-purple-500 shadow-lg shadow-indigo-500/25";

  if (!hasAnyTags) {
    return (
      <Card>
        <CardContent className="pt-6 space-y-6">
          <div className="flex items-center gap-3">
            <div className={cn("p-2.5 rounded-xl", iconGradient)}>
              <Tags className="size-5 text-white" />
            </div>
            <div>
              <h2 className={typography.cardTitle}>AI 標籤效益</h2>
              <p className={typography.caption}>分析 AI 標籤與表現的關聯</p>
            </div>
          </div>
          <div className="rounded-xl border bg-muted/30 p-8 text-center">
            <Tags className="size-10 text-muted-foreground/50 mx-auto mb-3" />
            <p className={typography.body}>
              尚無足夠的 AI 標籤數據。<br />
              請在貼文管理中為貼文選取 AI 建議標籤。
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
          <div className={cn("p-2.5 rounded-xl", iconGradient)}>
            <Tags className="size-5 text-white" />
          </div>
          <div>
            <h2 className={typography.cardTitle}>AI 標籤效益</h2>
            <p className={typography.caption}>分析 AI 標籤與表現的關聯</p>
          </div>
        </div>

        {/* 最佳組合 */}
        <div className="relative rounded-xl border-2 border-indigo-200 bg-indigo-50/50 p-5">
          <Trophy className="absolute top-4 right-4 size-5 text-indigo-400/30" />

          <div className="flex items-center gap-2 mb-3">
            <Trophy className="size-5 text-amber-500" />
            <span className={cn(typography.sectionTitle, "text-indigo-700")}>最佳標籤組合</span>
          </div>

          <p className="text-base font-medium leading-relaxed">{data.top_performing_combination}</p>
        </div>

        {/* 各維度排行 */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <TagRanking title="內容類型" tags={tags.content_type} />
          <TagRanking title="語氣" tags={tags.tone} />
          <TagRanking title="意圖" tags={tags.intent} />
          <TagRanking title="主題" tags={tags.topic} />
          <TagRanking title="格式" tags={tags.format} />
        </div>

        {/* AI 分析區 */}
        <section className="rounded-xl border-2 border-amber-200 bg-amber-50/50 p-4">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="size-5 text-amber-600" />
            <h3 className={cn(typography.sectionTitle, "text-amber-700")}>AI 分析</h3>
          </div>
          <p className={cn(typography.body, "mb-3")}>{data.summary}</p>
          <ul className={spacing.listCompact}>
            {data.insights.map((insight, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="shrink-0 size-1.5 rounded-full bg-indigo-500 mt-2" />
                <span className={typography.caption}>{insight}</span>
              </li>
            ))}
          </ul>
        </section>
      </CardContent>
    </Card>
  );
}
