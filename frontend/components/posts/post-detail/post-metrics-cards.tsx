"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Line, LineChart, ResponsiveContainer } from "recharts";

interface SparklineMetric {
  bucket_ts: string;
  views: number;
  likes: number;
  replies: number;
  reposts: number;
  quotes: number;
  engagement_rate: number;
  reply_rate: number;
  repost_rate: number;
  quote_rate: number;
  virality_score: number;
}

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
  sparklineMetrics?: SparklineMetric[];
}

interface MetricCardProps {
  label: string;
  value: number;
  average: number | null;
  sparklineData?: number[];
  formatValue?: (v: number) => string;
  isPercentage?: boolean;
}

function MetricCard({ label, value, average, sparklineData, formatValue, isPercentage }: MetricCardProps) {
  const displayValue = formatValue ? formatValue(value) : formatNumber(value);
  const comparison = getComparison(value, average);

  // 計算趨勢（最後一個 vs 第一個）
  const trend = sparklineData && sparklineData.length >= 2
    ? sparklineData[sparklineData.length - 1] > sparklineData[0] ? "up" : "down"
    : null;

  return (
    <Card>
      <CardContent className="px-3 py-2">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-xs text-muted-foreground">{label}</p>
          {comparison && (
            <span
              className={`text-[10px] ${
                comparison.type === "above"
                  ? "text-green-600"
                  : comparison.type === "below"
                  ? "text-orange-600"
                  : "text-gray-500"
              }`}
            >
              {comparison.type === "above" ? "↑" : comparison.type === "below" ? "↓" : "~"}
              {comparison.diff}
            </span>
          )}
        </div>
        <div className="flex items-end justify-between gap-2">
          <p className="text-lg font-bold">
            {displayValue}
            {isPercentage && "%"}
          </p>
          {sparklineData && sparklineData.length > 1 && (
            <div className="h-6 w-16">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sparklineData.map((v) => ({ v }))}>
                  <Line
                    type="monotone"
                    dataKey="v"
                    stroke={trend === "up" ? "#22c55e" : "#f97316"}
                    strokeWidth={1.5}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
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
): { label: string; type: "above" | "below" | "neutral"; diff: string } | null {
  if (average === null || average === 0) return null;

  const diff = ((current - average) / average) * 100;

  if (diff > 10) {
    return { label: `高於平均 +${diff.toFixed(0)}%`, type: "above", diff: `${diff.toFixed(0)}%` };
  } else if (diff < -10) {
    return { label: `低於平均 ${diff.toFixed(0)}%`, type: "below", diff: `${Math.abs(diff).toFixed(0)}%` };
  }
  return { label: "接近平均", type: "neutral", diff: "0%" };
}

// 計算增量（delta）：從累積值計算每日新增
function calculateDeltas(values: number[]): number[] {
  if (values.length < 2) return values;
  const deltas: number[] = [];
  for (let i = 1; i < values.length; i++) {
    deltas.push(Math.max(0, values[i] - values[i - 1]));
  }
  return deltas;
}

export function PostMetricsCards({ post, accountAverage, sparklineMetrics = [] }: PostMetricsCardsProps) {
  const [activeTab, setActiveTab] = useState<"count" | "rate">("count");

  // 提取累積值
  const viewsCumulative = sparklineMetrics.map((d) => d.views);
  const likesCumulative = sparklineMetrics.map((d) => d.likes);
  const repliesCumulative = sparklineMetrics.map((d) => d.replies);
  const repostsCumulative = sparklineMetrics.map((d) => d.reposts);
  const quotesCumulative = sparklineMetrics.map((d) => d.quotes);

  // 轉換為增量（數量指標）
  const viewsData = calculateDeltas(viewsCumulative);
  const likesData = calculateDeltas(likesCumulative);
  const repliesData = calculateDeltas(repliesCumulative);
  const repostsData = calculateDeltas(repostsCumulative);
  const quotesData = calculateDeltas(quotesCumulative);

  // 比率指標直接使用當時值（非累積）
  const engagementRateData = sparklineMetrics.map((d) => Number(d.engagement_rate));
  const replyRateData = sparklineMetrics.map((d) => Number(d.reply_rate));
  const repostRateData = sparklineMetrics.map((d) => Number(d.repost_rate));
  const quoteRateData = sparklineMetrics.map((d) => Number(d.quote_rate));
  const viralityScoreData = sparklineMetrics.map((d) => Number(d.virality_score));

  return (
    <div className="space-y-3">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "count" | "rate")}>
        <TabsList className="h-8">
          <TabsTrigger value="count" className="text-xs px-3 h-6">數量指標</TabsTrigger>
          <TabsTrigger value="rate" className="text-xs px-3 h-6">比率指標</TabsTrigger>
        </TabsList>
      </Tabs>

      {activeTab === "count" && (
        <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
          <MetricCard
            label="觀看"
            value={post.current_views}
            average={accountAverage?.avgViews ?? null}
            sparklineData={viewsData}
          />
          <MetricCard
            label="讚"
            value={post.current_likes}
            average={accountAverage?.avgLikes ?? null}
            sparklineData={likesData}
          />
          <MetricCard
            label="回覆"
            value={post.current_replies}
            average={accountAverage?.avgReplies ?? null}
            sparklineData={repliesData}
          />
          <MetricCard
            label="轉發"
            value={post.current_reposts}
            average={accountAverage?.avgReposts ?? null}
            sparklineData={repostsData}
          />
          <MetricCard
            label="引用"
            value={post.current_quotes}
            average={accountAverage?.avgQuotes ?? null}
            sparklineData={quotesData}
          />
        </div>
      )}

      {activeTab === "rate" && (
        <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
          <MetricCard
            label="互動率"
            value={post.engagement_rate}
            average={accountAverage?.avgEngagementRate ?? null}
            sparklineData={engagementRateData}
            formatValue={formatPercentage}
            isPercentage
          />
          <MetricCard
            label="回覆率"
            value={post.reply_rate}
            average={accountAverage?.avgReplyRate ?? null}
            sparklineData={replyRateData}
            formatValue={formatPercentage}
            isPercentage
          />
          <MetricCard
            label="轉發率"
            value={post.repost_rate}
            average={accountAverage?.avgRepostRate ?? null}
            sparklineData={repostRateData}
            formatValue={formatPercentage}
            isPercentage
          />
          <MetricCard
            label="引用率"
            value={post.quote_rate}
            average={accountAverage?.avgQuoteRate ?? null}
            sparklineData={quoteRateData}
            formatValue={formatPercentage}
            isPercentage
          />
          <MetricCard
            label="傳播力"
            value={post.virality_score}
            average={accountAverage?.avgViralityScore ?? null}
            sparklineData={viralityScoreData}
            formatValue={(v) => v.toFixed(2)}
          />
        </div>
      )}
    </div>
  );
}
