"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { TrendingUp, TrendingDown, Eye, Activity, Clock, BarChart3, Users, Trophy, AlertTriangle, Flame, Snowflake, ChevronDown, ChevronLeft, ChevronRight, Zap, Rocket, Scale, BarChart2, PanelRightOpen, Lightbulb, Target, Sparkles, CheckCircle2, FileText } from "lucide-react";
import { XAxis, YAxis, CartesianGrid, Area, AreaChart, Tooltip, BarChart, Bar, Cell, LabelList } from "recharts";
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
type ViewMode = "report" | "insights";

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

function KPICard({
  title,
  value,
  growth,
  icon,
  isLoading,
  format = "number",
  periodLabel,
  suffix,
}: {
  title: string;
  value: number;
  growth?: number;
  icon: React.ReactNode;
  isLoading?: boolean;
  format?: "number" | "multiplier";
  periodLabel: string;
  suffix?: string;
}) {
  const formatValue = (v: number) => {
    if (format === "multiplier") return `${v.toFixed(1)}x`;
    return formatNumber(v);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="size-4" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-24" />
          <Skeleton className="mt-1 h-3 w-16" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {formatValue(value)}{suffix && <span className="text-base font-normal text-muted-foreground ml-1">{suffix}</span>}
        </div>
        {growth !== undefined && (
          <div className="flex items-center gap-1">
            <GrowthBadge value={growth} />
            {growth !== 0 && (
              <span className="text-xs text-muted-foreground">vs {periodLabel}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
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

/**
 * 格式化日期為 YYYY-MM-DD（本地時區）
 * 避免 toISOString() 轉換為 UTC 造成日期偏移
 */
function formatDateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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
  const [viewMode, setViewMode] = useState<ViewMode>("report");
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
          .gte("bucket_date", formatDateLocal(queryStart))
          .lte("bucket_date", formatDateLocal(currentEnd))
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
          .gte("bucket_date", formatDateLocal(previousQueryStart))
          .lte("bucket_date", formatDateLocal(previousEnd))
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
            dailyDeltaMap.set(formatDateLocal(d), 0);
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

            // 預先計算日期字串，用於比較（避免 Date 物件時區問題）
            const startDateStr = formatDateLocal(startDate);
            const endDateStr = formatDateLocal(endDate);

            for (let i = 0; i < records.length; i++) {
              const current = records[i];
              const prev = i > 0 ? records[i - 1] : null;

              // 只計算在目標範圍內的日期（使用字串比較避免時區問題）
              const currentDateStr = current.date;
              if (currentDateStr < startDateStr || currentDateStr > endDateStr) continue;

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

      {/* View Mode Tabs - 報告/洞察切換 */}
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
        <TabsList className="h-10 border bg-muted/50 p-1">
          <TabsTrigger value="report" className="h-8 px-4 data-[state=active]:bg-background data-[state=active]:shadow">
            <BarChart3 className="mr-1.5 size-4" />
            報告
          </TabsTrigger>
          <TabsTrigger value="insights" className="h-8 px-4 data-[state=active]:bg-background data-[state=active]:shadow">
            <Lightbulb className="mr-1.5 size-4" />
            洞察
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* 未選擇帳號提示 */}
      {!selectedAccountId && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            請先在左側選單選擇一個 Threads 帳號
          </CardContent>
        </Card>
      )}

      {/* ============================================================ */}
      {/* 報告 Tab - 基本圖表 */}
      {/* ============================================================ */}
      {selectedAccountId && viewMode === "report" && (
        <>
          {/* 曝光趨勢圖 */}
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

          {/* KPI 卡片區 */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <KPICard
              title="總曝光數"
              value={viewsStats?.totalViews || 0}
              growth={viewsStats?.growthRate}
              icon={<Eye className="size-4" />}
              isLoading={isLoading}
              periodLabel={period === "week" ? "上週" : "上月"}
            />
            <KPICard
              title="曝光/粉絲比"
              value={efficiencyStats?.viewsPerFollower || 0}
              icon={<Users className="size-4" />}
              isLoading={isHeatmapLoading}
              format="multiplier"
              periodLabel={period === "week" ? "上週" : "上月"}
            />
            <KPICard
              title="平均每篇曝光"
              value={efficiencyStats?.avgViewsPerPost || 0}
              icon={<BarChart3 className="size-4" />}
              isLoading={isHeatmapLoading}
              periodLabel={period === "week" ? "上週" : "上月"}
            />
            <KPICard
              title="貼文數"
              value={efficiencyStats?.totalPosts || 0}
              icon={<FileText className="size-4" />}
              isLoading={isHeatmapLoading}
              periodLabel={period === "week" ? "上週" : "上月"}
            />
          </div>

          {/* 最佳發文時段熱力圖 */}
          <Card>
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
                  <div className="overflow-visible">
                    <div className="min-w-[320px]">
                      {/* 時段標題 */}
                      <div className="mb-1.5 flex">
                        <div className="w-10" />
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
                                    "aspect-square rounded-sm transition-transform hover:scale-125 hover:z-10",
                                    getHeatmapColor(avgViews, maxHeatmapViews)
                                  )}
                                />
                                {/* Tooltip */}
                                <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 hidden -translate-x-1/2 rounded border bg-background px-3 py-2 shadow-lg group-hover:block">
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

          {/* 標籤曝光效果圖 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="size-5" />
                標籤曝光效率
              </CardTitle>
              <CardDescription>各標籤的平均曝光數對比</CardDescription>
            </CardHeader>
            <CardContent>
              {isLifecycleLoading ? (
                <Skeleton className="h-[200px] w-full" />
              ) : lifecycleAnalysis.length > 0 ? (
                <ChartContainer
                  config={{ avgViews: { label: "平均曝光", color: "#14B8A6" } }}
                  className="h-[200px] w-full"
                >
                  <BarChart
                    data={[...lifecycleAnalysis].sort((a, b) => b.avgViewsPerPost - a.avgViewsPerPost).slice(0, 6)}
                    layout="vertical"
                    margin={{ left: 0, right: 60 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis
                      type="number"
                      tickLine={false}
                      axisLine={false}
                      fontSize={10}
                      tickFormatter={(v) => formatNumber(v)}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tickLine={false}
                      axisLine={false}
                      width={80}
                      fontSize={10}
                    />
                    <ChartTooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.[0]) return null;
                        const item = payload[0].payload as TagLifecycleAnalysis;
                        return (
                          <div className="rounded-lg border bg-background p-2 shadow-lg text-xs">
                            <div className="font-medium mb-1">{item.name}</div>
                            <div className="space-y-0.5">
                              <div className="flex justify-between gap-4">
                                <span className="text-muted-foreground">貼文數</span>
                                <span>{item.postCount} 篇</span>
                              </div>
                              <div className="flex justify-between gap-4">
                                <span className="text-muted-foreground">平均曝光</span>
                                <span>{formatNumber(item.avgViewsPerPost)}</span>
                              </div>
                              <div className="flex justify-between gap-4">
                                <span className="text-muted-foreground">類型</span>
                                <span>
                                  {item.lifecycleType === "viral" ? "病毒型" :
                                   item.lifecycleType === "evergreen" ? "長青型" : "一般型"}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="avgViewsPerPost" radius={[0, 4, 4, 0]}>
                      {[...lifecycleAnalysis]
                        .sort((a, b) => b.avgViewsPerPost - a.avgViewsPerPost)
                        .slice(0, 6)
                        .map((item) => (
                          <Cell key={item.id} fill={item.color} />
                        ))}
                      <LabelList
                        dataKey="avgViewsPerPost"
                        position="right"
                        formatter={(v: number) => formatNumber(v)}
                        fontSize={10}
                        className="fill-foreground"
                      />
                    </Bar>
                  </BarChart>
                </ChartContainer>
              ) : (
                <div className="flex h-[200px] items-center justify-center text-muted-foreground">
                  尚無已標籤的貼文
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top/Flop 榜 */}
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
        </>
      )}

      {/* ============================================================ */}
      {/* 洞察 Tab - 深度分析 */}
      {/* ============================================================ */}
      {selectedAccountId && viewMode === "insights" && (
        <div className="space-y-6">
          {/* 區塊 1：曝光效率分數 */}
          <ReachEfficiencyBlock
            efficiencyStats={efficiencyStats}
            viewsStats={viewsStats}
            isLoading={isLoading || isHeatmapLoading}
            period={period}
            offset={offset}
          />

          {/* 區塊 2：內容生命週期策略 */}
          <ContentStrategyBlock
            lifecycleAnalysis={lifecycleAnalysis}
            isLoading={isLifecycleLoading}
          />

          {/* 區塊 3：演算法推薦分析 */}
          <AlgorithmAnalysisBlock
            efficiencyStats={efficiencyStats}
            topPosts={topPosts}
            isLoading={isLoading || isHeatmapLoading || isRankingLoading}
          />

          {/* 區塊 4：最佳發文策略 */}
          <PostingStrategyBlock
            heatmapData={heatmapData}
            lifecycleAnalysis={lifecycleAnalysis}
            isLoading={isHeatmapLoading || isLifecycleLoading}
          />

          {/* 區塊 5：行動建議 */}
          <ActionSuggestionsBlock
            efficiencyStats={efficiencyStats}
            lifecycleAnalysis={lifecycleAnalysis}
            heatmapData={heatmapData}
            viewsStats={viewsStats}
            isLoading={isLoading || isHeatmapLoading || isLifecycleLoading}
          />
        </div>
      )}

      {/* 貼文詳情 Panel */}
      <PostDetailPanel
        open={isPanelOpen}
        onOpenChange={setIsPanelOpen}
        postId={selectedPostId}
        selectedAccountId={selectedAccountId}
      />
    </div>
  );
}

// ============================================================================
// Insights Tab Components (洞察分析)
// ============================================================================

function ReachEfficiencyBlock({
  efficiencyStats,
  viewsStats,
  isLoading,
  period,
  offset,
}: {
  efficiencyStats: EfficiencyStats | null;
  viewsStats: ViewsStats | null;
  isLoading: boolean;
  period: Period;
  offset: number;
}) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-5 w-40" /></CardHeader>
        <CardContent><Skeleton className="h-[200px] w-full" /></CardContent>
      </Card>
    );
  }

  if (!efficiencyStats) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="size-5 text-teal-600" />
            曝光效率
          </CardTitle>
          <CardDescription>我的內容觸及效率如何？</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-[180px] items-center justify-center text-muted-foreground">
            尚無曝光資料
          </div>
        </CardContent>
      </Card>
    );
  }

  const reachMultiplier = efficiencyStats.viewsPerFollower;

  // 評級
  let rating: { label: string; color: string; description: string };
  if (reachMultiplier >= 5) {
    rating = { label: "優秀", color: "text-green-600", description: "演算法大力推薦" };
  } else if (reachMultiplier >= 2) {
    rating = { label: "良好", color: "text-teal-600", description: "有推薦流量" };
  } else if (reachMultiplier >= 1) {
    rating = { label: "正常", color: "text-amber-600", description: "粉絲基本都能看到" };
  } else {
    rating = { label: "受限", color: "text-red-600", description: "只有部分粉絲看到" };
  }

  // 建議
  const suggestions: string[] = [];
  if (reachMultiplier < 1) {
    suggestions.push("觸及率偏低，建議提升內容品質或增加互動");
  }
  if (viewsStats && viewsStats.growthRate < -10) {
    suggestions.push("觸及率正在下降，檢視最近內容是否有變化");
  }
  if (viewsStats && viewsStats.growthRate > 10) {
    suggestions.push("觸及率提升中，保持目前策略");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="size-5 text-teal-600" />
          曝光效率
        </CardTitle>
        <CardDescription>我的內容觸及效率如何？</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-6">
          {/* 左側：觸及倍數 */}
          <div className="flex flex-col items-center justify-center rounded-lg bg-muted/50 p-6">
            <div className="text-4xl font-bold">{reachMultiplier.toFixed(1)}x</div>
            <div className="text-sm text-muted-foreground">觸及倍數</div>
            <div className={cn("mt-1 text-sm font-medium", rating.color)}>
              {rating.label}
            </div>
          </div>

          {/* 右側：評級說明 */}
          <div className="flex-1 space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">
                你的貼文平均被 <span className="font-medium text-foreground">{reachMultiplier.toFixed(1)} 倍</span>粉絲數看到
              </p>
              <p className="text-sm text-muted-foreground mt-1">{rating.description}</p>
            </div>

            {/* 評級參考 */}
            <div className="rounded-lg border p-3 space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">評級參考</p>
              <div className="grid grid-cols-2 gap-1 text-xs">
                <div className={reachMultiplier < 1 ? "font-medium text-foreground" : "text-muted-foreground"}>
                  {"< 1x"} 觸及受限
                </div>
                <div className={reachMultiplier >= 1 && reachMultiplier < 2 ? "font-medium text-foreground" : "text-muted-foreground"}>
                  1-2x 觸及正常
                </div>
                <div className={reachMultiplier >= 2 && reachMultiplier < 5 ? "font-medium text-foreground" : "text-muted-foreground"}>
                  2-5x 觸及良好
                </div>
                <div className={reachMultiplier >= 5 ? "font-medium text-foreground" : "text-muted-foreground"}>
                  {"> 5x"} 演算法推薦
                </div>
              </div>
            </div>

            {/* 成長趨勢 */}
            {viewsStats && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">vs {getDateRange(period, offset - 1).label}：</span>
                <GrowthBadge value={viewsStats.growthRate} />
              </div>
            )}
          </div>
        </div>

        {/* 建議 */}
        {suggestions.length > 0 && (
          <div className="mt-4 flex items-start gap-3 rounded-lg border border-teal-200 bg-teal-50 p-3 dark:border-teal-800 dark:bg-teal-950/30">
            <Lightbulb className="mt-0.5 size-4 shrink-0 text-teal-600" />
            <div className="text-sm">
              <p className="font-medium text-foreground">{suggestions[0]}</p>
              {suggestions.length > 1 && (
                <p className="mt-1 text-muted-foreground">{suggestions.slice(1).join("、")}</p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ContentStrategyBlock({
  lifecycleAnalysis,
  isLoading,
}: {
  lifecycleAnalysis: TagLifecycleAnalysis[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-5 w-40" /></CardHeader>
        <CardContent><Skeleton className="h-[200px] w-full" /></CardContent>
      </Card>
    );
  }

  if (lifecycleAnalysis.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="size-5 text-teal-600" />
            我應該專注什麼類型的內容？
          </CardTitle>
          <CardDescription>分析你的內容策略效果</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-[180px] items-center justify-center text-muted-foreground">
            請先為貼文設定標籤以分析內容策略
          </div>
        </CardContent>
      </Card>
    );
  }

  // 統計各類型
  const viralTags = lifecycleAnalysis.filter(t => t.lifecycleType === "viral");
  const evergreenTags = lifecycleAnalysis.filter(t => t.lifecycleType === "evergreen");
  const normalTags = lifecycleAnalysis.filter(t => t.lifecycleType === "normal");

  // 計算各類型總曝光
  const viralViews = viralTags.reduce((sum, t) => sum + t.avgViewsPerPost * t.postCount, 0);
  const evergreenViews = evergreenTags.reduce((sum, t) => sum + t.avgViewsPerPost * t.postCount, 0);
  const normalViews = normalTags.reduce((sum, t) => sum + t.avgViewsPerPost * t.postCount, 0);
  const totalViews = viralViews + evergreenViews + normalViews;

  const viralRatio = totalViews > 0 ? (viralViews / totalViews) * 100 : 0;
  const evergreenRatio = totalViews > 0 ? (evergreenViews / totalViews) * 100 : 0;

  // 計算各類型平均曝光
  const viralPostCount = viralTags.reduce((sum, t) => sum + t.postCount, 0);
  const evergreenPostCount = evergreenTags.reduce((sum, t) => sum + t.postCount, 0);
  const viralAvg = viralPostCount > 0 ? Math.round(viralViews / viralPostCount) : 0;
  const evergreenAvg = evergreenPostCount > 0 ? Math.round(evergreenViews / evergreenPostCount) : 0;

  // 建議
  let suggestion = "";
  if (viralRatio > 70) {
    suggestion = "你的內容偏向病毒型，曝光集中在前 24 小時。建議增加長青型內容（教學、實用資訊）以維持持續流量。";
  } else if (evergreenRatio > 50) {
    suggestion = "你的長青型內容表現良好，持續帶來穩定曝光。可維持目前策略，適時搭配時事內容提升爆發力。";
  } else {
    suggestion = "你的內容策略較均衡。建議根據目標調整：追求爆發選病毒型，追求穩定選長青型。";
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="size-5 text-teal-600" />
          我應該專注什麼類型的內容？
        </CardTitle>
        <CardDescription>分析你的內容策略效果</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          {/* 病毒型 */}
          <div className="rounded-lg border p-4">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="size-5 text-orange-500" />
              <span className="font-medium">病毒型內容</span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">佔比</span>
                <span className="font-medium">{viralRatio.toFixed(0)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">平均曝光</span>
                <span className="font-medium">{formatNumber(viralAvg)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">特點</span>
                <span>爆發力強，衰退快</span>
              </div>
            </div>
          </div>

          {/* 長青型 */}
          <div className="rounded-lg border p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="size-5 text-green-500" />
              <span className="font-medium">長青型內容</span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">佔比</span>
                <span className="font-medium">{evergreenRatio.toFixed(0)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">平均曝光</span>
                <span className="font-medium">{formatNumber(evergreenAvg)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">特點</span>
                <span>持續帶來流量</span>
              </div>
            </div>
          </div>
        </div>

        {/* 建議 */}
        <div className="mt-4 flex items-start gap-3 rounded-lg border border-teal-200 bg-teal-50 p-3 dark:border-teal-800 dark:bg-teal-950/30">
          <Lightbulb className="mt-0.5 size-4 shrink-0 text-teal-600" />
          <div className="text-sm">
            <p className="text-foreground">{suggestion}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AlgorithmAnalysisBlock({
  efficiencyStats,
  topPosts,
  isLoading,
}: {
  efficiencyStats: EfficiencyStats | null;
  topPosts: RankedPost[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-5 w-40" /></CardHeader>
        <CardContent><Skeleton className="h-[200px] w-full" /></CardContent>
      </Card>
    );
  }

  if (!efficiencyStats || efficiencyStats.followersCount === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-teal-600" />
            演算法有在推薦我的內容嗎？
          </CardTitle>
          <CardDescription>分析你的推薦流量比例</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-[180px] items-center justify-center text-muted-foreground">
            尚無足夠數據
          </div>
        </CardContent>
      </Card>
    );
  }

  // 估算推薦流量比例
  // 假設：總曝光中超過粉絲數的部分來自推薦
  const totalViews = efficiencyStats.avgViewsPerPost * efficiencyStats.totalPosts;
  const ownReach = Math.min(totalViews, efficiencyStats.followersCount * efficiencyStats.totalPosts);
  const recommendedReach = Math.max(0, totalViews - ownReach);
  const recommendRatio = totalViews > 0 ? (recommendedReach / totalViews) * 100 : 0;
  const ownRatio = 100 - recommendRatio;

  // 分析高推薦率貼文特徵
  const avgViews = efficiencyStats.avgViewsPerPost;
  const highPerformPosts = topPosts.filter(p => p.views > avgViews * 1.5);

  // 建議
  let suggestion = "";
  if (recommendRatio > 50) {
    suggestion = "演算法正在積極推薦你的內容給非粉絲，保持目前的內容策略。";
  } else if (recommendRatio > 20) {
    suggestion = "你有一定的推薦流量，可嘗試更多互動式或爭議性內容來提升推薦率。";
  } else {
    suggestion = "你的內容主要觸及自有粉絲，建議嘗試問題式或爭議性內容來獲得演算法推薦。";
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-5 text-teal-600" />
          演算法有在推薦我的內容嗎？
        </CardTitle>
        <CardDescription>分析你的推薦流量比例</CardDescription>
      </CardHeader>
      <CardContent>
        {/* 推薦流量比例 */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2 text-sm">
            <span>自有觸及（粉絲）</span>
            <span>推薦觸及（非粉絲）</span>
          </div>
          <div className="flex h-6 overflow-hidden rounded-full">
            <div
              className="bg-teal-300 flex items-center justify-center text-xs font-medium"
              style={{ width: `${ownRatio}%` }}
            >
              {ownRatio > 20 && `${ownRatio.toFixed(0)}%`}
            </div>
            <div
              className="bg-teal-600 flex items-center justify-center text-xs font-medium text-white"
              style={{ width: `${recommendRatio}%` }}
            >
              {recommendRatio > 20 && `${recommendRatio.toFixed(0)}%`}
            </div>
          </div>
        </div>

        {/* 高推薦率貼文特徵 */}
        {highPerformPosts.length > 0 && (
          <div className="rounded-lg border p-3 mb-4">
            <p className="text-sm font-medium mb-2">高推薦率貼文特徵</p>
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>• 你有 {highPerformPosts.length} 篇貼文獲得高於平均的推薦</p>
              <p>• 這些貼文的平均曝光是一般貼文的 {((highPerformPosts.reduce((s, p) => s + p.views, 0) / highPerformPosts.length) / avgViews).toFixed(1)} 倍</p>
            </div>
          </div>
        )}

        {/* 建議 */}
        <div className="flex items-start gap-3 rounded-lg border border-teal-200 bg-teal-50 p-3 dark:border-teal-800 dark:bg-teal-950/30">
          <Lightbulb className="mt-0.5 size-4 shrink-0 text-teal-600" />
          <div className="text-sm">
            <p className="text-foreground">{suggestion}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PostingStrategyBlock({
  heatmapData,
  lifecycleAnalysis,
  isLoading,
}: {
  heatmapData: HeatmapCell[];
  lifecycleAnalysis: TagLifecycleAnalysis[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-5 w-40" /></CardHeader>
        <CardContent><Skeleton className="h-[200px] w-full" /></CardContent>
      </Card>
    );
  }

  if (heatmapData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="size-5 text-teal-600" />
            什麼時候發什麼內容最有效？
          </CardTitle>
          <CardDescription>找出你的最佳發文組合</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-[180px] items-center justify-center text-muted-foreground">
            尚無足夠數據
          </div>
        </CardContent>
      </Card>
    );
  }

  // 找出最佳時段
  const sortedSlots = [...heatmapData]
    .filter(d => d.postCount > 0)
    .sort((a, b) => b.avgViews - a.avgViews)
    .slice(0, 3);

  // 找出最佳內容類型
  const sortedTags = [...lifecycleAnalysis]
    .sort((a, b) => b.avgViewsPerPost - a.avgViewsPerPost)
    .slice(0, 3);

  // 最佳組合
  const bestSlot = sortedSlots[0];
  const bestTag = sortedTags[0];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="size-5 text-teal-600" />
          什麼時候發什麼內容最有效？
        </CardTitle>
        <CardDescription>找出你的最佳發文組合</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          {/* 最佳發文時段 */}
          <div className="rounded-lg border p-4">
            <p className="text-sm font-medium mb-3">最佳發文時段</p>
            <div className="space-y-2">
              {sortedSlots.map((slot, index) => (
                <div key={`${slot.dayOfWeek}-${slot.hour}`} className="flex items-center justify-between text-sm">
                  <span>
                    {index + 1}. {WEEKDAY_NAMES[slot.dayOfWeek]} {slot.hour}:00
                  </span>
                  <span className="font-medium text-teal-600">
                    平均 {formatNumber(slot.avgViews)} 曝光
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 最佳內容類型 */}
          <div className="rounded-lg border p-4">
            <p className="text-sm font-medium mb-3">最佳內容類型</p>
            {sortedTags.length > 0 ? (
              <div className="space-y-2">
                {sortedTags.map((tag, index) => (
                  <div key={tag.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div
                        className="size-3 rounded-full"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span>{index + 1}. {tag.name}</span>
                    </div>
                    <span className="font-medium text-teal-600">
                      {formatNumber(tag.avgViewsPerPost)} 曝光
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">請先設定標籤</p>
            )}
          </div>
        </div>

        {/* 最佳組合建議 */}
        {bestSlot && bestTag && (
          <div className="mt-4 flex items-start gap-3 rounded-lg border border-teal-200 bg-teal-50 p-3 dark:border-teal-800 dark:bg-teal-950/30">
            <Lightbulb className="mt-0.5 size-4 shrink-0 text-teal-600" />
            <div className="text-sm">
              <p className="font-medium text-foreground">最佳組合</p>
              <p className="mt-1 text-muted-foreground">
                在 <span className="font-medium text-foreground">{WEEKDAY_NAMES[bestSlot.dayOfWeek]} {bestSlot.hour}:00</span> 發布
                「<span className="font-medium text-foreground">{bestTag.name}</span>」類內容，預期可獲得最高曝光
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ActionSuggestionsBlock({
  efficiencyStats,
  lifecycleAnalysis,
  heatmapData,
  viewsStats,
  isLoading,
}: {
  efficiencyStats: EfficiencyStats | null;
  lifecycleAnalysis: TagLifecycleAnalysis[];
  heatmapData: HeatmapCell[];
  viewsStats: ViewsStats | null;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-5 w-40" /></CardHeader>
        <CardContent><Skeleton className="h-[200px] w-full" /></CardContent>
      </Card>
    );
  }

  const suggestions: { title: string; reason: string; action: string; priority: "high" | "medium" | "low" }[] = [];

  // 1. 觸及倍數建議
  if (efficiencyStats) {
    if (efficiencyStats.viewsPerFollower < 1) {
      suggestions.push({
        title: "提升內容觸及率",
        reason: `你的觸及倍數只有 ${efficiencyStats.viewsPerFollower.toFixed(1)}x，低於平均水準`,
        action: "嘗試發布更多問題式或爭議性內容，增加互動率來提升演算法推薦",
        priority: "high",
      });
    }
  }

  // 2. 發文時間建議
  if (heatmapData.length > 0) {
    const bestSlot = [...heatmapData]
      .filter(d => d.postCount > 0)
      .sort((a, b) => b.avgViews - a.avgViews)[0];

    if (bestSlot) {
      suggestions.push({
        title: "調整發文時間",
        reason: `${WEEKDAY_NAMES[bestSlot.dayOfWeek]} ${bestSlot.hour}:00 是你的最佳發文時段`,
        action: `將主要發文時間調整到 ${WEEKDAY_NAMES[bestSlot.dayOfWeek]} ${bestSlot.hour}:00`,
        priority: "medium",
      });
    }
  }

  // 3. 內容類型建議
  if (lifecycleAnalysis.length > 0) {
    const bestTag = [...lifecycleAnalysis].sort((a, b) => b.avgViewsPerPost - a.avgViewsPerPost)[0];
    const totalPosts = lifecycleAnalysis.reduce((sum, t) => sum + t.postCount, 0);
    const bestTagRatio = (bestTag.postCount / totalPosts) * 100;

    if (bestTagRatio < 30) {
      suggestions.push({
        title: `增加「${bestTag.name}」類內容`,
        reason: `「${bestTag.name}」平均曝光最高，但只佔 ${bestTagRatio.toFixed(0)}% 發文`,
        action: `將「${bestTag.name}」類內容比例提高到 30%`,
        priority: "medium",
      });
    }
  }

  // 4. 成長趨勢建議
  if (viewsStats && viewsStats.growthRate < -20) {
    suggestions.push({
      title: "曝光下滑警示",
      reason: `本期曝光較上期下降 ${Math.abs(viewsStats.growthRate).toFixed(0)}%`,
      action: "檢視最近內容策略，嘗試新的內容形式或主題",
      priority: "high",
    });
  }

  if (suggestions.length === 0) {
    suggestions.push({
      title: "保持目前策略",
      reason: "你的曝光表現穩定",
      action: "持續目前的內容策略，可嘗試小幅度實驗新形式",
      priority: "low",
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle2 className="size-5 text-teal-600" />
          行動建議
        </CardTitle>
        <CardDescription>我現在該怎麼提升曝光？</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {suggestions.slice(0, 3).map((suggestion, index) => (
            <div key={index} className="rounded-lg border p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{suggestion.title}</p>
                    <span className={cn(
                      "rounded-full px-2 py-0.5 text-xs",
                      suggestion.priority === "high"
                        ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                        : suggestion.priority === "medium"
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                          : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
                    )}>
                      {suggestion.priority === "high" ? "高優先" : suggestion.priority === "medium" ? "中優先" : "低優先"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{suggestion.reason}</p>
                  <p className="mt-2 text-sm">
                    <span className="text-teal-600">✓</span> {suggestion.action}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
