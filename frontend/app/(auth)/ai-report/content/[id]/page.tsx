"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, AlertCircle, ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/layout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { ContentPatternReport, ContentPatternSnapshot } from "@/hooks/use-content-pattern-report";
import {
  ExecutiveSummarySection,
  MediaTypeSection,
  LengthSection,
  FeatureSection,
  AITagSection,
  UserTagSection,
  TimingSection,
  SuccessPatternSection,
  FailureWarningSection,
  ThrottlingWarningSection,
} from "@/components/content-pattern-report";

function formatDateRange(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const format = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
  return `${format(startDate)} ~ ${format(endDate)}`;
}

export default function ContentPatternReportDetailPage() {
  const params = useParams();
  const reportId = params.id as string;

  const [report, setReport] = useState<ContentPatternReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchReport() {
      if (!reportId) return;

      setIsLoading(true);
      setError(null);

      try {
        const supabase = createClient();

        // 驗證使用者登入狀態
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setError("請先登入");
          return;
        }

        // 取得報告（RLS 會自動檢查權限）
        const { data, error: fetchError } = await supabase
          .from("ai_weekly_reports")
          .select(`
            id,
            week_start,
            week_end,
            status,
            report_content,
            data_snapshot,
            generated_at,
            error_message,
            report_type,
            workspace_threads_account:workspace_threads_accounts(
              id,
              username,
              name
            )
          `)
          .eq("id", reportId)
          .eq("report_type", "content")
          .single();

        if (fetchError) {
          if (fetchError.code === "PGRST116") {
            setError("找不到此報告，或您沒有權限查看");
          } else {
            setError(fetchError.message);
          }
          return;
        }

        if (data) {
          setReport({
            id: data.id,
            weekStart: data.week_start,
            weekEnd: data.week_end,
            status: data.status,
            report: data.report_content,
            dataSnapshot: data.data_snapshot,
            generatedAt: data.generated_at,
            errorMessage: data.error_message,
          });
        }
      } catch (err) {
        console.error("Fetch report error:", err);
        setError(err instanceof Error ? err.message : "取得報告失敗");
      } finally {
        setIsLoading(false);
      }
    }

    fetchReport();
  }, [reportId]);

  // 載入中
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // 錯誤
  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="內容模式報告"
          description="查看報告詳情"
        />
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>錯誤</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button variant="outline" onClick={() => window.close()}>
          <ArrowLeft className="mr-2 size-4" />
          關閉
        </Button>
      </div>
    );
  }

  // 無報告
  if (!report) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="內容模式報告"
          description="查看報告詳情"
        />
        <Alert>
          <AlertCircle className="size-4" />
          <AlertDescription>找不到此報告</AlertDescription>
        </Alert>
      </div>
    );
  }

  const periodText = report.weekStart && report.weekEnd
    ? formatDateRange(report.weekStart, report.weekEnd)
    : "";

  const snapshot = report.dataSnapshot as ContentPatternSnapshot | null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`內容模式報告 ${periodText}`}
        description={
          report.generatedAt
            ? `產生於 ${new Date(report.generatedAt).toLocaleString("zh-TW")}`
            : ""
        }
      />

      {/* 失敗的報告 */}
      {report.status === "failed" && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>報告產生失敗</AlertTitle>
          <AlertDescription>
            {report.errorMessage || "未知錯誤"}
          </AlertDescription>
        </Alert>
      )}

      {/* 產生中 */}
      {report.status === "generating" && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
          <span className="ml-3 text-muted-foreground">報告產生中...</span>
        </div>
      )}

      {/* 報告內容 */}
      {report.status === "completed" && report.report && snapshot && (
        <div className="space-y-6">
          <ExecutiveSummarySection
            data={report.report.executive_summary}
            snapshot={snapshot}
          />

          <MediaTypeSection
            data={report.report.media_type_analysis}
            snapshot={snapshot}
          />

          <LengthSection
            data={report.report.length_analysis}
            snapshot={snapshot}
          />

          <FeatureSection
            data={report.report.feature_analysis}
            snapshot={snapshot}
          />

          <AITagSection
            data={report.report.ai_tag_analysis}
            snapshot={snapshot}
          />

          {snapshot.user_tags && snapshot.user_tags.length > 0 && (
            <UserTagSection
              data={report.report.user_tag_analysis}
              snapshot={snapshot}
            />
          )}

          <TimingSection
            data={report.report.timing_analysis}
            snapshot={snapshot}
          />

          <SuccessPatternSection
            data={report.report.success_formula}
            snapshot={snapshot}
          />

          <FailureWarningSection
            data={report.report.failure_warning}
            snapshot={snapshot}
          />

          {report.report.throttling_warning && (
            <ThrottlingWarningSection
              data={report.report.throttling_warning}
              snapshot={snapshot}
            />
          )}
        </div>
      )}
    </div>
  );
}
