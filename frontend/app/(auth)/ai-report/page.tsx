"use client";

import { useEffect, useState } from "react";
import {
  Sparkles,
  Loader2,
  AlertCircle,
  Clock,
  Calendar,
  ExternalLink,
  Trash2,
  Check,
  TrendingUp,
  FileText,
} from "lucide-react";
import { useSelectedAccount } from "@/hooks/use-selected-account";
import { useWeeklyReport } from "@/hooks/use-weekly-report";
import { useCurrentUser } from "@/hooks/use-current-user";
import { PageHeader } from "@/components/layout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// 報告類型定義
const REPORT_TYPES = {
  insights: {
    label: "AI 洞察報告",
    description: "綜合分析帳號營運狀況，提供整體建議",
    icon: TrendingUp,
    features: [
      "整體表現評分與關鍵指標",
      "曝光與互動趨勢分析",
      "內容策略與最佳發文時間",
      "演算法狀態監測",
      "下週行動建議",
    ],
  },
  content: {
    label: "內容分析報告",
    description: "深入分析貼文特徵與成效關聯",
    icon: FileText,
    features: [
      "內容類型效益比較",
      "文字長度與成效關聯",
      "問句/CTA 使用效益",
      "標籤效益分析",
      "高表現內容模式",
    ],
    comingSoon: true,
  },
} as const;

type ReportType = keyof typeof REPORT_TYPES;

function formatWeekRange(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const format = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
  return `${format(startDate)} ~ ${format(endDate)}`;
}

function formatFullDateRange(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Taipei",
  };
  const startStr = startDate.toLocaleDateString("zh-TW", options);
  const endStr = endDate.toLocaleDateString("zh-TW", options);
  return `${startStr} ~ ${endStr} (UTC+8)`;
}

function getReportTypeName(reportType: string): string {
  return REPORT_TYPES[reportType as ReportType]?.label || "AI 洞察報告";
}

function formatDateForInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDefaultDateRange(): { startDate: string; endDate: string } {
  const now = new Date();
  const endDate = new Date(now);
  endDate.setDate(now.getDate() - 1);
  const startDate = new Date(endDate);
  startDate.setDate(endDate.getDate() - 6);

  return {
    startDate: formatDateForInput(startDate),
    endDate: formatDateForInput(endDate),
  };
}

export default function AIReportPage() {
  const { selectedAccountId } = useSelectedAccount();
  const { isAdmin } = useCurrentUser();
  const {
    isLoading,
    isGenerating,
    error,
    hasEnoughData,
    dataAge,
    history,
    quota,
    generateReport,
    fetchLatestReport,
    fetchReportHistory,
    deleteReport,
  } = useWeeklyReport(selectedAccountId);

  // 報告類型選擇
  const [reportType, setReportType] = useState<ReportType>("insights");
  const selectedReportType = REPORT_TYPES[reportType];

  // 日期區間選擇
  const defaultRange = getDefaultDateRange();
  const [startDate, setStartDate] = useState(defaultRange.startDate);
  const [endDate, setEndDate] = useState(defaultRange.endDate);

  // 進度條模擬
  const [progress, setProgress] = useState(0);

  // 計算選擇的天數
  const MAX_DAYS = 30;
  const selectedDays = startDate && endDate
    ? Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1
    : 0;
  const isDateRangeValid = selectedDays > 0 && selectedDays <= MAX_DAYS && startDate <= endDate;

  // 頁面載入時取得歷史紀錄
  useEffect(() => {
    if (selectedAccountId) {
      fetchLatestReport();
      fetchReportHistory();
    }
  }, [selectedAccountId, fetchLatestReport, fetchReportHistory]);

  // 追蹤上一次的 isGenerating 狀態
  const [wasGenerating, setWasGenerating] = useState(false);

  // 產生中時模擬進度條
  useEffect(() => {
    if (isGenerating) {
      setWasGenerating(true);
      setProgress(0);
      const interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) return prev;
          return prev + Math.random() * 15;
        });
      }, 500);
      return () => clearInterval(interval);
    } else {
      if (progress > 0) {
        setProgress(100);
        setTimeout(() => setProgress(0), 500);
      }
      // 產生完成後刷新歷史列表
      if (wasGenerating) {
        setWasGenerating(false);
        fetchReportHistory();
      }
    }
  }, [isGenerating, wasGenerating, fetchReportHistory]);

  // 產生報告（非同步模式，輪詢完成後自動刷新列表）
  const handleGenerateReport = async () => {
    await generateReport(startDate, endDate);
    // 立即刷新一次，顯示 generating 狀態
    fetchReportHistory();
  };

  // 開啟報告（新分頁）
  const openReport = (reportId: string) => {
    window.open(`/ai-report/${reportId}`, "_blank");
  };

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

      {/* 新帳號提醒 */}
      {dataAge !== null && dataAge < 7 && (
        <Alert>
          <Clock className="size-4" />
          <AlertDescription>
            此帳號數據僅累積 {Math.floor(dataAge)} 天，建議累積滿 7 天後再產生報告，以獲得更準確的分析結果。
          </AlertDescription>
        </Alert>
      )}

      {/* 產生報告區 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">產生新報告</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 報告類型選擇 - 卡片式 */}
          <TooltipProvider delayDuration={300}>
            <div className="flex flex-wrap gap-3">
              {Object.entries(REPORT_TYPES).map(([key, type]) => {
                const isSelected = reportType === key;
                const isDisabled = "comingSoon" in type && type.comingSoon;
                const IconComponent = type.icon;

                return (
                  <Tooltip key={key}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => !isDisabled && setReportType(key as ReportType)}
                        disabled={isDisabled || isLoading || isGenerating}
                        className={cn(
                          "relative flex items-center gap-3 rounded-lg border-2 px-4 py-3 text-left transition-all",
                          "hover:border-primary/50 hover:bg-accent/50",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                          "disabled:cursor-not-allowed disabled:opacity-50",
                          isSelected
                            ? "border-primary bg-primary/5"
                            : "border-muted bg-card"
                        )}
                      >
                        {/* 選中標記 */}
                        {isSelected && (
                          <div className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
                            <Check className="size-3" />
                          </div>
                        )}

                        {/* 圖標 */}
                        <div className={cn(
                          "flex size-9 items-center justify-center rounded-lg",
                          isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                        )}>
                          <IconComponent className="size-4" />
                        </div>

                        {/* 標題 */}
                        <div>
                          <h3 className="text-sm font-medium">{type.label}</h3>
                          {isDisabled && (
                            <span className="text-xs text-muted-foreground">即將推出</span>
                          )}
                        </div>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs p-3">
                      <p className="mb-2 text-sm font-medium">{type.label}</p>
                      <p className="mb-2 text-xs text-muted-foreground">{type.description}</p>
                      <ul className="space-y-1 text-xs">
                        {type.features.map((feature, idx) => (
                          <li key={idx} className="flex items-center gap-2">
                            <Check className="size-3 shrink-0 text-primary" />
                            {feature}
                          </li>
                        ))}
                      </ul>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </TooltipProvider>

          {/* 日期區間與產生按鈕 */}
          <div className="flex flex-col gap-4 rounded-lg border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Calendar className="size-4 text-muted-foreground" />
                分析期間
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="startDate" className="sr-only">開始日期</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-9 w-[130px] bg-background"
                  disabled={isLoading || isGenerating}
                />
                <span className="text-muted-foreground">至</span>
                <Label htmlFor="endDate" className="sr-only">結束日期</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-9 w-[130px] bg-background"
                  disabled={isLoading || isGenerating}
                />
              </div>
              <Badge variant={isDateRangeValid ? "secondary" : "destructive"} className="font-normal">
                {selectedDays > 0 ? (
                  selectedDays > MAX_DAYS
                    ? `${selectedDays} 天（最多 ${MAX_DAYS} 天）`
                    : `${selectedDays} 天`
                ) : startDate > endDate ? '日期範圍無效' : '選擇日期'}
              </Badge>
            </div>

            <div className="flex items-center gap-4">
              {/* 額度資訊（非管理員顯示） */}
              {!isAdmin && (
                <div className="flex items-center gap-3 text-sm">
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">剩餘點數</span>
                    <Badge variant={quota.remaining > 0 ? "secondary" : "outline"} className="font-medium">
                      {quota.remaining} / {quota.total}
                    </Badge>
                  </div>
                  {quota.nextResetAt && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Clock className="size-3.5" />
                      <span>
                        {new Date(quota.nextResetAt).toLocaleDateString("zh-TW", {
                          month: "numeric",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })} 重置
                      </span>
                    </div>
                  )}
                </div>
              )}
              <Button
                onClick={handleGenerateReport}
                disabled={isGenerating || isLoading || !isDateRangeValid || (!isAdmin && quota.remaining <= 0) || ("comingSoon" in selectedReportType && selectedReportType.comingSoon)}
                size="lg"
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
            </div>
          </div>

          {/* 進度條 */}
          {isGenerating && (
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <p className="text-sm text-muted-foreground">
                AI 正在分析數據並產生報告，請稍候...
              </p>
            </div>
          )}
        </CardContent>
      </Card>

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

      {/* 歷史報告表格 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">歷史報告</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Sparkles className="size-8 mx-auto mb-2 opacity-50" />
              <p>尚無報告</p>
              <p className="text-sm">點擊上方「產生報告」按鈕來產生您的第一份 AI 洞察報告</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>報告類型</TableHead>
                  <TableHead>報告期間</TableHead>
                  <TableHead>產生時間</TableHead>
                  <TableHead>狀態</TableHead>
                  <TableHead className="w-32 text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      {getReportTypeName(item.reportType)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatFullDateRange(item.weekStart, item.weekEnd)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {item.generatedAt
                        ? new Date(item.generatedAt).toLocaleString("zh-TW", {
                            year: "numeric",
                            month: "2-digit",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                            timeZone: "Asia/Taipei",
                          }) + " (UTC+8)"
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {item.status === "completed" ? (
                        <Badge variant="secondary">完成</Badge>
                      ) : item.status === "failed" ? (
                        <Badge variant="destructive">失敗</Badge>
                      ) : item.status === "generating" ? (
                        <Badge variant="outline">
                          <Loader2 className="mr-1 size-3 animate-spin" />
                          產生中
                        </Badge>
                      ) : (
                        <Badge variant="outline">{item.status}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openReport(item.id)}
                          disabled={item.status !== "completed"}
                        >
                          <ExternalLink className="size-4 mr-1" />
                          查看
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>確定要刪除此報告？</AlertDialogTitle>
                              <AlertDialogDescription>
                                報告將被移至回收區，您可以稍後聯繫管理員復原。
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>取消</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteReport(item.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                刪除
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
