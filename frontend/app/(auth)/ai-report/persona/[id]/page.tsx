"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, AlertCircle, ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/layout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { PersonaReport } from "@/hooks/use-persona-report";
import {
  ExecutiveSummarySection,
  PersonaImageSection,
  AudienceSegmentsSection,
  ContentHealthSection,
  ActionPlanSection,
} from "@/components/persona-report";

function formatWeekRange(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const format = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
  return `${format(startDate)} ~ ${format(endDate)}`;
}

export default function PersonaReportDetailPage() {
  const params = useParams();
  const reportId = params.id as string;

  const [report, setReport] = useState<PersonaReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchReport() {
      if (!reportId) return;

      setIsLoading(true);
      setError(null);

      try {
        const supabase = createClient();

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setError("請先登入");
          return;
        }

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
            workspace_threads_account:workspace_threads_accounts(
              id,
              username,
              name
            )
          `)
          .eq("id", reportId)
          .eq("report_type", "persona")
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
          title="人設定位報告"
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
          title="人設定位報告"
          description="查看報告詳情"
        />
        <Alert>
          <AlertCircle className="size-4" />
          <AlertDescription>找不到此報告</AlertDescription>
        </Alert>
      </div>
    );
  }

  // 報告未完成
  if (report.status !== "completed" || !report.report) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="人設定位報告"
          description={`分析期間：${formatWeekRange(report.weekStart, report.weekEnd)}`}
        />
        <Alert>
          <AlertCircle className="size-4" />
          <AlertDescription>
            {report.status === "generating"
              ? "報告正在產生中，請稍後再查看"
              : report.status === "failed"
              ? report.errorMessage || "報告產生失敗"
              : "報告尚未完成"}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const { report: reportContent, dataSnapshot } = report;

  return (
    <div className="space-y-6">
      <PageHeader
        title="人設定位報告"
        description={`分析期間：${formatWeekRange(report.weekStart, report.weekEnd)}`}
      />

      {/* Part 1: 總覽 */}
      <ExecutiveSummarySection
        executiveSummary={reportContent.executive_summary}
        dataSnapshot={dataSnapshot}
      />

      {/* Part 2: 你的形象 */}
      <PersonaImageSection
        personaImage={reportContent.persona_image}
      />

      {/* Part 3: 你的受眾 */}
      <AudienceSegmentsSection
        segments={reportContent.audience_segments}
      />

      {/* Part 4: 內容健檢 */}
      <ContentHealthSection
        contentHealth={reportContent.content_health}
      />

      {/* Part 5: 行動清單 */}
      <ActionPlanSection
        actionPlan={reportContent.action_plan}
      />
    </div>
  );
}
