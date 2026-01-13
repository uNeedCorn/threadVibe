"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { TrendingUp, TrendingDown, Eye, Activity, Clock, BarChart3, Users, Trophy, AlertTriangle, Flame, Snowflake, ChevronDown, ChevronLeft, ChevronRight, Zap, Rocket, Scale, BarChart2, PanelRightOpen } from "lucide-react";
import { XAxis, YAxis, CartesianGrid, Area, AreaChart, Tooltip } from "recharts";
import { createClient } from "@/lib/supabase/client";
import { useSelectedAccount } from "@/hooks/use-selected-account";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { PostDetailPanel } from "@/components/posts/post-detail-panel";
import { cn } from "@/lib/utils";

type Period = "week" | "month";

interface DailyViewsData {
  date: string;
  label: string;
  views: number;
}

interface ViewsStats {
  totalViews: number;
  previousTotalViews: number;
  growthRate: number;
  dailyData: DailyViewsData[];
}

interface TagLifecycleAnalysis {
  id: string;
  name: string;
  color: string;
  postCount: number;
  // 類型分類
  lifecycleType: "viral" | "evergreen" | "normal";
  // 各階段時間（小時）
  burstEndHour: number;      // 爆發期結束
  growthEndHour: number;     // 成長期結束
  stableEndHour: number;     // 穩定期結束（開始衰退）
  // 關鍵數據
  first24hRatio: number;     // 前 24h 曝光佔比 (0-1)
  avgDecayHour: number;      // 平均衰退時間（小時）
  avgViewsPerPost: number;   // 平均每篇曝光數
}

interface HeatmapCell {
  dayOfWeek: number; // 0 = Sunday, 6 = Saturday
  hour: number; // 0-23
  avgViews: number;
  postCount: number;
}

interface EfficiencyStats {
  avgViewsPerPost: number;
  viewsPerFollower: number;
  totalPosts: number;
  followersCount: number;
}

interface RankedPost {
  id: string;
  text: string;
  views: number;
  publishedAt: string;
}

interface AnomalyAlert {
  type: "viral" | "underperform";
  postId: string;
  postText: string;
  views: number;
  avgViews: number;
  ratio: number; // views / avgViews
  publishedAt: string;
}

const chartConfig: ChartConfig = {
  views: {
    label: "新增曝光",
    color: "#14B8A6", // Teal 500
  },
};

// 標籤圖表的預設顏色
const TAG_COLORS = [
  "#14B8A6", // Teal
  "#8B5CF6", // Violet
  "#F59E0B", // Amber
  "#EF4444", // Red
  "#3B82F6", // Blue
  "#10B981", // Emerald
  "#EC4899", // Pink
  "#6366F1", // Indigo
];

// 星期幾名稱
const WEEKDAY_NAMES = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];

// 24 小時標籤
const HOUR_LABELS_24 = Array.from({ length: 24 }, (_, i) => i);

function GrowthBadge({ value, className }: { value: number; className?: string }) {
  if (value === 0) return null;

  const isPositive = value > 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-sm font-medium",
        isPositive ? "text-green-600" : "text-red-600",
        className
      )}
    >
      {isPositive ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
      {isPositive ? "+" : ""}{value.toFixed(1)}%
    </span>
  );
}

function formatNumber(v: number) {
  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
  return v.toLocaleString();
}

function truncateText(text: string, maxLength: number = 20): string {
  if (!text) return "(無文字內容)";
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

function getDateRange(period: Period, offset: number = 0): { start: Date; end: Date; label: string } {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  if (period === "week") {
    // 計算本週日
    const dayOfWeek = now.getDay();
    const thisWeekSunday = new Date(now);
    thisWeekSunday.setDate(now.getDate() - dayOfWeek);

    // 套用 offset（負數 = 往前幾週）
    const targetSunday = new Date(thisWeekSunday);
    targetSunday.setDate(thisWeekSunday.getDate() + offset * 7);

    const start = new Date(targetSunday);
    let end: Date;

    if (offset === 0) {
      // 本週：到今天
      end = new Date(now);
    } else {
      // 過去的週：完整一週（週六）
      end = new Date(targetSunday);
      end.setDate(end.getDate() + 6);
    }

    // 產生標籤
    const startLabel = `${start.getMonth() + 1}/${start.getDate()}`;
    const endLabel = `${end.getMonth() + 1}/${end.getDate()}`;
    let label: string;
    if (offset === 0) {
      label = "本週";
    } else if (offset === -1) {
      label = "上週";
    } else {
      label = `${startLabel} - ${endLabel}`;
    }

    return { start, end, label };
  } else {
    // 計算目標月份
    const targetMonth = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const start = new Date(targetMonth);
    let end: Date;

    if (offset === 0) {
      // 本月：到今天
      end = new Date(now);
    } else {
      // 過去的月：到該月最後一天
      end = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0);
    }

    // 產生標籤
    let label: string;
    if (offset === 0) {
      label = "本月";
    } else if (offset === -1) {
      label = "上月";
    } else {
      label = `${targetMonth.getFullYear()}/${targetMonth.getMonth() + 1}`;
    }

    return { start, end, label };
  }
}

function LifecycleTagCard({ tag }: { tag: TagLifecycleAnalysis }) {
  return (
    <div className="rounded-lg border p-4">
      {/* 標題列 */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="size-3 rounded-full"
            style={{ backgroundColor: tag.color }}
          />
          <span className="font-medium">{tag.name}</span>
          <span className="text-sm text-muted-foreground">
            ({tag.postCount} 篇)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right">
            <div className="text-lg font-bold leading-tight">
              {formatNumber(tag.avgViewsPerPost)}
            </div>
            <div className="text-xs text-muted-foreground">平均曝光</div>
          </div>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
              tag.lifecycleType === "viral"
                ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                : tag.lifecycleType === "evergreen"
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
            )}
          >
            {tag.lifecycleType === "viral" && <><Zap className="size-3" /> 病毒型</>}
            {tag.lifecycleType === "evergreen" && <><TrendingUp className="size-3" /> 長青型</>}
            {tag.lifecycleType === "normal" && <><BarChart2 className="size-3" /> 一般型</>}
          </span>
        </div>
      </div>

      {/* 時間軸視覺化 */}
      <div className="mb-3">
        <div className="mb-1 flex text-xs text-muted-foreground">
          <div style={{ width: `${(tag.burstEndHour / 168) * 100}%` }} className="flex items-center justify-center gap-0.5">
            <Rocket className="size-3" /> 爆發期
          </div>
          <div style={{ width: `${((tag.growthEndHour - tag.burstEndHour) / 168) * 100}%` }} className="flex items-center justify-center gap-0.5">
            <TrendingUp className="size-3" /> 成長期
          </div>
          <div style={{ width: `${((tag.stableEndHour - tag.growthEndHour) / 168) * 100}%` }} className="flex items-center justify-center gap-0.5">
            <Scale className="size-3" /> 穩定期
          </div>
          <div style={{ width: `${((168 - tag.stableEndHour) / 168) * 100}%` }} className="flex items-center justify-center gap-0.5">
            <TrendingDown className="size-3" /> 衰退期
          </div>
        </div>
        <div className="flex h-3 overflow-hidden rounded-full">
          <div
            className="bg-orange-400"
            style={{ width: `${(tag.burstEndHour / 168) * 100}%` }}
          />
          <div
            className="bg-green-400"
            style={{ width: `${((tag.growthEndHour - tag.burstEndHour) / 168) * 100}%` }}
          />
          <div
            className="bg-blue-400"
            style={{ width: `${((tag.stableEndHour - tag.growthEndHour) / 168) * 100}%` }}
          />
          <div
            className="bg-gray-300 dark:bg-gray-600"
            style={{ width: `${((168 - tag.stableEndHour) / 168) * 100}%` }}
          />
        </div>
        <div className="mt-1 flex text-xs text-muted-foreground">
          <div style={{ width: `${(tag.burstEndHour / 168) * 100}%` }} className="text-center">
            0-{tag.burstEndHour}h
          </div>
          <div style={{ width: `${((tag.growthEndHour - tag.burstEndHour) / 168) * 100}%` }} className="text-center">
            {tag.burstEndHour}-{tag.growthEndHour}h
          </div>
          <div style={{ width: `${((tag.stableEndHour - tag.growthEndHour) / 168) * 100}%` }} className="text-center">
            {tag.growthEndHour}-{tag.stableEndHour}h
          </div>
          <div style={{ width: `${((168 - tag.stableEndHour) / 168) * 100}%` }} className="text-center">
            {tag.stableEndHour}h+
          </div>
        </div>
      </div>

      {/* 關鍵數據 */}
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <div>
          <span className="text-muted-foreground">前 24h：</span>
          <span className={cn(
            "font-medium",
            tag.first24hRatio > 0.7 ? "text-orange-600" : tag.first24hRatio < 0.4 ? "text-green-600" : ""
          )}>
            {Math.round(tag.first24hRatio * 100)}%
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">衰退：</span>
          <span className="font-medium">
            {tag.avgDecayHour >= 168 ? "168h+" : `${tag.avgDecayHour}h`}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function ReachPage() {
  const { selectedAccountId } = useSelectedAccount();
  const [period, setPeriod] = useState<Period>("week");
  const [offset, setOffset] = useState(0); // 0 = 本週/本月，-1 = 上週/上月，依此類推
  const [isLoading, setIsLoading] = useState(true);
  const [isLifecycleLoading, setIsLifecycleLoading] = useState(true);
  const [isHeatmapLoading, setIsHeatmapLoading] = useState(true);
  const [isRankingLoading, setIsRankingLoading] = useState(true);
  const [viewsStats, setViewsStats] = useState<ViewsStats | null>(null);
  const [lifecycleAnalysis, setLifecycleAnalysis] = useState<TagLifecycleAnalysis[]>([]);
  const [heatmapData, setHeatmapData] = useState<HeatmapCell[]>([]);
  const [efficiencyStats, setEfficiencyStats] = useState<EfficiencyStats | null>(null);
  const [topPosts, setTopPosts] = useState<RankedPost[]>([]);
  const [flopPosts, setFlopPosts] = useState<RankedPost[]>([]);
  const [anomalies, setAnomalies] = useState<AnomalyAlert[]>([]);
  const [isLifecycleOpen, setIsLifecycleOpen] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  // 取得曝光趨勢資料（使用 Delta 計算每日新增曝光）
  useEffect(() => {
    if (!selectedAccountId) {
      setIsLoading(false);
      return;
    }

    async function fetchTrendData() {
      setIsLoading(true);
      try {
        const supabase = createClient();

        // 使用 getDateRange 取得當前期間和上一期間
        const currentRange = getDateRange(period, offset);
        const previousRange = getDateRange(period, offset - 1);

        const currentStart = currentRange.start;
        const currentEnd = currentRange.end;
        const previousStart = previousRange.start;
        const previousEnd = previousRange.end;

        // 為了計算 delta，需要取得前一天的資料作為基準
        const queryStart = new Date(currentStart);
        queryStart.setDate(queryStart.getDate() - 1); // 往前一天

        // 查詢當前期間 + 前一天的每日曝光數（用於計算 delta）
        const { data: currentData, error: currentError } = await supabase
          .from("workspace_threads_post_metrics_daily")
          .select(`
            workspace_threads_post_id,
            bucket_date,
            views,
            workspace_threads_posts!inner(workspace_threads_account_id)
          `)
          .eq("workspace_threads_posts.workspace_threads_account_id", selectedAccountId)
          .gte("bucket_date", queryStart.toISOString().split("T")[0])
          .lte("bucket_date", currentEnd.toISOString().split("T")[0])
          .order("bucket_date", { ascending: true });

        if (currentError) {
          console.error("Error fetching current views:", currentError);
          setViewsStats(null);
          return;
        }

        // 查詢上一期間的資料（同樣需要前一天作為 delta 基準）
        const previousQueryStart = new Date(previousStart);
        previousQueryStart.setDate(previousQueryStart.getDate() - 1);

        const { data: previousData, error: previousError } = await supabase
          .from("workspace_threads_post_metrics_daily")
          .select(`
            workspace_threads_post_id,
            bucket_date,
            views,
            workspace_threads_posts!inner(workspace_threads_account_id)
          `)
          .eq("workspace_threads_posts.workspace_threads_account_id", selectedAccountId)
          .gte("bucket_date", previousQueryStart.toISOString().split("T")[0])
          .lte("bucket_date", previousEnd.toISOString().split("T")[0])
          .order("bucket_date", { ascending: true });

        if (previousError) {
          console.error("Error fetching previous views:", previousError);
        }

        // 計算 Delta：每個貼文每天的增量
        function calculateDailyDeltas(
          data: typeof currentData,
          startDate: Date,
          endDate: Date
        ): Map<string, number> {
          const dailyDeltaMap = new Map<string, number>();

          // 初始化日期
          const start = new Date(startDate);
          const end = new Date(endDate);
          for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            dailyDeltaMap.set(d.toISOString().split("T")[0], 0);
          }

          if (!data || data.length === 0) return dailyDeltaMap;

          // 按貼文 ID 分組
          const byPost = new Map<string, { date: string; views: number }[]>();
          data.forEach((row) => {
            const postId = row.workspace_threads_post_id;
            if (!byPost.has(postId)) {
              byPost.set(postId, []);
            }
            byPost.get(postId)!.push({
              date: row.bucket_date,
              views: row.views || 0,
            });
          });

          // 計算每個貼文每天的 delta
          byPost.forEach((records) => {
            // 按日期排序
            records.sort((a, b) => a.date.localeCompare(b.date));

            for (let i = 0; i < records.length; i++) {
              const current = records[i];
              const prev = i > 0 ? records[i - 1] : null;

              // 只計算在目標範圍內的日期
              const currentDate = new Date(current.date);
              if (currentDate < startDate || currentDate > endDate) continue;

              // Delta = 當天 views - 前一天 views
              // 如果沒有前一天資料，delta = 當天 views（新貼文）
              const delta = prev ? current.views - prev.views : current.views;

              // 累加到該日的總 delta（只計入正數，避免資料修正造成負值）
              const dateStr = current.date;
              const existing = dailyDeltaMap.get(dateStr) || 0;
              dailyDeltaMap.set(dateStr, existing + Math.max(0, delta));
            }
          });

          return dailyDeltaMap;
        }

        // 計算當前期間的每日 delta
        const currentDeltaMap = calculateDailyDeltas(currentData, currentStart, currentEnd);

        // 轉換為圖表數據
        const dailyData: DailyViewsData[] = Array.from(currentDeltaMap.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, views]) => {
            const d = new Date(date);
            const label = `${d.getMonth() + 1}/${d.getDate()}`;
            return { date, label, views };
          });

        // 計算當前期間總 delta
        const totalViews = dailyData.reduce((sum, d) => sum + d.views, 0);

        // 計算上一期間的總 delta
        const previousDeltaMap = calculateDailyDeltas(previousData || [], previousStart, previousEnd);
        const previousTotalViews = Array.from(previousDeltaMap.values()).reduce((sum, v) => sum + v, 0);

        // 計算成長率
        const growthRate = previousTotalViews > 0
          ? ((totalViews - previousTotalViews) / previousTotalViews) * 100
          : 0;

        setViewsStats({
          totalViews,
          previousTotalViews,
          growthRate,
          dailyData,
        });
      } catch (error) {
        console.error("Error fetching reach data:", error);
        setViewsStats(null);
      } finally {
        setIsLoading(false);
      }
    }

    fetchTrendData();
  }, [selectedAccountId, period, offset]);

  // 取得標籤生命週期分析資料
  useEffect(() => {
    if (!selectedAccountId) {
      setIsLifecycleLoading(false);
      return;
    }

    async function fetchLifecycleAnalysis() {
      setIsLifecycleLoading(true);
      try {
        const supabase = createClient();

        // 1. 取得帳號的所有標籤
        const { data: tags, error: tagsError } = await supabase
          .from("workspace_threads_account_tags")
          .select("id, name, color")
          .eq("workspace_threads_account_id", selectedAccountId);

        if (tagsError) {
          console.error("Error fetching tags:", tagsError);
          return;
        }

        if (!tags || tags.length === 0) {
          setLifecycleAnalysis([]);
          return;
        }

        // 2. 取得時間範圍內有標籤的貼文
        const { start: dateStart } = getDateRange(period, offset);

        const { data: postsWithTags, error: postsError } = await supabase
          .from("workspace_threads_posts")
          .select(`
            id,
            published_at,
            current_views,
            workspace_threads_post_tags(tag_id)
          `)
          .eq("workspace_threads_account_id", selectedAccountId)
          .gte("published_at", dateStart.toISOString());

        if (postsError) {
          console.error("Error fetching posts with tags:", postsError);
          return;
        }

        // 建立 postId -> tagIds 的映射
        const postTagMap = new Map<string, string[]>();
        postsWithTags?.forEach((post) => {
          const tagIds = post.workspace_threads_post_tags?.map((pt: { tag_id: string }) => pt.tag_id) || [];
          if (tagIds.length > 0) {
            postTagMap.set(post.id, tagIds);
          }
        });

        const postIdsWithTags = Array.from(postTagMap.keys());

        if (postIdsWithTags.length === 0) {
          setLifecycleAnalysis([]);
          return;
        }

        // 3. 取得這些貼文的小時級數據
        const { data: hourlyMetrics, error: metricsError } = await supabase
          .from("workspace_threads_post_metrics_hourly")
          .select("workspace_threads_post_id, bucket_ts, views")
          .in("workspace_threads_post_id", postIdsWithTags);

        if (metricsError) {
          console.error("Error fetching hourly metrics:", metricsError);
          return;
        }

        // 建立 postId -> publishedAt 映射 和 postId -> currentViews 映射
        const postPublishedMap = new Map<string, Date>();
        const postViewsMap = new Map<string, number>();
        postsWithTags?.forEach((post) => {
          postPublishedMap.set(post.id, new Date(post.published_at));
          postViewsMap.set(post.id, post.current_views || 0);
        });

        // 4. 計算每個標籤的生命週期數據
        // tagId -> hourBucket (每小時) -> totalViews
        const tagHourlyData = new Map<string, Map<number, number>>();
        const MAX_HOURS = 168; // 7 days

        // 初始化
        tags.forEach((tag) => {
          const hourMap = new Map<number, number>();
          for (let h = 0; h < MAX_HOURS; h++) {
            hourMap.set(h, 0);
          }
          tagHourlyData.set(tag.id, hourMap);
        });

        // 計算每個標籤的貼文數和總曝光數
        const tagPostCounts = new Map<string, Set<string>>();
        const tagTotalViews = new Map<string, number>();
        postTagMap.forEach((tagIds, postId) => {
          const postViews = postViewsMap.get(postId) || 0;
          tagIds.forEach((tagId) => {
            if (!tagPostCounts.has(tagId)) {
              tagPostCounts.set(tagId, new Set());
              tagTotalViews.set(tagId, 0);
            }
            tagPostCounts.get(tagId)!.add(postId);
            tagTotalViews.set(tagId, (tagTotalViews.get(tagId) || 0) + postViews);
          });
        });

        // 填充數據
        hourlyMetrics?.forEach((metric) => {
          const postId = metric.workspace_threads_post_id;
          const publishedAt = postPublishedMap.get(postId);
          const tagIds = postTagMap.get(postId);

          if (!publishedAt || !tagIds) return;

          const bucketTs = new Date(metric.bucket_ts);
          const hoursSincePublish = Math.floor(
            (bucketTs.getTime() - publishedAt.getTime()) / (1000 * 60 * 60)
          );

          if (hoursSincePublish < 0 || hoursSincePublish >= MAX_HOURS) return;

          tagIds.forEach((tagId) => {
            const hourMap = tagHourlyData.get(tagId);
            if (hourMap) {
              const current = hourMap.get(hoursSincePublish) || 0;
              hourMap.set(hoursSincePublish, current + (metric.views || 0));
            }
          });
        });

        // 5. 分析每個標籤的生命週期特徵
        const analysisResults: TagLifecycleAnalysis[] = [];

        tags.forEach((tag, index) => {
          const postCount = tagPostCounts.get(tag.id)?.size || 0;
          if (postCount === 0) return;

          const hourMap = tagHourlyData.get(tag.id);
          if (!hourMap) return;

          // 計算總曝光和各階段曝光
          let totalViews = 0;
          let first24hViews = 0;
          let day3to7Views = 0; // 72-168h

          const hourlyViews: number[] = [];
          for (let h = 0; h < MAX_HOURS; h++) {
            const views = hourMap.get(h) || 0;
            hourlyViews.push(views);
            totalViews += views;
            if (h < 24) first24hViews += views;
            if (h >= 72) day3to7Views += views;
          }

          if (totalViews === 0) return;

          // 計算前 24h 佔比
          const first24hRatio = first24hViews / totalViews;
          const day3to7Ratio = day3to7Views / totalViews;

          // 判斷類型
          let lifecycleType: "viral" | "evergreen" | "normal" = "normal";
          if (first24hRatio > 0.7) {
            lifecycleType = "viral";
          } else if (day3to7Ratio > 0.3) {
            lifecycleType = "evergreen";
          }

          // 計算階段時間點（找到曝光下降到峰值一定比例的時間）
          // 找峰值時間和峰值
          let peakHour = 0;
          let peakViews = 0;
          for (let h = 0; h < MAX_HOURS; h++) {
            if (hourlyViews[h] > peakViews) {
              peakViews = hourlyViews[h];
              peakHour = h;
            }
          }

          // 計算累積曝光達到特定比例的時間
          let cumulative = 0;
          let burst50Hour = 24; // 累積 50% 的時間（爆發期結束）
          let burst80Hour = 48; // 累積 80% 的時間（成長期結束）
          let burst95Hour = 72; // 累積 95% 的時間（穩定期結束）

          for (let h = 0; h < MAX_HOURS; h++) {
            cumulative += hourlyViews[h];
            const ratio = cumulative / totalViews;
            if (ratio >= 0.5 && burst50Hour === 24) burst50Hour = Math.max(h, 12);
            if (ratio >= 0.8 && burst80Hour === 48) burst80Hour = Math.max(h, 24);
            if (ratio >= 0.95 && burst95Hour === 72) burst95Hour = Math.max(h, 48);
          }

          // 計算平均衰退時間（曝光下降到峰值 10% 以下的時間）
          let decayHour = MAX_HOURS;
          const decayThreshold = peakViews * 0.1;
          for (let h = peakHour; h < MAX_HOURS; h++) {
            if (hourlyViews[h] < decayThreshold) {
              decayHour = h;
              break;
            }
          }

          // 計算平均每篇曝光數
          const totalTagViews = tagTotalViews.get(tag.id) || 0;
          const avgViewsPerPost = postCount > 0 ? Math.round(totalTagViews / postCount) : 0;

          analysisResults.push({
            id: tag.id,
            name: tag.name,
            color: tag.color || TAG_COLORS[index % TAG_COLORS.length],
            postCount,
            lifecycleType,
            burstEndHour: burst50Hour,
            growthEndHour: burst80Hour,
            stableEndHour: burst95Hour,
            first24hRatio,
            avgDecayHour: decayHour,
            avgViewsPerPost,
          });
        });

        // 按平均曝光數排序（高到低）
        analysisResults.sort((a, b) => b.avgViewsPerPost - a.avgViewsPerPost);

        setLifecycleAnalysis(analysisResults);
      } catch (error) {
        console.error("Error fetching lifecycle analysis:", error);
        setLifecycleAnalysis([]);
      } finally {
        setIsLifecycleLoading(false);
      }
    }

    fetchLifecycleAnalysis();
  }, [selectedAccountId, period, offset]);

  // 取得熱力圖和效率指標資料
  useEffect(() => {
    if (!selectedAccountId) {
      setIsHeatmapLoading(false);
      return;
    }

    async function fetchHeatmapAndEfficiency() {
      setIsHeatmapLoading(true);
      try {
        const supabase = createClient();

        // 1. 取得帳號資訊（粉絲數）
        const { data: account, error: accountError } = await supabase
          .from("workspace_threads_accounts")
          .select("current_followers_count")
          .eq("id", selectedAccountId)
          .single();

        if (accountError) {
          console.error("Error fetching account:", accountError);
        }

        const followersCount = account?.current_followers_count || 0;

        // 2. 取得時間範圍內的貼文（發布時間和當前曝光數）
        const { start: dateStart } = getDateRange(period, offset);

        const { data: posts, error: postsError } = await supabase
          .from("workspace_threads_posts")
          .select("id, published_at, current_views")
          .eq("workspace_threads_account_id", selectedAccountId)
          .gte("published_at", dateStart.toISOString());

        if (postsError) {
          console.error("Error fetching posts for heatmap:", postsError);
          return;
        }

        if (!posts || posts.length === 0) {
          setHeatmapData([]);
          setEfficiencyStats(null);
          return;
        }

        // 3. 計算熱力圖數據（星期 x 24 小時）
        const heatmapMap = new Map<string, { totalViews: number; count: number }>();

        // 初始化所有格子（7 天 x 24 小時）
        for (let day = 0; day < 7; day++) {
          for (let hour = 0; hour < 24; hour++) {
            const key = `${day}-${hour}`;
            heatmapMap.set(key, { totalViews: 0, count: 0 });
          }
        }

        // 填充數據
        let totalViews = 0;
        posts.forEach((post) => {
          const publishedAt = new Date(post.published_at);
          const dayOfWeek = publishedAt.getDay(); // 0 = Sunday
          const hour = publishedAt.getHours(); // 0-23
          const key = `${dayOfWeek}-${hour}`;

          const cell = heatmapMap.get(key);
          if (cell) {
            cell.totalViews += post.current_views || 0;
            cell.count += 1;
          }
          totalViews += post.current_views || 0;
        });

        // 轉換為陣列格式
        const heatmapArray: HeatmapCell[] = [];
        heatmapMap.forEach((value, key) => {
          const [day, hour] = key.split("-").map(Number);
          heatmapArray.push({
            dayOfWeek: day,
            hour: hour,
            avgViews: value.count > 0 ? Math.round(value.totalViews / value.count) : 0,
            postCount: value.count,
          });
        });

        setHeatmapData(heatmapArray);

        // 4. 計算效率指標
        const avgViewsPerPost = posts.length > 0 ? Math.round(totalViews / posts.length) : 0;
        const viewsPerFollower = followersCount > 0 ? totalViews / followersCount : 0;

        setEfficiencyStats({
          avgViewsPerPost,
          viewsPerFollower,
          totalPosts: posts.length,
          followersCount,
        });
      } catch (error) {
        console.error("Error fetching heatmap data:", error);
        setHeatmapData([]);
        setEfficiencyStats(null);
      } finally {
        setIsHeatmapLoading(false);
      }
    }

    fetchHeatmapAndEfficiency();
  }, [selectedAccountId, period, offset]);

  // 取得 Top/Flop 榜和異常提醒資料
  useEffect(() => {
    if (!selectedAccountId) {
      setIsRankingLoading(false);
      return;
    }

    async function fetchRankingAndAnomalies() {
      setIsRankingLoading(true);
      try {
        const supabase = createClient();

        // 取得時間範圍內的貼文
        const { start: dateStart } = getDateRange(period, offset);

        const { data: posts, error: postsError } = await supabase
          .from("workspace_threads_posts")
          .select("id, text, current_views, published_at")
          .eq("workspace_threads_account_id", selectedAccountId)
          .gte("published_at", dateStart.toISOString())
          .order("current_views", { ascending: false });

        if (postsError) {
          console.error("Error fetching posts for ranking:", postsError);
          return;
        }

        if (!posts || posts.length === 0) {
          setTopPosts([]);
          setFlopPosts([]);
          setAnomalies([]);
          return;
        }

        // Top 5 貼文
        const top5 = posts.slice(0, 5).map((p) => ({
          id: p.id,
          text: p.text || "",
          views: p.current_views || 0,
          publishedAt: p.published_at,
        }));
        setTopPosts(top5);

        // Flop 5 貼文（排除曝光為 0 的）
        const nonZeroPosts = posts.filter((p) => (p.current_views || 0) > 0);
        const flop5 = [...nonZeroPosts]
          .sort((a, b) => (a.current_views || 0) - (b.current_views || 0))
          .slice(0, 5)
          .map((p) => ({
            id: p.id,
            text: p.text || "",
            views: p.current_views || 0,
            publishedAt: p.published_at,
          }));
        setFlopPosts(flop5);

        // 計算異常值（爆文和低迷）
        // 使用平均值和標準差來判斷
        const views = posts.map((p) => p.current_views || 0);
        const avgViews = views.reduce((a, b) => a + b, 0) / views.length;

        // 計算標準差
        const squaredDiffs = views.map((v) => Math.pow(v - avgViews, 2));
        const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / squaredDiffs.length;
        const stdDev = Math.sqrt(avgSquaredDiff);

        // 爆文：超過平均值 + 2 倍標準差
        // 低迷：低於平均值 - 1 倍標準差（且至少有一些曝光）
        const viralThreshold = avgViews + 2 * stdDev;
        const underperformThreshold = Math.max(avgViews - stdDev, avgViews * 0.3); // 至少是平均的 30%

        const anomalyList: AnomalyAlert[] = [];

        posts.forEach((post) => {
          const postViews = post.current_views || 0;

          if (postViews > viralThreshold && postViews > avgViews * 1.5) {
            anomalyList.push({
              type: "viral",
              postId: post.id,
              postText: post.text || "",
              views: postViews,
              avgViews: Math.round(avgViews),
              ratio: postViews / avgViews,
              publishedAt: post.published_at,
            });
          } else if (postViews < underperformThreshold && postViews > 0 && avgViews > 0) {
            anomalyList.push({
              type: "underperform",
              postId: post.id,
              postText: post.text || "",
              views: postViews,
              avgViews: Math.round(avgViews),
              ratio: postViews / avgViews,
              publishedAt: post.published_at,
            });
          }
        });

        // 只取最顯著的前 5 個異常
        anomalyList.sort((a, b) => {
          if (a.type === "viral" && b.type === "underperform") return -1;
          if (a.type === "underperform" && b.type === "viral") return 1;
          if (a.type === "viral") return b.ratio - a.ratio; // 爆文按比例降序
          return a.ratio - b.ratio; // 低迷按比例升序
        });

        setAnomalies(anomalyList.slice(0, 5));
      } catch (error) {
        console.error("Error fetching ranking data:", error);
        setTopPosts([]);
        setFlopPosts([]);
        setAnomalies([]);
      } finally {
        setIsRankingLoading(false);
      }
    }

    fetchRankingAndAnomalies();
  }, [selectedAccountId, period, offset]);

  // 找出熱力圖最大值（用於顏色計算）
  const maxHeatmapViews = Math.max(...heatmapData.map((d) => d.avgViews), 1);

  // 計算熱力圖格子顏色
  function getHeatmapColor(value: number, max: number): string {
    if (value === 0) return "bg-muted";
    const intensity = value / max;
    if (intensity > 0.75) return "bg-teal-500";
    if (intensity > 0.5) return "bg-teal-400";
    if (intensity > 0.25) return "bg-teal-300";
    return "bg-teal-200";
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">曝光分析</h1>
          <p className="text-muted-foreground">
            深入了解貼文的曝光趨勢與觸及表現
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* 週/月切換 */}
          <Tabs value={period} onValueChange={(v) => { setPeriod(v as Period); setOffset(0); }}>
            <TabsList>
              <TabsTrigger value="week">週</TabsTrigger>
              <TabsTrigger value="month">月</TabsTrigger>
            </TabsList>
          </Tabs>
          {/* 左右箭頭導航 */}
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => setOffset(offset - 1)}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <div className="min-w-[80px] text-center text-sm font-medium">
              {getDateRange(period, offset).label}
            </div>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => setOffset(offset + 1)}
              disabled={offset >= 0}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* 未選擇帳號提示 */}
      {!selectedAccountId && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            請先在左側選單選擇一個 Threads 帳號
          </CardContent>
        </Card>
      )}

      {/* 曝光趨勢圖 */}
      {selectedAccountId && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="size-5" />
                  曝光趨勢
                </CardTitle>
                <CardDescription>
                  {(() => {
                    const range = getDateRange(period, offset);
                    const startLabel = `${range.start.getMonth() + 1}/${range.start.getDate()}`;
                    const endLabel = `${range.end.getMonth() + 1}/${range.end.getDate()}`;
                    return `${startLabel} - ${endLabel} 每日新增曝光數`;
                  })()}
                </CardDescription>
              </div>
              {!isLoading && viewsStats && (
                <div className="text-right">
                  <div className="text-2xl font-bold">
                    {formatNumber(viewsStats.totalViews)}
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <span className="text-sm text-muted-foreground">
                      vs {getDateRange(period, offset - 1).label}
                    </span>
                    <GrowthBadge value={viewsStats.growthRate} />
                  </div>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : viewsStats && viewsStats.dailyData.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[300px] w-full">
                <AreaChart data={viewsStats.dailyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="viewsGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#14B8A6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#14B8A6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12 }}
                    tickFormatter={(v) => formatNumber(v)}
                    width={50}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value) => [formatNumber(value as number), "新增曝光"]}
                      />
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="views"
                    stroke="#14B8A6"
                    strokeWidth={2}
                    fill="url(#viewsGradient)"
                  />
                </AreaChart>
              </ChartContainer>
            ) : (
              <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                該期間內沒有曝光數據
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 內容類型生命週期分析 */}
      {selectedAccountId && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="size-5" />
              內容類型生命週期分析
            </CardTitle>
            <CardDescription>
              分析不同標籤類型的曝光特性，了解哪種內容是爆文型或長效型
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLifecycleLoading ? (
              <div className="grid gap-4 md:grid-cols-2">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-36 w-full" />
                ))}
              </div>
            ) : lifecycleAnalysis.length > 0 ? (
              <div className="space-y-4">
                {/* 前 4 名始終顯示 */}
                <div className="grid gap-4 md:grid-cols-2">
                  {lifecycleAnalysis.slice(0, 4).map((tag) => (
                    <LifecycleTagCard key={tag.id} tag={tag} />
                  ))}
                </div>

                {/* 更多標籤（折疊） */}
                {lifecycleAnalysis.length > 4 && (
                  <Collapsible open={isLifecycleOpen} onOpenChange={setIsLifecycleOpen}>
                    <CollapsibleContent>
                      <div className="grid gap-4 md:grid-cols-2 mb-4">
                        {lifecycleAnalysis.slice(4).map((tag) => (
                          <LifecycleTagCard key={tag.id} tag={tag} />
                        ))}
                      </div>
                    </CollapsibleContent>
                    <CollapsibleTrigger asChild>
                      <button className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed py-2 text-sm text-muted-foreground hover:bg-muted/50 transition-colors">
                        <ChevronDown className={cn(
                          "size-4 transition-transform duration-200",
                          isLifecycleOpen && "rotate-180"
                        )} />
                        {isLifecycleOpen ? "收起" : `顯示更多 (${lifecycleAnalysis.length - 4})`}
                      </button>
                    </CollapsibleTrigger>
                  </Collapsible>
                )}

                {/* 圖例說明 */}
                <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
                  <div className="mb-2 font-medium text-foreground">類型說明</div>
                  <div className="grid gap-2 md:grid-cols-3">
                    <div className="flex items-center gap-1"><Zap className="size-4 text-orange-500" /> <strong>病毒型</strong>：前 24h 曝光佔比 &gt; 70%</div>
                    <div className="flex items-center gap-1"><TrendingUp className="size-4 text-green-500" /> <strong>長青型</strong>：第 3-7 天曝光佔比 &gt; 30%</div>
                    <div className="flex items-center gap-1"><BarChart2 className="size-4 text-gray-500" /> <strong>一般型</strong>：其他</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex h-48 flex-col items-center justify-center gap-2 text-muted-foreground">
                <p>沒有標籤生命週期數據</p>
                <p className="text-sm">請先為貼文設定標籤，系統會自動追蹤各類型內容的曝光變化</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 曝光效率指標 */}
      {selectedAccountId && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="size-4" />
                平均每篇曝光數
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isHeatmapLoading ? (
                <Skeleton className="h-12 w-32" />
              ) : efficiencyStats ? (
                <div>
                  <div className="text-3xl font-bold">
                    {formatNumber(efficiencyStats.avgViewsPerPost)}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {getDateRange(period, offset).label} {efficiencyStats.totalPosts} 篇貼文
                  </p>
                </div>
              ) : (
                <div className="text-muted-foreground">無數據</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="size-4" />
                曝光/粉絲比
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isHeatmapLoading ? (
                <Skeleton className="h-12 w-32" />
              ) : efficiencyStats ? (
                <div>
                  <div className="text-3xl font-bold">
                    {efficiencyStats.viewsPerFollower.toFixed(1)}x
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {formatNumber(efficiencyStats.followersCount)} 粉絲
                  </p>
                </div>
              ) : (
                <div className="text-muted-foreground">無數據</div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* 最佳發文時段 + 異常提醒 */}
      {selectedAccountId && (
        <div className="flex flex-col gap-4 md:flex-row">
          {/* 最佳發文時段熱力圖 */}
          <Card className="md:w-1/2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="size-5" />
                最佳發文時段
              </CardTitle>
              <CardDescription>
                顏色越深表示該時段發文平均曝光越高
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isHeatmapLoading ? (
                <Skeleton className="h-[180px] w-full" />
              ) : heatmapData.length > 0 ? (
                <div className="space-y-3">
                  {/* 熱力圖 */}
                  <div className="overflow-x-auto">
                    <div className="min-w-[320px]">
                      {/* 時段標題（只顯示部分小時以避免太擁擠） */}
                      <div className="mb-1.5 flex">
                        <div className="w-10" /> {/* 空白對齊 */}
                        {HOUR_LABELS_24.map((hour) => (
                          <div
                            key={hour}
                            className="flex-1 text-center text-xs text-muted-foreground"
                          >
                            {hour % 6 === 0 ? hour : ""}
                          </div>
                        ))}
                      </div>

                      {/* 熱力圖格子 */}
                      {[1, 2, 3, 4, 5, 6, 0].map((dayOfWeek) => (
                        <div key={dayOfWeek} className="mb-1 flex items-center">
                          <div className="w-10 text-xs text-muted-foreground">
                            {WEEKDAY_NAMES[dayOfWeek]}
                          </div>
                          {HOUR_LABELS_24.map((hour) => {
                            const cell = heatmapData.find(
                              (d) => d.dayOfWeek === dayOfWeek && d.hour === hour
                            );
                            const avgViews = cell?.avgViews || 0;
                            const postCount = cell?.postCount || 0;

                            return (
                              <div
                                key={hour}
                                className="group relative flex-1 p-px"
                              >
                                <div
                                  className={cn(
                                    "aspect-square rounded-sm transition-transform hover:scale-125",
                                    getHeatmapColor(avgViews, maxHeatmapViews)
                                  )}
                                />
                                {/* Tooltip */}
                                <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 rounded border bg-background px-3 py-2 shadow-lg group-hover:block">
                                  <div className="whitespace-nowrap text-sm font-medium">
                                    {WEEKDAY_NAMES[dayOfWeek]} {hour}:00
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    平均 {formatNumber(avgViews)} 曝光
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {postCount} 篇貼文
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 圖例 */}
                  <div className="flex items-center justify-end gap-2">
                    <span className="text-xs text-muted-foreground">低</span>
                    <div className="flex gap-1">
                      <div className="size-4 rounded-sm bg-muted" />
                      <div className="size-4 rounded-sm bg-teal-200" />
                      <div className="size-4 rounded-sm bg-teal-300" />
                      <div className="size-4 rounded-sm bg-teal-400" />
                      <div className="size-4 rounded-sm bg-teal-500" />
                    </div>
                    <span className="text-xs text-muted-foreground">高</span>
                  </div>
                </div>
              ) : (
                <div className="flex h-[180px] items-center justify-center text-sm text-muted-foreground">
                  沒有足夠的發文數據
                </div>
              )}
            </CardContent>
          </Card>

          {/* 異常提醒 */}
          {anomalies.length > 0 && (
            <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20 md:w-1/2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="size-5 text-amber-600" />
                  異常提醒
                </CardTitle>
                <CardDescription>
                  {getDateRange(period, offset).label}表現異常的貼文
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {anomalies.map((anomaly) => (
                    <div
                      key={anomaly.postId}
                      className="flex items-center gap-3 rounded-lg border bg-background p-3"
                    >
                      {anomaly.type === "viral" ? (
                        <Flame className="size-5 shrink-0 text-orange-500" />
                      ) : (
                        <Snowflake className="size-5 shrink-0 text-blue-500" />
                      )}
                      <span
                        className={cn(
                          "shrink-0 rounded px-2 py-0.5 text-sm font-medium",
                          anomaly.type === "viral"
                            ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                            : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                        )}
                      >
                        {anomaly.type === "viral" ? "爆文" : "低迷"}
                      </span>
                      <span className="shrink-0 text-sm font-medium">
                        {formatNumber(anomaly.views)}
                      </span>
                      <span className="shrink-0 text-sm text-muted-foreground">
                        ({anomaly.ratio.toFixed(1)}x)
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                        {truncateText(anomaly.postText, 20)}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0"
                        onClick={() => {
                          setSelectedPostId(anomaly.postId);
                          setIsPanelOpen(true);
                        }}
                      >
                        <PanelRightOpen className="size-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Top/Flop 榜 */}
      {selectedAccountId && (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Top 5 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="size-5 text-amber-500" />
                曝光 Top 5
              </CardTitle>
              <CardDescription>
                {getDateRange(period, offset).label}曝光數最高的貼文
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isRankingLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full" />
                  ))}
                </div>
              ) : topPosts.length > 0 ? (
                <div className="space-y-2">
                  {topPosts.map((post, index) => (
                    <div
                      key={post.id}
                      className="flex items-center gap-3 rounded-lg border p-3"
                    >
                      <div
                        className={cn(
                          "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                          index === 0
                            ? "bg-amber-500 text-white"
                            : index === 1
                              ? "bg-gray-400 text-white"
                              : index === 2
                                ? "bg-amber-700 text-white"
                                : "bg-muted text-muted-foreground"
                        )}
                      >
                        {index + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm">
                          {truncateText(post.text, 20)}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-sm font-medium text-green-600">
                          {formatNumber(post.views)}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0"
                        onClick={() => {
                          setSelectedPostId(post.id);
                          setIsPanelOpen(true);
                        }}
                      >
                        <PanelRightOpen className="size-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex h-[200px] items-center justify-center text-muted-foreground">
                  沒有貼文數據
                </div>
              )}
            </CardContent>
          </Card>

          {/* Flop 5 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="size-5 text-red-500" />
                曝光 Flop 5
              </CardTitle>
              <CardDescription>
                {getDateRange(period, offset).label}曝光數最低的貼文
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isRankingLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full" />
                  ))}
                </div>
              ) : flopPosts.length > 0 ? (
                <div className="space-y-2">
                  {flopPosts.map((post, index) => (
                    <div
                      key={post.id}
                      className="flex items-center gap-3 rounded-lg border p-3"
                    >
                      <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
                        {index + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm">
                          {truncateText(post.text, 20)}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-sm font-medium text-red-600">
                          {formatNumber(post.views)}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0"
                        onClick={() => {
                          setSelectedPostId(post.id);
                          setIsPanelOpen(true);
                        }}
                      >
                        <PanelRightOpen className="size-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex h-[200px] items-center justify-center text-muted-foreground">
                  沒有貼文數據
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* 貼文詳情 Panel */}
      <PostDetailPanel
        open={isPanelOpen}
        onOpenChange={setIsPanelOpen}
        postId={selectedPostId}
      />
    </div>
  );
}
