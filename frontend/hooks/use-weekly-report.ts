"use client";

import { useState, useCallback } from "react";
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
}

// ============================================================================
// 額度類型
// ============================================================================

export interface MonthlyQuota {
  used: number;
  limit: number;
  remaining: number;
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
  monthlyQuota: MonthlyQuota | null;
  generateReport: (startDate?: string, endDate?: string) => Promise<void>;
  fetchLatestReport: () => Promise<void>;
  fetchReportHistory: () => Promise<void>;
  selectReport: (reportId: string) => Promise<void>;
  fetchMonthlyQuota: () => Promise<void>;
}

const MONTHLY_LIMIT = 5;

export function useWeeklyReport(accountId: string | null): UseWeeklyReportReturn {
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasEnoughData, setHasEnoughData] = useState(true);
  const [dataAge, setDataAge] = useState<number | null>(null);
  const [history, setHistory] = useState<ReportHistoryItem[]>([]);
  const [monthlyQuota, setMonthlyQuota] = useState<MonthlyQuota | null>(null);

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

      // 測試期間跳過前端數據檢查，讓後端處理
      setDataAge(null);
      setHasEnoughData(true);

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
          if (result.code === "MONTHLY_LIMIT_REACHED") {
            // 刷新額度顯示
            setMonthlyQuota({
              used: MONTHLY_LIMIT,
              limit: MONTHLY_LIMIT,
              remaining: 0,
            });
          }
          throw new Error(result.error || "產生報告失敗");
        }

        if (result.status === "completed" && result.report) {
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
          // 更新額度（使用量 +1）
          setMonthlyQuota((prev) =>
            prev
              ? {
                  ...prev,
                  used: prev.used + 1,
                  remaining: Math.max(0, prev.remaining - 1),
                }
              : null
          );
        } else if (result.status === "generating") {
          // 報告正在產生中，稍後重新查詢
          setReport((prev) => prev ? { ...prev, status: "generating" } : null);
        }
      } catch (err) {
        console.error("Generate weekly report error:", err);
        setError(err instanceof Error ? err.message : "產生報告失敗");
      } finally {
        setIsGenerating(false);
      }
    },
    [accountId]
  );

  // 取得歷史報告列表
  const fetchReportHistory = useCallback(async () => {
    if (!accountId) {
      setHistory([]);
      return;
    }

    try {
      const supabase = createClient();
      const { data, error: fetchError } = await supabase
        .from("ai_weekly_reports")
        .select("id, week_start, week_end, status, generated_at, created_at")
        .eq("workspace_threads_account_id", accountId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (fetchError) {
        console.error("Fetch report history error:", fetchError);
        return;
      }

      setHistory(
        (data || []).map((item) => ({
          id: item.id,
          weekStart: item.week_start,
          weekEnd: item.week_end,
          status: item.status,
          generatedAt: item.generated_at,
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

  // 取得本月額度
  const fetchMonthlyQuota = useCallback(async () => {
    if (!accountId) {
      setMonthlyQuota(null);
      return;
    }

    try {
      const supabase = createClient();
      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        .toISOString()
        .split("T")[0];

      const { count, error: countError } = await supabase
        .from("ai_weekly_reports")
        .select("id", { count: "exact", head: true })
        .eq("workspace_threads_account_id", accountId)
        .gte("created_at", `${thisMonthStart}T00:00:00Z`);

      if (countError) {
        console.error("Fetch monthly quota error:", countError);
        return;
      }

      const used = count || 0;
      setMonthlyQuota({
        used,
        limit: MONTHLY_LIMIT,
        remaining: Math.max(0, MONTHLY_LIMIT - used),
      });
    } catch (err) {
      console.error("Fetch monthly quota error:", err);
    }
  }, [accountId]);

  return {
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
  };
}
