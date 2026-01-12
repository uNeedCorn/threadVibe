"use client";

import { useState, useCallback } from "react";
import { FileSpreadsheet, Download, Loader2, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useSelectedAccount } from "@/hooks/use-selected-account";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ReportFilters,
  getDateRange,
  type ReportFiltersValue,
} from "@/components/reports";
import {
  generateAndDownloadCsv,
  formatDate,
  formatHour,
  formatPercent,
  truncateText,
  type CsvColumn,
} from "@/lib/csv-generator";

interface SummaryRow {
  period: string;
  postCount: number;
  totalViews: number;
  totalLikes: number;
  totalReplies: number;
  totalReposts: number;
  totalQuotes: number;
  avgEngagementRate: string;
}

interface DetailRow {
  postId: string;
  text: string;
  publishDate: string;
  exposureDate: string;
  exposureHour: string;
  views: number;
  likes: number;
  replies: number;
  reposts: number;
  quotes: number;
  tags: string;
}

interface HourlyMetricData {
  bucket_ts: string;
  views: number;
  likes: number;
  replies: number;
  reposts: number;
  quotes: number;
  workspace_threads_posts: {
    id: string;
    threads_post_id: string;
    text: string | null;
    published_at: string;
    workspace_threads_post_tags?: Array<{
      workspace_threads_account_tags: {
        name: string;
      };
    }>;
  };
}

const summaryColumns: CsvColumn<SummaryRow>[] = [
  { header: "期間", accessor: (row) => row.period },
  { header: "發文數", accessor: (row) => row.postCount },
  { header: "總觀看", accessor: (row) => row.totalViews },
  { header: "總讚數", accessor: (row) => row.totalLikes },
  { header: "總回覆", accessor: (row) => row.totalReplies },
  { header: "總轉發", accessor: (row) => row.totalReposts },
  { header: "總引用", accessor: (row) => row.totalQuotes },
  { header: "平均互動率", accessor: (row) => row.avgEngagementRate },
];

const detailColumns: CsvColumn<DetailRow>[] = [
  { header: "貼文ID", accessor: (row) => row.postId },
  { header: "貼文內容", accessor: (row) => row.text },
  { header: "發文時間", accessor: (row) => row.publishDate },
  { header: "曝光日期", accessor: (row) => row.exposureDate },
  { header: "曝光時間", accessor: (row) => row.exposureHour },
  { header: "觀看數", accessor: (row) => row.views },
  { header: "讚數", accessor: (row) => row.likes },
  { header: "回覆", accessor: (row) => row.replies },
  { header: "轉發數", accessor: (row) => row.reposts },
  { header: "引用數", accessor: (row) => row.quotes },
  { header: "分類標籤", accessor: (row) => row.tags },
];

export default function ReportsPage() {
  const { selectedAccountId } = useSelectedAccount();
  const [filters, setFilters] = useState<ReportFiltersValue>({
    timeRange: "this_week",
    reportType: "summary",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 預覽資料
  const [summaryData, setSummaryData] = useState<SummaryRow[] | null>(null);
  const [detailData, setDetailData] = useState<DetailRow[] | null>(null);
  const [dateRangeStr, setDateRangeStr] = useState<string>("");

  // 產生報表
  const handleGenerate = useCallback(async () => {
    if (!selectedAccountId) {
      setError("請先選擇 Threads 帳號");
      return;
    }

    setIsLoading(true);
    setError(null);
    setSummaryData(null);
    setDetailData(null);

    try {
      const supabase = createClient();
      const { start, end } = getDateRange(
        filters.timeRange,
        filters.customStartDate,
        filters.customEndDate
      );

      const startStr = start.toISOString();
      const endStr = end.toISOString();
      const rangeStr = `${formatDate(start)}_${formatDate(end)}`;
      setDateRangeStr(rangeStr);

      if (filters.reportType === "summary") {
        const data = await fetchSummaryData(supabase, selectedAccountId, startStr, endStr, rangeStr);
        setSummaryData(data);
      } else {
        const data = await fetchDetailData(supabase, selectedAccountId, startStr, endStr);
        setDetailData(data);
      }
    } catch (err) {
      console.error("Generate error:", err);
      setError(err instanceof Error ? err.message : "產生報表失敗，請稍後再試");
    } finally {
      setIsLoading(false);
    }
  }, [selectedAccountId, filters]);

  // 下載 CSV
  const handleDownload = useCallback(() => {
    if (filters.reportType === "summary" && summaryData) {
      generateAndDownloadCsv(summaryData, summaryColumns, `彙總報表_${dateRangeStr}.csv`);
    } else if (filters.reportType === "detail" && detailData) {
      generateAndDownloadCsv(detailData, detailColumns, `明細報表_${dateRangeStr}.csv`);
    }
  }, [filters.reportType, summaryData, detailData, dateRangeStr]);

  const hasPreviewData = summaryData !== null || detailData !== null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">報表下載</h1>
        <p className="text-muted-foreground">
          下載週報、月報數據，支援彙總報表和明細報表
        </p>
      </div>

      {/* 篩選器 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="size-5" />
            報表設定
          </CardTitle>
          <CardDescription>
            選擇時間範圍和報表類型
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ReportFilters filters={filters} onFiltersChange={setFilters}>
            {/* 按鈕放在篩選器同一行 */}
            <Button
              onClick={handleGenerate}
              disabled={isLoading || !selectedAccountId}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  產生中...
                </>
              ) : (
                <>
                  <Search className="mr-2 size-4" />
                  產生報表
                </>
              )}
            </Button>

            {hasPreviewData && (
              <Button variant="outline" onClick={handleDownload}>
                <Download className="mr-2 size-4" />
                下載 CSV
              </Button>
            )}
          </ReportFilters>
        </CardContent>
      </Card>

      {/* 錯誤提示 */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* 沒有選擇帳號的提示 */}
      {!selectedAccountId && (
        <Alert>
          <AlertDescription>
            請先在左側選單選擇一個 Threads 帳號
          </AlertDescription>
        </Alert>
      )}

      {/* 彙總報表預覽 */}
      {summaryData && (
        <Card>
          <CardHeader>
            <CardTitle>彙總報表預覽</CardTitle>
            <CardDescription>
              共 {summaryData.length} 筆資料
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>期間</TableHead>
                    <TableHead className="text-right">發文數</TableHead>
                    <TableHead className="text-right">總觀看</TableHead>
                    <TableHead className="text-right">總讚數</TableHead>
                    <TableHead className="text-right">總回覆</TableHead>
                    <TableHead className="text-right">總轉發</TableHead>
                    <TableHead className="text-right">總引用</TableHead>
                    <TableHead className="text-right">平均互動率</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summaryData.map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{row.period}</TableCell>
                      <TableCell className="text-right">{row.postCount.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{row.totalViews.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{row.totalLikes.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{row.totalReplies.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{row.totalReposts.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{row.totalQuotes.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{row.avgEngagementRate}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 明細報表預覽 */}
      {detailData && (
        <Card>
          <CardHeader>
            <CardTitle>明細報表預覽</CardTitle>
            <CardDescription>
              共 {detailData.length} 筆資料（顯示前 100 筆）
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>貼文ID</TableHead>
                    <TableHead className="min-w-[200px]">貼文內容</TableHead>
                    <TableHead>發文時間</TableHead>
                    <TableHead>曝光日期</TableHead>
                    <TableHead>曝光時間</TableHead>
                    <TableHead className="text-right">觀看數</TableHead>
                    <TableHead className="text-right">讚數</TableHead>
                    <TableHead className="text-right">回覆</TableHead>
                    <TableHead className="text-right">轉發數</TableHead>
                    <TableHead className="text-right">引用數</TableHead>
                    <TableHead>分類標籤</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailData.slice(0, 100).map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-mono text-xs">{row.postId}</TableCell>
                      <TableCell className="min-w-[200px] max-w-[300px] truncate" title={row.text}>
                        {row.text}
                      </TableCell>
                      <TableCell>{row.publishDate}</TableCell>
                      <TableCell>{row.exposureDate}</TableCell>
                      <TableCell>{row.exposureHour}</TableCell>
                      <TableCell className="text-right">{row.views.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{row.likes.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{row.replies.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{row.reposts.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{row.quotes.toLocaleString()}</TableCell>
                      <TableCell>{row.tags || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/**
 * 取得彙總報表資料
 */
async function fetchSummaryData(
  supabase: ReturnType<typeof createClient>,
  accountId: string,
  startDate: string,
  endDate: string,
  dateRangeStr: string
): Promise<SummaryRow[]> {
  const { data: posts, error } = await supabase
    .from("workspace_threads_posts")
    .select(
      "id, current_views, current_likes, current_replies, current_reposts, current_quotes"
    )
    .eq("workspace_threads_account_id", accountId)
    .gte("published_at", startDate)
    .lte("published_at", endDate);

  if (error) {
    throw new Error(`查詢失敗: ${error.message}`);
  }

  if (!posts || posts.length === 0) {
    throw new Error("該期間內沒有貼文數據");
  }

  const totalViews = posts.reduce((sum, p) => sum + (p.current_views || 0), 0);
  const totalLikes = posts.reduce((sum, p) => sum + (p.current_likes || 0), 0);
  const totalReplies = posts.reduce((sum, p) => sum + (p.current_replies || 0), 0);
  const totalReposts = posts.reduce((sum, p) => sum + (p.current_reposts || 0), 0);
  const totalQuotes = posts.reduce((sum, p) => sum + (p.current_quotes || 0), 0);

  const totalInteractions = totalLikes + totalReplies + totalReposts + totalQuotes;
  const avgEngagementRate = totalViews > 0 ? (totalInteractions / totalViews) * 100 : 0;

  return [
    {
      period: dateRangeStr.replace("_", " ~ "),
      postCount: posts.length,
      totalViews,
      totalLikes,
      totalReplies,
      totalReposts,
      totalQuotes,
      avgEngagementRate: formatPercent(avgEngagementRate),
    },
  ];
}

/**
 * 取得明細報表資料
 */
async function fetchDetailData(
  supabase: ReturnType<typeof createClient>,
  accountId: string,
  startDate: string,
  endDate: string
): Promise<DetailRow[]> {
  // 先查詢期間內的貼文 ID
  const { data: posts, error: postsError } = await supabase
    .from("workspace_threads_posts")
    .select("id")
    .eq("workspace_threads_account_id", accountId)
    .gte("published_at", startDate)
    .lte("published_at", endDate);

  if (postsError) {
    throw new Error(`查詢貼文失敗: ${postsError.message}`);
  }

  if (!posts || posts.length === 0) {
    throw new Error("該期間內沒有貼文數據");
  }

  const postIds = posts.map((p) => p.id);

  // 查詢 hourly 指標
  const { data: metrics, error: metricsError } = await supabase
    .from("workspace_threads_post_metrics_hourly")
    .select(`
      bucket_ts,
      views,
      likes,
      replies,
      reposts,
      quotes,
      workspace_threads_posts!inner (
        id,
        threads_post_id,
        text,
        published_at,
        workspace_threads_post_tags (
          workspace_threads_account_tags (
            name
          )
        )
      )
    `)
    .in("workspace_threads_post_id", postIds)
    .gte("bucket_ts", startDate)
    .lte("bucket_ts", endDate)
    .order("bucket_ts", { ascending: true });

  if (metricsError) {
    throw new Error(`查詢指標失敗: ${metricsError.message}`);
  }

  if (!metrics || metrics.length === 0) {
    throw new Error("該期間內沒有指標數據");
  }

  return (metrics as unknown as HourlyMetricData[]).map((m) => {
    const bucketDate = new Date(m.bucket_ts);
    const publishDate = new Date(m.workspace_threads_posts.published_at);

    const tags = m.workspace_threads_posts.workspace_threads_post_tags
      ?.map((t) => t.workspace_threads_account_tags?.name)
      .filter(Boolean)
      .join(", ") || "";

    return {
      postId: m.workspace_threads_posts.threads_post_id,
      text: truncateText(m.workspace_threads_posts.text, 50),
      publishDate: formatDate(publishDate),
      exposureDate: formatDate(bucketDate),
      exposureHour: formatHour(bucketDate),
      views: m.views,
      likes: m.likes,
      replies: m.replies,
      reposts: m.reposts,
      quotes: m.quotes,
      tags,
    };
  });
}
