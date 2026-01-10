"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface PostMetricsCardsProps {
  post: {
    current_views: number;
    current_likes: number;
    current_replies: number;
    current_reposts: number;
    current_quotes: number;
    engagement_rate: number;
    reply_rate: number;
    repost_rate: number;
    quote_rate: number;
    virality_score: number;
  };
  accountAverage: {
    avgViews: number;
    avgLikes: number;
    avgReplies: number;
    avgReposts: number;
    avgQuotes: number;
    avgEngagementRate: number;
    avgReplyRate: number;
    avgRepostRate: number;
    avgQuoteRate: number;
    avgViralityScore: number;
    postCount: number;
  } | null;
}

interface MetricCardProps {
  label: string;
  value: number;
  average: number | null;
  formatValue?: (v: number) => string;
  isPercentage?: boolean;
}

function MetricCard({ label, value, average, formatValue, isPercentage }: MetricCardProps) {
  const displayValue = formatValue ? formatValue(value) : formatNumber(value);
  const comparison = getComparison(value, average);

  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-bold">
          {displayValue}
          {isPercentage && "%"}
        </p>
        {comparison && (
          <Badge
            variant="outline"
            className={`mt-2 ${
              comparison.type === "above"
                ? "border-green-500 text-green-600"
                : comparison.type === "below"
                ? "border-orange-500 text-orange-600"
                : "border-gray-300 text-gray-500"
            }`}
          >
            {comparison.label}
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
}

function formatPercentage(num: number): string {
  return num.toFixed(2);
}

function getComparison(
  current: number,
  average: number | null
): { label: string; type: "above" | "below" | "neutral" } | null {
  if (average === null || average === 0) return null;

  const diff = ((current - average) / average) * 100;

  if (diff > 10) {
    return { label: `高於平均 +${diff.toFixed(0)}%`, type: "above" };
  } else if (diff < -10) {
    return { label: `低於平均 ${diff.toFixed(0)}%`, type: "below" };
  }
  return { label: "接近平均", type: "neutral" };
}

export function PostMetricsCards({ post, accountAverage }: PostMetricsCardsProps) {
  return (
    <div className="space-y-4">
      {/* 數量指標 */}
      <div>
        <h3 className="mb-3 text-sm font-medium text-muted-foreground">數量指標</h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <MetricCard
            label="觀看"
            value={post.current_views}
            average={accountAverage?.avgViews ?? null}
          />
          <MetricCard
            label="讚"
            value={post.current_likes}
            average={accountAverage?.avgLikes ?? null}
          />
          <MetricCard
            label="回覆"
            value={post.current_replies}
            average={accountAverage?.avgReplies ?? null}
          />
          <MetricCard
            label="轉發"
            value={post.current_reposts}
            average={accountAverage?.avgReposts ?? null}
          />
          <MetricCard
            label="引用"
            value={post.current_quotes}
            average={accountAverage?.avgQuotes ?? null}
          />
        </div>
      </div>

      {/* 比率指標 */}
      <div>
        <h3 className="mb-3 text-sm font-medium text-muted-foreground">比率指標</h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <MetricCard
            label="互動率"
            value={post.engagement_rate}
            average={accountAverage?.avgEngagementRate ?? null}
            formatValue={formatPercentage}
            isPercentage
          />
          <MetricCard
            label="回覆率"
            value={post.reply_rate}
            average={accountAverage?.avgReplyRate ?? null}
            formatValue={formatPercentage}
            isPercentage
          />
          <MetricCard
            label="轉發率"
            value={post.repost_rate}
            average={accountAverage?.avgRepostRate ?? null}
            formatValue={formatPercentage}
            isPercentage
          />
          <MetricCard
            label="引用率"
            value={post.quote_rate}
            average={accountAverage?.avgQuoteRate ?? null}
            formatValue={formatPercentage}
            isPercentage
          />
          <MetricCard
            label="傳播力"
            value={post.virality_score}
            average={accountAverage?.avgViralityScore ?? null}
            formatValue={(v) => v.toFixed(2)}
          />
        </div>
      </div>
    </div>
  );
}
