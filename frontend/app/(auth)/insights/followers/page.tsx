"use client";

import { useState, useEffect } from "react";
import {
  Users,
  TrendingUp,
  Target,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import { createClient } from "@/lib/supabase/client";
import { useSelectedAccount } from "@/hooks/use-selected-account";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { KPICard, GrowthBadge } from "@/components/insights/shared-components";
import {
  type Period,
  formatNumber,
  formatDateLocal,
  getDateRange,
  calcGrowth,
} from "@/lib/insights-utils";
import { TEAL } from "@/lib/design-tokens";

// ============================================================================
// Types
// ============================================================================

interface DailyFollowerData {
  date: string;
  label: string;
  followers: number;
  growth: number;
}

interface FollowerStats {
  currentFollowers: number;
  periodGrowth: number;
  growthRate: number;
  avgDailyGrowth: number;
  dailyData: DailyFollowerData[];
}

interface MilestoneData {
  current: number;
  target: number;
  remaining: number;
  progress: number;
  estimatedDays: number | null;
  previousMilestone: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 取得下一個里程碑數字
 */
function getNextMilestone(current: number): number {
  const milestones = [
    100, 500, 1000, 2000, 5000,
    10000, 20000, 50000, 100000,
    200000, 500000, 1000000,
  ];
  return milestones.find((m) => m > current) || Math.ceil(current / 1000000) * 1000000 + 1000000;
}

/**
 * 取得前一個里程碑數字
 */
function getPreviousMilestone(current: number): number {
  const milestones = [
    0, 100, 500, 1000, 2000, 5000,
    10000, 20000, 50000, 100000,
    200000, 500000, 1000000,
  ];
  for (let i = milestones.length - 1; i >= 0; i--) {
    if (milestones[i] < current) {
      return milestones[i];
    }
  }
  return 0;
}

/**
 * 格式化里程碑數字
 */
function formatMilestone(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(0)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
  return value.toString();
}

// ============================================================================
// Chart Config
// ============================================================================

const chartConfig: ChartConfig = {
  followers: {
    label: "粉絲數",
    color: TEAL[500],
  },
};

// ============================================================================
// Main Component
// ============================================================================

export default function FollowersPage() {
  const { selectedAccountId } = useSelectedAccount();
  const [period, setPeriod] = useState<Period>("month");
  const [offset, setOffset] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [followerStats, setFollowerStats] = useState<FollowerStats | null>(null);
  const [milestoneData, setMilestoneData] = useState<MilestoneData | null>(null);

  // 載入粉絲成長資料
  useEffect(() => {
    if (!selectedAccountId) {
      setIsLoading(false);
      setFollowerStats(null);
      setMilestoneData(null);
      return;
    }

    async function fetchFollowerData() {
      setIsLoading(true);
      try {
        const supabase = createClient();

        // 取得時間範圍
        const currentRange = getDateRange(period, offset);
        const previousRange = getDateRange(period, offset - 1);

        // 為了計算期初值，需要查詢比開始日期更早一天的資料
        const queryStart = new Date(currentRange.start);
        queryStart.setDate(queryStart.getDate() - 1);

        // 查詢當前期間的 L1 快照
        const { data: currentData, error: currentError } = await supabase
          .from("workspace_threads_account_insights")
          .select("followers_count, sync_batch_at")
          .eq("workspace_threads_account_id", selectedAccountId)
          .gte("sync_batch_at", queryStart.toISOString())
          .lte("sync_batch_at", currentRange.end.toISOString())
          .order("sync_batch_at", { ascending: true });

        if (currentError) {
          console.error("Error fetching follower data:", currentError);
          setFollowerStats(null);
          return;
        }

        // 查詢上一期間的資料（用於計算成長率）
        const previousQueryStart = new Date(previousRange.start);
        previousQueryStart.setDate(previousQueryStart.getDate() - 1);

        const { data: previousData, error: previousError } = await supabase
          .from("workspace_threads_account_insights")
          .select("followers_count, sync_batch_at")
          .eq("workspace_threads_account_id", selectedAccountId)
          .gte("sync_batch_at", previousQueryStart.toISOString())
          .lte("sync_batch_at", previousRange.end.toISOString())
          .order("sync_batch_at", { ascending: true });

        if (previousError) {
          console.error("Error fetching previous follower data:", previousError);
        }

        // 查詢當前粉絲數（L3）
        const { data: accountData } = await supabase
          .from("workspace_threads_accounts")
          .select("current_followers_count")
          .eq("id", selectedAccountId)
          .single();

        const currentFollowers = accountData?.current_followers_count || 0;

        // 處理當前期間資料：按日期分組，取每日最後一筆
        const dailyMap = new Map<string, number>();
        currentData?.forEach((row) => {
          const date = formatDateLocal(new Date(row.sync_batch_at));
          dailyMap.set(date, row.followers_count);
        });

        // 轉換為圖表數據
        const dailyData: DailyFollowerData[] = [];
        const sortedDates = Array.from(dailyMap.keys()).sort();

        // 只取目標期間內的日期
        const startDateStr = formatDateLocal(currentRange.start);
        const endDateStr = formatDateLocal(currentRange.end);

        let previousFollowerCount: number | null = null;

        sortedDates.forEach((date) => {
          const followers = dailyMap.get(date)!;

          // 記錄期初之前的資料作為基準
          if (date < startDateStr) {
            previousFollowerCount = followers;
            return;
          }

          // 只處理目標期間內的日期
          if (date > endDateStr) return;

          const d = new Date(date);
          const label = `${d.getMonth() + 1}/${d.getDate()}`;

          // 計算日增長
          const growth = previousFollowerCount !== null
            ? followers - previousFollowerCount
            : 0;

          dailyData.push({
            date,
            label,
            followers,
            growth,
          });

          previousFollowerCount = followers;
        });

        // 計算本期成長
        const periodStart = dailyData.length > 0 ? dailyData[0].followers : currentFollowers;
        const periodEnd = dailyData.length > 0 ? dailyData[dailyData.length - 1].followers : currentFollowers;
        const periodGrowth = periodEnd - periodStart;

        // 計算上期成長（用於計算成長率）
        const previousDailyMap = new Map<string, number>();
        previousData?.forEach((row) => {
          const date = formatDateLocal(new Date(row.sync_batch_at));
          previousDailyMap.set(date, row.followers_count);
        });

        const previousDates = Array.from(previousDailyMap.keys()).sort();
        const previousPeriodStart = previousDates.length > 0
          ? previousDailyMap.get(previousDates[0])!
          : 0;
        const previousPeriodEnd = previousDates.length > 0
          ? previousDailyMap.get(previousDates[previousDates.length - 1])!
          : 0;
        const previousPeriodGrowth = previousPeriodEnd - previousPeriodStart;

        // 計算成長率
        const growthRate = calcGrowth(periodGrowth, previousPeriodGrowth);

        // 計算平均日增長
        const dayCount = dailyData.length || 1;
        const avgDailyGrowth = periodGrowth / dayCount;

        setFollowerStats({
          currentFollowers,
          periodGrowth,
          growthRate,
          avgDailyGrowth,
          dailyData,
        });

        // 計算里程碑資料
        const target = getNextMilestone(currentFollowers);
        const previousMilestone = getPreviousMilestone(currentFollowers);
        const remaining = target - currentFollowers;
        const progress = ((currentFollowers - previousMilestone) / (target - previousMilestone)) * 100;
        const estimatedDays = avgDailyGrowth > 0
          ? Math.ceil(remaining / avgDailyGrowth)
          : null;

        setMilestoneData({
          current: currentFollowers,
          target,
          remaining,
          progress: Math.min(Math.max(progress, 0), 100),
          estimatedDays,
          previousMilestone,
        });

      } catch (error) {
        console.error("Error fetching follower data:", error);
        setFollowerStats(null);
        setMilestoneData(null);
      } finally {
        setIsLoading(false);
      }
    }

    fetchFollowerData();
  }, [selectedAccountId, period, offset]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">粉絲成長</h1>
          <p className="text-muted-foreground">
            追蹤粉絲數變化與成長趨勢
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* 週/月切換 */}
          <Tabs
            value={period}
            onValueChange={(v) => {
              setPeriod(v as Period);
              setOffset(0);
            }}
          >
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

      {selectedAccountId && (
        <>
          {/* KPI 卡片區 */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <KPICard
              title="累計粉絲"
              value={followerStats?.currentFollowers || 0}
              icon={<Users className="size-4" />}
              isLoading={isLoading}
              format="number"
              periodLabel={period === "week" ? "上週" : "上月"}
            />
            <KPICard
              title="本期成長"
              value={followerStats?.periodGrowth || 0}
              growth={followerStats?.growthRate}
              icon={<TrendingUp className="size-4" />}
              isLoading={isLoading}
              format="number"
              periodLabel={period === "week" ? "上週" : "上月"}
              suffix="人"
            />
            <KPICard
              title="成長率"
              value={followerStats?.growthRate || 0}
              icon={<Target className="size-4" />}
              isLoading={isLoading}
              format="percent"
              periodLabel={period === "week" ? "上週" : "上月"}
              hint={`vs ${period === "week" ? "上週" : "上月"}成長`}
            />
            <KPICard
              title="日均增長"
              value={followerStats?.avgDailyGrowth || 0}
              icon={<CalendarPlus className="size-4" />}
              isLoading={isLoading}
              format="number"
              periodLabel={period === "week" ? "上週" : "上月"}
              suffix="人/日"
            />
          </div>

          {/* 粉絲成長趨勢圖 */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="size-5" />
                    粉絲成長趨勢
                  </CardTitle>
                  <CardDescription>
                    {(() => {
                      const range = getDateRange(period, offset);
                      const startLabel = `${range.start.getMonth() + 1}/${range.start.getDate()}`;
                      const endLabel = `${range.end.getMonth() + 1}/${range.end.getDate()}`;
                      return `${startLabel} - ${endLabel} 每日粉絲數`;
                    })()}
                  </CardDescription>
                </div>
                {!isLoading && followerStats && followerStats.periodGrowth !== 0 && (
                  <div className="text-right">
                    <div className="text-2xl font-bold">
                      {followerStats.periodGrowth > 0 ? "+" : ""}
                      {formatNumber(followerStats.periodGrowth)}
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-sm text-muted-foreground">
                        vs {getDateRange(period, offset - 1).label}
                      </span>
                      <GrowthBadge value={followerStats.growthRate} />
                    </div>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-[300px] w-full" />
              ) : followerStats && followerStats.dailyData.length > 0 ? (
                <ChartContainer config={chartConfig} className="h-[300px] w-full">
                  <LineChart
                    data={followerStats.dailyData}
                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                  >
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
                      domain={["dataMin - 10", "dataMax + 10"]}
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(value, name, props) => {
                            const growth = props.payload?.growth;
                            return [
                              <span key="value">
                                {formatNumber(value as number)} 粉絲
                                {growth !== undefined && growth !== 0 && (
                                  <span className={growth > 0 ? "text-success" : "text-destructive"}>
                                    {" "}({growth > 0 ? "+" : ""}{growth})
                                  </span>
                                )}
                              </span>,
                              "",
                            ];
                          }}
                        />
                      }
                    />
                    <Line
                      type="monotone"
                      dataKey="followers"
                      stroke={TEAL[500]}
                      strokeWidth={2}
                      dot={{ fill: TEAL[500], strokeWidth: 0, r: 3 }}
                      activeDot={{ fill: TEAL[500], strokeWidth: 0, r: 5 }}
                    />
                  </LineChart>
                </ChartContainer>
              ) : (
                <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                  該期間內沒有粉絲數據
                </div>
              )}
            </CardContent>
          </Card>

          {/* 里程碑追蹤 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="size-5" />
                里程碑追蹤
              </CardTitle>
              <CardDescription>
                追蹤您的粉絲成長里程碑
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-6 w-40" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-60" />
                </div>
              ) : milestoneData ? (
                <div className="space-y-4">
                  {/* 目標顯示 */}
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-lg font-semibold">
                        目標：{formatMilestone(milestoneData.target)} 粉絲
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-bold text-primary">
                        {milestoneData.progress.toFixed(0)}%
                      </span>
                    </div>
                  </div>

                  {/* 進度條 */}
                  <div className="space-y-2">
                    <Progress value={milestoneData.progress} className="h-3" />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{formatMilestone(milestoneData.previousMilestone)}</span>
                      <span>{formatMilestone(milestoneData.target)}</span>
                    </div>
                  </div>

                  {/* 剩餘資訊 */}
                  <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">當前：</span>
                      <span className="font-medium">
                        {formatNumber(milestoneData.current)} 粉絲
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">還差：</span>
                      <span className="font-medium">
                        {formatNumber(milestoneData.remaining)} 位
                      </span>
                    </div>
                    {milestoneData.estimatedDays !== null && (
                      <div>
                        <span className="text-muted-foreground">預估達成：</span>
                        <span className="font-medium text-primary">
                          {milestoneData.estimatedDays} 天後
                        </span>
                      </div>
                    )}
                    {milestoneData.estimatedDays === null && followerStats && followerStats.avgDailyGrowth <= 0 && (
                      <div>
                        <span className="text-muted-foreground">預估達成：</span>
                        <span className="font-medium text-destructive">
                          需提升成長率
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex h-[100px] items-center justify-center text-muted-foreground">
                  無法計算里程碑資料
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
