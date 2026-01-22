"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { FileSpreadsheet, FileText, Download, Loader2, Search, Image as ImageIcon, Eye, BookOpen } from "lucide-react";
import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";
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
  SummaryCardExport,
  ThemeSelector,
  type ReportTheme,
  Page1Summary,
  Page2Trend,
  Page3Posts,
  Page4Categories,
  Page5TimeAnalysis,
} from "@/components/reports";
import { useReportData } from "@/hooks/use-report-data";
import { useFullReportData } from "@/hooks/use-full-report-data";
import {
  generateAndDownloadCsv,
  formatDate,
  formatHour,
  formatPercent,
  truncateText,
  type CsvColumn,
} from "@/lib/csv-generator";
import { PageHeader } from "@/components/layout";
import { STONE } from "@/lib/design-tokens";

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

  // 預覽資料 (CSV)
  const [summaryData, setSummaryData] = useState<SummaryRow[] | null>(null);
  const [detailData, setDetailData] = useState<DetailRow[] | null>(null);
  const [dateRangeStr, setDateRangeStr] = useState<string>("");

  // 圖片匯出相關
  const [theme, setTheme] = useState<ReportTheme>("default");
  const [customColor, setCustomColor] = useState<string>();
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const { data: imageReportData, isLoading: isImageLoading, error: imageError, fetchData: fetchImageData } = useReportData();

  // 完整報表相關
  const [showFullReport, setShowFullReport] = useState(false);
  const [isFullExporting, setIsFullExporting] = useState(false);
  const fullPage1Ref = useRef<HTMLDivElement>(null);
  const fullPage2Ref = useRef<HTMLDivElement>(null);
  const fullPage3Ref = useRef<HTMLDivElement>(null);
  const fullPage4Ref = useRef<HTMLDivElement>(null);
  const fullPage5Ref = useRef<HTMLDivElement>(null);
  const { data: fullReportData, isLoading: isFullLoading, error: fullReportError, fetchData: fetchFullReportData } = useFullReportData();

  // 切換帳號時清空預覽
  useEffect(() => {
    setShowImagePreview(false);
    setShowFullReport(false);
    setSummaryData(null);
    setDetailData(null);
    setError(null);
  }, [selectedAccountId]);

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

  // 產生圖片報表預覽
  const handleGenerateImage = useCallback(async () => {
    if (!selectedAccountId) {
      setError("請先選擇 Threads 帳號");
      return;
    }

    const { start, end } = getDateRange(
      filters.timeRange,
      filters.customStartDate,
      filters.customEndDate
    );

    await fetchImageData(selectedAccountId, start, end);
    setShowImagePreview(true);
  }, [selectedAccountId, filters, fetchImageData]);

  // 下載 PNG
  const handleDownloadImage = useCallback(async () => {
    if (!exportRef.current || !imageReportData) return;

    setIsExporting(true);
    try {
      const dataUrl = await toPng(exportRef.current, {
        width: 1920,
        height: 1080,
        backgroundColor: STONE[50],
        pixelRatio: 1,
        skipFonts: true,
      });

      const link = document.createElement("a");
      link.download = `成效報告_${imageReportData.accountUsername}_${formatDate(imageReportData.periodStart)}_${formatDate(imageReportData.periodEnd)}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Export image error:", err);
      setError("匯出圖片失敗，請稍後再試");
    } finally {
      setIsExporting(false);
    }
  }, [imageReportData]);

  // 下載 PDF
  const handleDownloadPdf = useCallback(async () => {
    if (!exportRef.current || !imageReportData) return;

    setIsExporting(true);
    try {
      const dataUrl = await toPng(exportRef.current, {
        width: 1920,
        height: 1080,
        backgroundColor: STONE[50],
        pixelRatio: 2, // 提高解析度讓 PDF 更清晰
        skipFonts: true,
      });

      // 建立 PDF (A4 橫向，但使用 16:9 比例)
      // 1920x1080 = 16:9 比例
      // A4 橫向: 297mm x 210mm
      // 使用自訂尺寸以保持 16:9 比例
      const pdfWidth = 297; // mm
      const pdfHeight = (pdfWidth * 9) / 16; // 167.0625mm

      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: [pdfWidth, pdfHeight],
      });

      pdf.addImage(dataUrl, "PNG", 0, 0, pdfWidth, pdfHeight);

      const filename = `成效報告_${imageReportData.accountUsername}_${formatDate(imageReportData.periodStart)}_${formatDate(imageReportData.periodEnd)}.pdf`;
      pdf.save(filename);
    } catch (err) {
      console.error("Export PDF error:", err);
      setError("匯出 PDF 失敗，請稍後再試");
    } finally {
      setIsExporting(false);
    }
  }, [imageReportData]);

  // 主題變更
  const handleThemeChange = useCallback((newTheme: ReportTheme, newCustomColor?: string) => {
    setTheme(newTheme);
    if (newCustomColor) {
      setCustomColor(newCustomColor);
    }
  }, []);

  // 產生完整報表預覽
  const handleGenerateFullReport = useCallback(async () => {
    if (!selectedAccountId) {
      setError("請先選擇 Threads 帳號");
      return;
    }

    const { start, end } = getDateRange(
      filters.timeRange,
      filters.customStartDate,
      filters.customEndDate
    );

    await fetchFullReportData(selectedAccountId, start, end);
    setShowFullReport(true);
  }, [selectedAccountId, filters, fetchFullReportData]);

  // 下載完整報表 PDF
  const handleDownloadFullPdf = useCallback(async () => {
    if (!fullReportData) return;

    const pageRefs = [fullPage1Ref, fullPage2Ref, fullPage3Ref, fullPage4Ref, fullPage5Ref];
    const validRefs = pageRefs.filter((ref) => ref.current !== null);

    if (validRefs.length === 0) return;

    setIsFullExporting(true);
    try {
      const pdfWidth = 297; // mm
      const pdfHeight = (pdfWidth * 9) / 16; // 167.0625mm

      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: [pdfWidth, pdfHeight],
      });

      for (let i = 0; i < validRefs.length; i++) {
        const ref = validRefs[i];
        if (!ref.current) continue;

        const dataUrl = await toPng(ref.current, {
          width: 1920,
          height: 1080,
          backgroundColor: STONE[50],
          pixelRatio: 2,
          skipFonts: true,
        });

        if (i > 0) {
          pdf.addPage([pdfWidth, pdfHeight], "landscape");
        }

        pdf.addImage(dataUrl, "PNG", 0, 0, pdfWidth, pdfHeight);
      }

      const filename = `完整報告_${fullReportData.accountUsername}_${formatDate(fullReportData.periodStart)}_${formatDate(fullReportData.periodEnd)}.pdf`;
      pdf.save(filename);
    } catch (err) {
      console.error("Export full PDF error:", err);
      setError("匯出完整報告失敗，請稍後再試");
    } finally {
      setIsFullExporting(false);
    }
  }, [fullReportData]);

  const hasPreviewData = summaryData !== null || detailData !== null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="報表匯出"
        description="匯出成效報告，支援 PNG 圖片和 CSV 數據"
      />

      {/* 沒有選擇帳號的提示 */}
      {!selectedAccountId && (
        <Alert>
          <AlertDescription>
            請先在左側選單選擇一個 Threads 帳號
          </AlertDescription>
        </Alert>
      )}

      {/* 圖片報表 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="size-5" />
            成效摘要圖
          </CardTitle>
          <CardDescription>
            產生精美的單頁成效報告圖片 (1920×1080)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <ReportFilters
              filters={{ ...filters, reportType: "summary" }}
              onFiltersChange={(f) => setFilters({ ...f, reportType: filters.reportType })}
              hideReportType
            />
            <ThemeSelector
              value={theme}
              customColor={customColor}
              onChange={handleThemeChange}
            />
            <Button
              onClick={handleGenerateImage}
              disabled={isImageLoading || !selectedAccountId}
            >
              {isImageLoading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  產生中...
                </>
              ) : (
                <>
                  <Eye className="mr-2 size-4" />
                  預覽
                </>
              )}
            </Button>
            {showImagePreview && imageReportData && (
              <>
                <Button
                  variant="outline"
                  onClick={handleDownloadImage}
                  disabled={isExporting}
                >
                  {isExporting ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      匯出中...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 size-4" />
                      下載 PNG
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleDownloadPdf}
                  disabled={isExporting}
                >
                  {isExporting ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      匯出中...
                    </>
                  ) : (
                    <>
                      <FileText className="mr-2 size-4" />
                      下載 PDF
                    </>
                  )}
                </Button>
              </>
            )}
          </div>

          {/* 圖片錯誤提示 */}
          {imageError && (
            <Alert variant="destructive">
              <AlertDescription>{imageError}</AlertDescription>
            </Alert>
          )}

          {/* 圖片預覽 - 固定 16:9 比例 */}
          {showImagePreview && imageReportData && (
            <div className="mt-4">
              <p className="mb-2 text-sm text-muted-foreground">
                預覽（縮小顯示，實際匯出為 1920x1080）
              </p>
              <div className="overflow-hidden rounded-lg border bg-muted/50 aspect-video">
                <div className="w-full h-full origin-top-left scale-[0.35]">
                  <div style={{ width: "1920px", height: "1080px" }}>
                    <SummaryCardExport
                      data={imageReportData}
                      theme={theme}
                      customColor={customColor}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 隱藏的全尺寸匯出元件 - 使用 iframe 隔離 CSS */}
          {showImagePreview && imageReportData && (
            <div
              id="export-container"
              style={{
                position: "fixed",
                left: "-9999px",
                top: 0,
                width: "1920px",
                height: "1080px",
                backgroundColor: STONE[50],
                overflow: "hidden",
                // 重設所有 CSS 變數避免 lab() 色彩
                colorScheme: "light",
              }}
            >
              <SummaryCardExport
                ref={exportRef}
                data={imageReportData}
                theme={theme}
                customColor={customColor}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* 完整報表 PDF */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="size-5" />
            完整報表 PDF
          </CardTitle>
          <CardDescription>
            產生 5 頁完整成效報告：摘要、趨勢、貼文排行、分類分析、時段分析
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <ReportFilters
              filters={{ ...filters, reportType: "summary" }}
              onFiltersChange={(f) => setFilters({ ...f, reportType: filters.reportType })}
              hideReportType
            />
            <Button
              onClick={handleGenerateFullReport}
              disabled={isFullLoading || !selectedAccountId}
            >
              {isFullLoading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  產生中...
                </>
              ) : (
                <>
                  <Eye className="mr-2 size-4" />
                  預覽
                </>
              )}
            </Button>
            {showFullReport && fullReportData && (
              <Button
                variant="outline"
                onClick={handleDownloadFullPdf}
                disabled={isFullExporting}
              >
                {isFullExporting ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    匯出中...
                  </>
                ) : (
                  <>
                    <FileText className="mr-2 size-4" />
                    下載完整 PDF
                  </>
                )}
              </Button>
            )}
          </div>

          {/* 完整報表錯誤提示 */}
          {fullReportError && (
            <Alert variant="destructive">
              <AlertDescription>{fullReportError}</AlertDescription>
            </Alert>
          )}

          {/* 完整報表預覽 - 固定 16:9 比例 */}
          {showFullReport && fullReportData && (
            <div className="mt-4 space-y-4">
              <p className="text-sm text-muted-foreground">
                預覽（縮小顯示，共 5 頁）
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { title: "第 1 頁：摘要", component: <Page1Summary data={fullReportData} /> },
                  { title: "第 2 頁：趨勢", component: <Page2Trend data={fullReportData} /> },
                  { title: "第 3 頁：貼文", component: <Page3Posts data={fullReportData} /> },
                  { title: "第 4 頁：分類", component: <Page4Categories data={fullReportData} /> },
                  { title: "第 5 頁：時段", component: <Page5TimeAnalysis data={fullReportData} /> },
                ].map((page, idx) => (
                  <div key={idx} className="space-y-2">
                    <p className="text-xs text-muted-foreground">{page.title}</p>
                    <div className="overflow-hidden rounded-lg border bg-muted/50 aspect-video">
                      <div className="w-full h-full origin-top-left scale-[0.167]">
                        <div style={{ width: "1920px", height: "1080px" }}>
                          {page.component}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 隱藏的完整報表匯出元件 */}
          {showFullReport && fullReportData && (
            <div
              style={{
                position: "fixed",
                left: "-9999px",
                top: 0,
                colorScheme: "light",
              }}
            >
              <div style={{ width: "1920px", height: "1080px", backgroundColor: STONE[50] }}>
                <Page1Summary ref={fullPage1Ref} data={fullReportData} />
              </div>
              <div style={{ width: "1920px", height: "1080px", backgroundColor: STONE[50] }}>
                <Page2Trend ref={fullPage2Ref} data={fullReportData} />
              </div>
              <div style={{ width: "1920px", height: "1080px", backgroundColor: STONE[50] }}>
                <Page3Posts ref={fullPage3Ref} data={fullReportData} />
              </div>
              <div style={{ width: "1920px", height: "1080px", backgroundColor: STONE[50] }}>
                <Page4Categories ref={fullPage4Ref} data={fullReportData} />
              </div>
              <div style={{ width: "1920px", height: "1080px", backgroundColor: STONE[50] }}>
                <Page5TimeAnalysis ref={fullPage5Ref} data={fullReportData} />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* CSV 報表 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="size-5" />
            CSV 數據匯出
          </CardTitle>
          <CardDescription>
            下載彙總或明細數據，方便進一步分析
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
