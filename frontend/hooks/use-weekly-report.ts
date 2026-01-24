"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

// ============================================================================
// 報告內容類型（新結構：區塊只給發現，頂部給建議）
// ============================================================================

export interface ReportContent {
  // 頂部總結：唯一給建議的地方
  executive_summary: {
    overall_rating: "excellent" | "good" | "average" | "needs_improvement";
    one_line_summary: string;
    key_metrics: Array<{ label: string; value: string; change?: string }>;
    action_items: Array<{
      action: string;
      reason: string;
      priority: "high" | "medium" | "low";
    }>;
  };
  // 曝光分析：只給發現
  reach_analysis: {
    summary: string;
    findings: string[];
  };
  // 互動分析：只給發現
  engagement_analysis: {
    summary: string;
    findings: string[];
  };
  // 內容策略：只給發現
  content_strategy: {
    summary: string;
    findings: string[];
    top_performing: string[];
  };
  // 發文時間：只給發現
  timing_analysis: {
    summary: string;
    findings: string[];
    best_times: string[];
  };
  // 粉絲成長：只給發現
  followers_analysis?: {
    summary: string;
    findings: string[];
  };
  // 傳播力分析：只給發現（選填）
  virality_analysis?: {
    summary: string;
    findings: string[];
  };
  // 演算法狀態：只給發現（選填）
  algorithm_status?: {
    summary: string;
    findings: string[];
    status_label: string;
  };
}

// ============================================================================
// 數據快照類型
// ============================================================================

export interface DataSnapshot {
  account: {
    username: string;
    name: string;
    followers_count: number;
    followers_growth: number;
  };
  period: {
    start: string;
    end: string;
  };
  summary: {
    post_count: number;
    total_views: number;
    total_likes: number;
    total_replies: number;
    total_reposts: number;
    total_quotes: number;
    total_shares: number;
    total_interactions: number;
    engagement_rate: number;
    avg_virality_score: number;
  };
  daily_metrics: Array<{
    date: string;
    views: number;
    interactions: number;
    post_count: number;
    followers_count: number;
  }>;
  top_posts: Array<{
    id: string;
    text: string;
    views: number;
    likes: number;
    replies: number;
    reposts: number;
    quotes: number;
    engagement_rate: number;
    virality_score: number;
    published_at: string;
    media_type: string;
    char_count: number;
    has_question: boolean;
    has_cta: boolean;
  }>;
  // 內容特徵效益分析
  content_features: {
    by_media_type: Array<{
      type: string;
      count: number;
      avg_views: number;
      avg_engagement_rate: number;
    }>;
    by_length: Array<{
      range: string;
      count: number;
      avg_views: number;
      avg_engagement_rate: number;
    }>;
    by_question: {
      with_question: { count: number; avg_views: number; avg_replies: number };
      without_question: { count: number; avg_views: number; avg_replies: number };
    };
    by_cta: {
      with_cta: { count: number; avg_views: number; avg_engagement_rate: number };
      without_cta: { count: number; avg_views: number; avg_engagement_rate: number };
    };
  };
  // 標籤效益分析
  tag_performance: {
    user_tags: Array<{
      name: string;
      color: string;
      count: number;
      avg_views: number;
      avg_engagement_rate: number;
    }>;
    ai_tags: Array<{
      dimension: string;
      tag: string;
      count: number;
      avg_views: number;
      avg_engagement_rate: number;
    }>;
  };
  // 互動品質指標
  engagement_quality: {
    avg_discussion_depth: number;
    avg_share_willingness: number;
    deep_discussion_posts: number;
    high_share_posts: number;
  };
  // 早期表現指標
  early_performance: {
    avg_first_hour_views: number;
    avg_first_24h_views: number;
    first_hour_ratio: number;
  };
  // 傳播力指標
  virality_metrics: {
    avg_virality_score: number;
    high_virality_posts: number;
    total_shares: number;
    share_rate: number;
  };
  // 時段分佈
  hourly_distribution: Array<{
    hour: number;
    post_count: number;
    avg_views: number;
    avg_engagement: number;
  }>;
  // 上週對比
  previous_week: {
    total_views: number;
    total_interactions: number;
    post_count: number;
    avg_virality_score: number;
    followers_count: number;
  } | null;
  // 演算法狀態（限流監測）
  algorithm_status?: {
    rolling_7d_reach: number;
    quota_status: "normal" | "elevated" | "warning" | "throttled";
    burst_events: Array<{
      post_id: string;
      post_text: string;
      date: string;
      reach_multiplier: number;
      views: number;
    }>;
    daily_reach: Array<{
      date: string;
      avg_reach: number;
      cumulative_reach: number;
      post_count: number;
    }>;
  };
}

// ============================================================================
// 週報類型
// ============================================================================

export interface WeeklyReport {
  id: string;
  weekStart: string;
  weekEnd: string;
  status: "pending" | "generating" | "completed" | "failed";
  report: ReportContent | null;
  dataSnapshot: DataSnapshot | null;
  generatedAt: string | null;
  errorMessage: string | null;
}

export interface ReportHistoryItem {
  id: string;
  weekStart: string;
  weekEnd: string;
  status: "pending" | "generating" | "completed" | "failed";
  generatedAt: string | null;
  createdAt: string;
  reportType: string;
}

// ============================================================================
// Hook
// ============================================================================

interface UseWeeklyReportReturn {
  report: WeeklyReport | null;
  isLoading: boolean;
  isGenerating: boolean;
  error: string | null;
  hasEnoughData: boolean;
  dataAge: number | null;
  history: ReportHistoryItem[];
  generateReport: (startDate?: string, endDate?: string) => Promise<void>;
  fetchLatestReport: () => Promise<void>;
  fetchReportHistory: () => Promise<void>;
  selectReport: (reportId: string) => Promise<void>;
  deleteReport: (reportId: string) => Promise<void>;
}

// 輪詢間隔（毫秒）
const POLL_INTERVAL = 3000;
// 最大輪詢次數（3 秒 x 60 = 3 分鐘）
const MAX_POLL_COUNT = 60;

export function useWeeklyReport(accountId: string | null): UseWeeklyReportReturn {
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasEnoughData, setHasEnoughData] = useState(true);
  const [dataAge, setDataAge] = useState<number | null>(null);
  const [history, setHistory] = useState<ReportHistoryItem[]>([]);

  // 輪詢相關
  const [pollingReportId, setPollingReportId] = useState<string | null>(null);
  const pollCountRef = useRef(0);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 輪詢報告狀態
  const pollReportStatus = useCallback(async (reportId: string): Promise<boolean> => {
    try {
      const supabase = createClient();
      const { data, error: fetchError } = await supabase
        .from("ai_weekly_reports")
        .select("id, week_start, week_end, status, report_content, data_snapshot, generated_at, error_message")
        .eq("id", reportId)
        .single();

      if (fetchError) {
        console.error("Poll report status error:", fetchError);
        return false;
      }

      if (data) {
        if (data.status === "completed") {
          setReport({
            id: data.id,
            weekStart: data.week_start,
            weekEnd: data.week_end,
            status: "completed",
            report: data.report_content,
            dataSnapshot: data.data_snapshot,
            generatedAt: data.generated_at,
            errorMessage: null,
          });
          return true; // 完成，停止輪詢
        } else if (data.status === "failed") {
          setError(data.error_message || "報告產生失敗");
          return true; // 失敗，停止輪詢
        }
      }

      return false; // 繼續輪詢
    } catch (err) {
      console.error("Poll report status error:", err);
      return false;
    }
  }, []);

  // 輪詢 Effect
  useEffect(() => {
    if (!pollingReportId) return;

    pollCountRef.current = 0;

    const poll = async () => {
      pollCountRef.current += 1;

      const shouldStop = await pollReportStatus(pollingReportId);

      if (shouldStop || pollCountRef.current >= MAX_POLL_COUNT) {
        // 停止輪詢
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        setPollingReportId(null);
        setIsGenerating(false);

        if (pollCountRef.current >= MAX_POLL_COUNT) {
          setError("報告產生超時，請稍後重新查詢");
        }
      }
    };

    // 立即執行一次
    poll();

    // 設定輪詢
    pollIntervalRef.current = setInterval(poll, POLL_INTERVAL);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [pollingReportId, pollReportStatus]);

  // 取得最新報告
  const fetchLatestReport = useCallback(async () => {
    if (!accountId) {
      setReport(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      // 計算數據累積天數（從第一筆貼文開始算）
      const { data: firstPost } = await supabase
        .from("workspace_threads_posts")
        .select("published_at")
        .eq("workspace_threads_account_id", accountId)
        .order("published_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (firstPost?.published_at) {
        const firstDate = new Date(firstPost.published_at);
        const now = new Date();
        const ageDays = (now.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24);
        setDataAge(ageDays);
        setHasEnoughData(ageDays >= 1);
      } else {
        setDataAge(0);
        setHasEnoughData(false);
      }

      // 取得最新報告
      const { data, error: fetchError } = await supabase
        .from("ai_weekly_reports")
        .select("*")
        .eq("workspace_threads_account_id", accountId)
        .order("week_start", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchError) {
        throw new Error(fetchError.message);
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
      } else {
        setReport(null);
      }
    } catch (err) {
      console.error("Fetch weekly report error:", err);
      setError(err instanceof Error ? err.message : "取得報告失敗");
    } finally {
      setIsLoading(false);
    }
  }, [accountId]);

  // 產生報告
  const generateReport = useCallback(
    async (startDate?: string, endDate?: string) => {
      if (!accountId) {
        setError("請先選擇帳號");
        return;
      }

      setIsGenerating(true);
      setError(null);

      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();

        if (!session?.access_token) {
          throw new Error("請先登入");
        }

        const body: {
          accountId: string;
          weekStart?: string;
          weekEnd?: string;
          timezone: string;
        } = {
          accountId,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        };
        if (startDate) {
          body.weekStart = startDate;
        }
        if (endDate) {
          body.weekEnd = endDate;
        }

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/ai-weekly-report`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify(body),
          }
        );

        const result = await response.json();

        if (!response.ok) {
          if (result.code === "INSUFFICIENT_DATA") {
            setHasEnoughData(false);
          }
          throw new Error(result.error || "產生報告失敗");
        }

        if (result.status === "completed" && result.report) {
          // 同步模式完成（舊版 API 相容）
          setReport({
            id: result.reportId,
            weekStart: result.dataSnapshot?.period?.start || "",
            weekEnd: result.dataSnapshot?.period?.end || "",
            status: "completed",
            report: result.report,
            dataSnapshot: result.dataSnapshot || null,
            generatedAt: new Date().toISOString(),
            errorMessage: null,
          });
          setIsGenerating(false);
        } else if (result.status === "generating" && result.reportId) {
          // 非同步模式：開始輪詢
          setPollingReportId(result.reportId);
          // isGenerating 保持 true，由輪詢完成後設為 false
        } else {
          setIsGenerating(false);
        }
      } catch (err) {
        console.error("Generate weekly report error:", err);
        setError(err instanceof Error ? err.message : "產生報告失敗");
        setIsGenerating(false);
      }
    },
    [accountId]
  );

  // 取得歷史報告列表（排除已刪除的）
  const fetchReportHistory = useCallback(async () => {
    if (!accountId) {
      setHistory([]);
      return;
    }

    try {
      const supabase = createClient();

      // 查詢時排除已刪除的報告（deleted_at 為 NULL 或欄位不存在）
      const { data, error: fetchError } = await supabase
        .from("ai_weekly_reports")
        .select("id, week_start, week_end, status, generated_at, created_at, report_type, deleted_at")
        .eq("workspace_threads_account_id", accountId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (fetchError) {
        console.error("Fetch report history error:", fetchError.message || JSON.stringify(fetchError), fetchError.code);
        return;
      }

      // 過濾掉已刪除的報告
      const filteredData = (data || []).filter(item => !item.deleted_at);

      setHistory(
        filteredData.map((item) => ({
          id: item.id,
          weekStart: item.week_start,
          weekEnd: item.week_end,
          status: item.status,
          generatedAt: item.generated_at,
          createdAt: item.created_at,
          reportType: item.report_type || "insights",
        }))
      );
    } catch (err) {
      console.error("Fetch report history error:", err);
    }
  }, [accountId]);

  // 選擇特定報告
  const selectReport = useCallback(async (reportId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data, error: fetchError } = await supabase
        .from("ai_weekly_reports")
        .select("*")
        .eq("id", reportId)
        .single();

      if (fetchError) {
        throw new Error(fetchError.message);
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
      console.error("Select report error:", err);
      setError(err instanceof Error ? err.message : "取得報告失敗");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 軟刪除報告
  const deleteReport = useCallback(async (reportId: string) => {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("請先登入");
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/ai-weekly-report`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ reportId }),
        }
      );

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "刪除報告失敗");
      }

      // 刷新歷史列表
      fetchReportHistory();
    } catch (err) {
      console.error("Delete report error:", err);
      setError(err instanceof Error ? err.message : "刪除報告失敗");
    }
  }, [fetchReportHistory]);

  return {
    report,
    isLoading,
    isGenerating,
    error,
    hasEnoughData,
    dataAge,
    history,
    generateReport,
    fetchLatestReport,
    fetchReportHistory,
    selectReport,
    deleteReport,
  };
}
