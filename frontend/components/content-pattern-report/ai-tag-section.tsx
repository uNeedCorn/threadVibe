"use client";

import { Tags, Trophy, Sparkles, Crown, Medal, Award, Eye } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ContentPatternReportContent, ContentPatternSnapshot, TagStats } from "@/hooks/use-content-pattern-report";

interface Props {
  data: ContentPatternReportContent["ai_tag_analysis"];
  snapshot: ContentPatternSnapshot;
}

interface TagRankingProps {
  title: string;
  tags: TagStats[];
  color: string;
}

const rankIcons = [Crown, Medal, Award];
const rankColors = [
  "text-amber-500",
  "text-slate-400",
  "text-amber-700",
];

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
}

function TagRanking({ title, tags, color }: TagRankingProps) {
  if (tags.length === 0) return null;

  return (
    <div className="rounded-xl border bg-gradient-to-br from-background to-muted/20 p-4 hover:shadow-md transition-shadow">
      <h4 className="text-[13px] font-semibold mb-3 text-muted-foreground">{title}</h4>
      <div className="space-y-2">
        {tags.slice(0, 5).map((tag, idx) => {
          const RankIcon = rankIcons[idx] || null;
          const rankColor = rankColors[idx] || "text-muted-foreground";

          return (
            <div
              key={tag.tag}
              className={cn(
                "flex items-center gap-2 p-2 rounded-lg",
                idx === 0 ? `bg-${color}-500/10 border border-${color}-500/20` : "bg-muted/30"
              )}
              style={idx === 0 ? {
                backgroundColor: `hsl(var(--${color}) / 0.1)`,
                borderColor: `hsl(var(--${color}) / 0.2)`,
              } : undefined}
            >
              {/* 排名 */}
              <div className="flex-shrink-0 w-6 text-center">
                {RankIcon ? (
                  <RankIcon className={cn("size-4 mx-auto", rankColor)} />
                ) : (
                  <span className="text-[11px] text-muted-foreground">{idx + 1}</span>
                )}
              </div>

              {/* 標籤 */}
              <Badge
                variant={idx === 0 ? "secondary" : "outline"}
                className={cn(
                  "text-[12px] font-normal",
                  idx === 0 && "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/20"
                )}
              >
                {tag.tag}
              </Badge>

              {/* 數據 */}
              <div className="ml-auto flex items-center gap-2 text-[11px]">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Eye className="size-3" />
                  {formatNumber(tag.avg_views)}
                </div>
                <span className="text-muted-foreground">
                  ({tag.count} 篇)
                </span>
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

  if (!hasAnyTags) {
    return (
      <Card className="overflow-hidden">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 shadow-lg shadow-indigo-500/25">
              <Tags className="size-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight">AI 標籤效益</h2>
              <p className="text-[13px] text-muted-foreground">
                分析 AI 標籤與表現的關聯
              </p>
            </div>
          </div>
          <div className="rounded-2xl border bg-muted/30 p-8 text-center">
            <Tags className="size-10 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-[14px] text-muted-foreground">
              尚無足夠的 AI 標籤數據。<br />
              請在貼文管理中為貼文選取 AI 建議標籤。
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
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 shadow-lg shadow-indigo-500/25">
            <Tags className="size-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">AI 標籤效益</h2>
            <p className="text-[13px] text-muted-foreground">
              分析 AI 標籤與表現的關聯
            </p>
          </div>
        </div>

        {/* 最佳組合 */}
        <div className="relative overflow-hidden mb-6 p-5 rounded-2xl bg-gradient-to-br from-indigo-500/15 via-indigo-500/10 to-purple-500/5 border-2 border-indigo-500/30">
          <div className="absolute top-3 right-3">
            <Trophy className="size-5 text-indigo-500/30" />
          </div>

          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 rounded-lg bg-indigo-500/20">
              <Trophy className="size-4 text-amber-500" />
            </div>
            <span className="text-[14px] font-semibold text-indigo-700 dark:text-indigo-400">
              最佳標籤組合
            </span>
          </div>

          <p className="text-[15px] font-medium leading-relaxed">
            {data.top_performing_combination}
          </p>
        </div>

        {/* 各維度排行 */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <TagRanking title="內容類型" tags={tags.content_type} color="indigo" />
          <TagRanking title="語氣" tags={tags.tone} color="purple" />
          <TagRanking title="意圖" tags={tags.intent} color="blue" />
          <TagRanking title="主題" tags={tags.topic} color="emerald" />
          <TagRanking title="格式" tags={tags.format} color="amber" />
        </div>

        {/* AI 分析區 */}
        <div className="mt-6 rounded-2xl border bg-gradient-to-br from-indigo-500/5 to-transparent p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 rounded-lg bg-indigo-500/10">
              <Sparkles className="size-4 text-indigo-500" />
            </div>
            <h3 className="text-[14px] font-semibold">AI 分析</h3>
          </div>
          <p className="text-[14px] leading-relaxed mb-3">{data.summary}</p>
          <ul className="space-y-2">
            {data.insights.map((insight, i) => (
              <li key={i} className="flex items-start gap-3 text-[13px]">
                <span className="flex-shrink-0 size-1.5 rounded-full bg-indigo-500 mt-2" />
                <span className="text-muted-foreground">{insight}</span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
