"use client";

import { useEffect, useState } from "react";
import {
  Sparkles,
  Loader2,
  AlertCircle,
  Clock,
  History,
  ChevronDown,
  Calendar,
} from "lucide-react";
import { useSelectedAccount } from "@/hooks/use-selected-account";
import { useWeeklyReport } from "@/hooks/use-weekly-report";
import { useCurrentUser } from "@/hooks/use-current-user";
import { PageHeader } from "@/components/layout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  ExecutiveSummarySection,
  DataOverviewSection,
  ReachAnalysisSection,
  EngagementAnalysisSection,
  ViralityAnalysisSection,
  ContentStrategySection,
  TimingAnalysisSection,
  FollowersAnalysisSection,
  AlgorithmStatusSection,
} from "@/components/ai-report";

function formatWeekRange(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const format = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
  return `${format(startDate)} ~ ${format(endDate)}`;
}

function formatDateForInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDefaultDateRange(): { startDate: string; endDate: string } {
  const now = new Date();
  // 預設：昨天往前推 6 天（共 7 天）
  const endDate = new Date(now);
  endDate.setDate(now.getDate() - 1); // 昨天
  const startDate = new Date(endDate);
  startDate.setDate(endDate.getDate() - 6); // 昨天往前 6 天

  return {
    startDate: formatDateForInput(startDate),
    endDate: formatDateForInput(endDate),
  };
}

export default function AIReportPage() {
  const { selectedAccountId } = useSelectedAccount();
  const { isAdmin, isLoading: isUserLoading } = useCurrentUser();
  const {
    report,
    isLoading,
    isGenerating,
    error,
    hasEnoughData,
    dataAge,
    history,
    monthlyQuota,
    generateReport,
    fetchLatestReport,
    fetchReportHistory,
    selectReport,
    fetchMonthlyQuota,
  } = useWeeklyReport(selectedAccountId);

  // 日期區間選擇
  const defaultRange = getDefaultDateRange();
  const [startDate, setStartDate] = useState(defaultRange.startDate);
  const [endDate, setEndDate] = useState(defaultRange.endDate);

  // 計算選擇的天數
  const MAX_DAYS = 30;
  const selectedDays = startDate && endDate
    ? Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1
    : 0;
  const isDateRangeValid = selectedDays > 0 && selectedDays <= MAX_DAYS && startDate <= endDate;

  // 頁面載入時取得最新報告、歷史紀錄和額度
  useEffect(() => {
    if (selectedAccountId && isAdmin) {
      fetchLatestReport();
      fetchReportHistory();
      fetchMonthlyQuota();
    }
  }, [selectedAccountId, isAdmin, fetchLatestReport, fetchReportHistory, fetchMonthlyQuota]);

  // 非管理員顯示權限提示
  if (!isUserLoading && !isAdmin) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="AI 洞察報告"
          description="結合 AI 分析與圖表的帳號營運洞察報告"
          badge={{ label: "測試中", variant: "info" }}
        />
        <Alert>
          <AlertCircle className="size-4" />
          <AlertTitle>管理員專屬功能</AlertTitle>
          <AlertDescription>
            AI 洞察報告功能目前僅開放給管理員測試。如需使用此功能，請聯繫管理員。
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // 未選擇帳號
  if (!selectedAccountId) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="AI 洞察報告"
          description="結合 AI 分析與圖表的帳號營運洞察報告"
          badge={{ label: "測試中", variant: "info" }}
        />
        <Alert>
          <AlertCircle className="size-4" />
          <AlertDescription>
            請先在左側選單選擇一個 Threads 帳號
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // 數據不足提示
  if (!hasEnoughData && !isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="AI 洞察報告"
          description="結合 AI 分析與圖表的帳號營運洞察報告"
          badge={{ label: "測試中", variant: "info" }}
        />
        <Alert>
          <Clock className="size-4" />
          <AlertTitle>數據累積中</AlertTitle>
          <AlertDescription>
            AI 洞察報告需要至少 1 天的數據才能產生。
            {dataAge !== null && dataAge < 1 && (
              <span className="block mt-1 text-muted-foreground">
                目前尚未累積足夠數據。
              </span>
            )}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI 洞察報告"
        description="結合 AI 分析與圖表的帳號營運洞察報告"
        badge={{ label: "測試中", variant: "info" }}
      />

      {/* 報告控制區 */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* 日期區間選擇 */}
        <div className="flex items-center gap-2">
          <Calendar className="size-4 text-muted-foreground" />
          <div className="flex items-center gap-2">
            <Label htmlFor="startDate" className="sr-only">開始日期</Label>
            <Input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-36"
              disabled={isLoading || isGenerating}
            />
            <span className="text-muted-foreground">~</span>
            <Label htmlFor="endDate" className="sr-only">結束日期</Label>
            <Input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-36"
              disabled={isLoading || isGenerating}
            />
          </div>
          {/* 天數提示 */}
          <span className={`text-sm ${isDateRangeValid ? 'text-muted-foreground' : 'text-destructive'}`}>
            {selectedDays > 0 ? (
              selectedDays > MAX_DAYS
                ? `${selectedDays} 天（最多 ${MAX_DAYS} 天）`
                : `${selectedDays} 天`
            ) : startDate > endDate ? '日期範圍無效' : ''}
          </span>
        </div>

        <Button
          onClick={() => generateReport(startDate, endDate)}
          disabled={isGenerating || isLoading || !isDateRangeValid || (monthlyQuota?.remaining === 0)}
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              產生中...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 size-4" />
              產生報告
            </>
          )}
        </Button>

        {/* 本月額度 */}
        {monthlyQuota && (
          <span className="text-sm text-muted-foreground">
            本月額度：{monthlyQuota.remaining}/{monthlyQuota.limit}
          </span>
        )}

        {/* 歷史報告選擇器 */}
        {history.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={isLoading}>
                <History className="mr-2 size-4" />
                歷史報告
                <ChevronDown className="ml-2 size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {history.map((item) => (
                <DropdownMenuItem
                  key={item.id}
                  onClick={() => selectReport(item.id)}
                  className="flex flex-col items-start gap-0.5"
                >
                  <div className="flex items-center justify-between w-full">
                    <span>{formatWeekRange(item.weekStart, item.weekEnd)}</span>
                    {item.status === "completed" ? (
                      <Badge variant="secondary" className="text-xs">
                        完成
                      </Badge>
                    ) : item.status === "failed" ? (
                      <Badge variant="destructive" className="text-xs">
                        失敗
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        {item.status}
                      </Badge>
                    )}
                  </div>
                  {item.generatedAt && (
                    <span className="text-xs text-muted-foreground">
                      {new Date(item.generatedAt).toLocaleString("zh-TW", {
                        month: "numeric",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {report?.generatedAt && (
          <span className="text-sm text-muted-foreground">
            {report.weekStart && report.weekEnd && (
              <span className="mr-2">
                {formatWeekRange(report.weekStart, report.weekEnd)}
              </span>
            )}
            產生於 {new Date(report.generatedAt).toLocaleString("zh-TW")}
          </span>
        )}
      </div>

      {/* 錯誤提示 */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>錯誤</AlertTitle>
          <AlertDescription className="whitespace-pre-wrap break-all">
            {error}
          </AlertDescription>
        </Alert>
      )}

      {/* 載入中 */}
      {(isLoading || isGenerating) && !report && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* 報告內容 */}
      {report?.status === "completed" && report.report && report.dataSnapshot && (
        <div className="space-y-6">
          {/* 執行摘要 */}
          <ExecutiveSummarySection
            data={report.report.executive_summary}
            period={report.dataSnapshot.period}
          />

          {/* 數據概覽 */}
          <DataOverviewSection data={report.dataSnapshot} />

          {/* 曝光分析 */}
          <ReachAnalysisSection
            data={report.report.reach_analysis}
            snapshot={report.dataSnapshot}
          />

          {/* 互動分析 */}
          <EngagementAnalysisSection
            data={report.report.engagement_analysis}
            snapshot={report.dataSnapshot}
          />

          {/* 傳播力分析 */}
          {report.report.virality_analysis && (
            <ViralityAnalysisSection
              data={report.report.virality_analysis}
              snapshot={report.dataSnapshot}
            />
          )}

          {/* 內容策略 */}
          <ContentStrategySection
            data={report.report.content_strategy}
            topPosts={report.dataSnapshot.top_posts}
          />

          {/* 發文時間分析 */}
          <TimingAnalysisSection
            data={report.report.timing_analysis}
            hourlyData={report.dataSnapshot.hourly_distribution}
          />

          {/* 粉絲成長分析 */}
          {report.report.followers_analysis && (
            <FollowersAnalysisSection
              data={report.report.followers_analysis}
              snapshot={report.dataSnapshot}
            />
          )}

          {/* 演算法狀態分析 */}
          {report.report.algorithm_status && report.dataSnapshot.algorithm_status && (
            <AlgorithmStatusSection
              data={report.report.algorithm_status}
              snapshot={report.dataSnapshot}
            />
          )}
        </div>
      )}

      {/* 失敗的報告 */}
      {report?.status === "failed" && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>報告產生失敗</AlertTitle>
          <AlertDescription>
            {report.errorMessage || "未知錯誤，請重新嘗試"}
          </AlertDescription>
        </Alert>
      )}

      {/* 無報告 */}
      {!isLoading && !isGenerating && !report && (
        <Alert>
          <Sparkles className="size-4" />
          <AlertTitle>尚無報告</AlertTitle>
          <AlertDescription>
            點擊「產生報告」按鈕來產生您的第一份 AI 洞察報告。
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
