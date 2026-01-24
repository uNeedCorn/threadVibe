"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

// ============================================================================
// 報告內容類型定義
// ============================================================================

export interface ContentPatternReportContent {
  executive_summary: {
    content_health_score: number;
    headline: string;
    key_findings: string[];
    quick_wins: string[];
  };
  media_type_analysis: {
    summary: string;
    insights: string[];
    recommendation: string;
  };
  length_analysis: {
    summary: string;
    insights: string[];
    optimal_range: string;
  };
  feature_analysis: {
    emoji: { insight: string; recommendation: string };
    hashtag: { insight: string; recommendation: string };
    question: { insight: string; recommendation: string };
    cta: { insight: string; recommendation: string };
  };
  ai_tag_analysis: {
    summary: string;
    top_performing_combination: string;
    insights: string[];
  };
  timing_analysis: {
    summary: string;
    best_slots: string[];
    insights: string[];
  };
  success_formula: {
    pattern: string;
    examples: string[];
    why_it_works: string;
  };
  failure_warning: {
    patterns_to_avoid: string[];
    common_mistakes: string[];
  };
  throttling_warning?: {
    has_risk: boolean;
    summary: string;
    affected_examples: string[];
    recommendations: string[];
  };
  user_tag_analysis?: {
    summary: string;
    insights: string[];
    recommendations: string[];
  };
}

// ============================================================================
// 數據快照類型定義
// ============================================================================

export interface FeatureStats {
  count: number;
  avg_views: number;
  avg_engagement_rate: number;
  avg_replies: number;
}

export interface TagStats {
  tag: string;
  count: number;
  avg_views: number;
  avg_engagement_rate: number;
  rank: number;
}

export interface PostSummary {
  id: string;
  text: string;
  views: number;
  engagement_rate: number;
  media_type: string;
  char_count: number;
  features: string[];
  published_at: string;
}

export interface ContentPatternSnapshot {
  account: {
    username: string;
    name: string;
    followers_count: number;
  };
  analysis_period: {
    days: number;
    start: string;
    end: string;
    total_posts: number;
  };
  overall_avg: {
    views: number;
    engagement_rate: number;
    virality_score: number;
  };
  media_type: Array<{
    type: string;
    count: number;
    avg_views: number;
    avg_engagement_rate: number;
    avg_virality_score: number;
    vs_average: number;
  }>;
  content_length: Array<{
    range: string;
    min: number;
    max: number;
    count: number;
    avg_views: number;
    avg_engagement_rate: number;
    vs_average: number;
  }>;
  content_features: {
    emoji: {
      with: FeatureStats;
      without: FeatureStats;
      optimal_count: number | null;
    };
    hashtag: {
      with: FeatureStats;
      without: FeatureStats;
      optimal_count: number | null;
    };
    link: {
      with: FeatureStats;
      without: FeatureStats;
    };
    question: {
      with: FeatureStats;
      without: FeatureStats;
      best_type: string | null;
    };
    cta: {
      with: FeatureStats;
      without: FeatureStats;
      best_type: string | null;
    };
  };
  ai_tags: {
    content_type: TagStats[];
    tone: TagStats[];
    intent: TagStats[];
    topic: TagStats[];
    format: TagStats[];
  };
  user_tags?: Array<{
    name: string;
    color: string;
    count: number;
    avg_views: number;
    avg_engagement_rate: number;
  }>;
  timing: {
    best_hours: number[];
    best_days: number[];
    heatmap: Array<{ day: number; hour: number; count: number; avg_engagement: number }>;
  };
  success_patterns: {
    top_posts: PostSummary[];
    common_features: string[];
    formula: string;
  };
  failure_patterns: {
    bottom_posts: PostSummary[];
    common_issues: string[];
    avoid: string[];
  };
  throttling_analysis?: {
    has_risk: boolean;
    viral_posts_count: number;
    potentially_throttled_count: number;
    affected_posts: Array<{
      viral_post: PostSummary & { vfr?: number };
      following_posts: Array<PostSummary & { hours_after: number; vfr?: number }>;
    }>;
    avg_drop_rate: number;
    baseline_vfr?: number;
    followers_count?: number;
  };
}

// ============================================================================
// 報告類型
// ============================================================================

export interface ContentPatternReport {
  id: string;
  weekStart: string;
  weekEnd: string;
  status: "pending" | "generating" | "completed" | "failed";
  report: ContentPatternReportContent | null;
  dataSnapshot: ContentPatternSnapshot | null;
  generatedAt: string | null;
  errorMessage: string | null;
}

export interface ContentPatternReportHistoryItem {
  id: string;
  weekStart: string;
  weekEnd: string;
  status: "pending" | "generating" | "completed" | "failed";
  generatedAt: string | null;
  createdAt: string;
}

// ============================================================================
// Hook
// ============================================================================

// 額度資訊
export interface QuotaInfo {
  remaining: number;
  total: number;
  nextResetAt: Date | null;
}

export interface GenerateReportOptions {
  startDate?: string; // YYYY-MM-DD 格式
  endDate?: string;   // YYYY-MM-DD 格式
}

interface UseContentPatternReportReturn {
  report: ContentPatternReport | null;
  isLoading: boolean;
  isGenerating: boolean;
  error: string | null;
  hasEnoughData: boolean;
  dataAge: number | null;
  history: ContentPatternReportHistoryItem[];
  quota: QuotaInfo;
  generateReport: (options?: GenerateReportOptions) => Promise<void>;
  fetchLatestReport: () => Promise<void>;
  fetchReportHistory: () => Promise<void>;
  selectReport: (reportId: string) => Promise<void>;
  deleteReport: (reportId: string) => Promise<void>;
}

// 輪詢間隔（毫秒）
const POLL_INTERVAL = 3000;
// 最大輪詢次數（3 秒 x 60 = 3 分鐘）
const MAX_POLL_COUNT = 60;

// 額度常數
const QUOTA_LIMIT = 2; // 每週可產生 2 份（兩種報告共用）

// 計算本週一 00:00（台北時間）
function getThisMonday(): Date {
  const now = new Date();
  // 轉換為台北時間
  const taipeiOffset = 8 * 60; // UTC+8
  const localOffset = now.getTimezoneOffset();
  const taipeiTime = new Date(now.getTime() + (taipeiOffset + localOffset) * 60 * 1000);

  const day = taipeiTime.getDay(); // 0 = Sunday, 1 = Monday, ...
  const diff = day === 0 ? 6 : day - 1; // 計算距離週一的天數

  const monday = new Date(taipeiTime);
  monday.setDate(taipeiTime.getDate() - diff);
  monday.setHours(0, 0, 0, 0);

  // 轉回 UTC
  return new Date(monday.getTime() - (taipeiOffset + localOffset) * 60 * 1000);
}

// 計算下週一 00:00（台北時間）
function getNextMonday(): Date {
  const thisMonday = getThisMonday();
  return new Date(thisMonday.getTime() + 7 * 24 * 60 * 60 * 1000);
}

export function useContentPatternReport(accountId: string | null): UseContentPatternReportReturn {
  const [report, setReport] = useState<ContentPatternReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasEnoughData, setHasEnoughData] = useState(true);
  const [dataAge, setDataAge] = useState<number | null>(null);
  const [history, setHistory] = useState<ContentPatternReportHistoryItem[]>([]);
  const [quota, setQuota] = useState<QuotaInfo>({
    remaining: QUOTA_LIMIT,
    total: QUOTA_LIMIT,
    nextResetAt: null,
  });

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
        .eq("report_type", "content")
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
          return true;
        } else if (data.status === "failed") {
          setError(data.error_message || "報告產生失敗");
          return true;
        }
      }

      return false;
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

    poll();
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

      // 計算數據累積天數
      const { data: account } = await supabase
        .from("workspace_threads_accounts")
        .select("created_at")
        .eq("id", accountId)
        .single();

      if (account?.created_at) {
        const connectedDate = new Date(account.created_at);
        const now = new Date();
        const ageDays = (now.getTime() - connectedDate.getTime()) / (1000 * 60 * 60 * 24);
        setDataAge(ageDays);
        setHasEnoughData(ageDays >= 7); // 內容模式報告需要更多數據
      } else {
        setDataAge(0);
        setHasEnoughData(false);
      }

      // 取得最新報告
      const { data, error: fetchError } = await supabase
        .from("ai_weekly_reports")
        .select("*")
        .eq("workspace_threads_account_id", accountId)
        .eq("report_type", "content")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
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
      console.error("Fetch content pattern report error:", err);
      setError(err instanceof Error ? err.message : "取得報告失敗");
    } finally {
      setIsLoading(false);
    }
  }, [accountId]);

  // 產生報告
  const generateReport = useCallback(async (options?: GenerateReportOptions) => {
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

      // 取得使用者時區
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Taipei";

      // 組合請求 body
      const requestBody: {
        accountId: string;
        timezone: string;
        startDate?: string;
        endDate?: string;
      } = { accountId, timezone };

      if (options?.startDate) {
        requestBody.startDate = options.startDate;
      }
      if (options?.endDate) {
        requestBody.endDate = options.endDate;
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/content-pattern-report`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(requestBody),
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
        setReport({
          id: result.reportId,
          weekStart: result.dataSnapshot?.analysis_period?.start || "",
          weekEnd: result.dataSnapshot?.analysis_period?.end || "",
          status: "completed",
          report: result.report,
          dataSnapshot: result.dataSnapshot || null,
          generatedAt: new Date().toISOString(),
          errorMessage: null,
        });
        setIsGenerating(false);
      } else if (result.status === "generating" && result.reportId) {
        setPollingReportId(result.reportId);
      } else {
        setIsGenerating(false);
      }
    } catch (err) {
      console.error("Generate content pattern report error:", err);
      setError(err instanceof Error ? err.message : "產生報告失敗");
      setIsGenerating(false);
    }
  }, [accountId]);

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
        .select("id, week_start, week_end, status, generated_at, created_at, deleted_at")
        .eq("workspace_threads_account_id", accountId)
        .eq("report_type", "content")
        .order("created_at", { ascending: false })
        .limit(20);

      if (fetchError) {
        console.error("Fetch report history error:", fetchError);
        return;
      }

      // 過濾已刪除的報告
      const filteredData = (data || []).filter(item => !item.deleted_at);

      setHistory(
        filteredData.map((item) => ({
          id: item.id,
          weekStart: item.week_start,
          weekEnd: item.week_end,
          status: item.status,
          generatedAt: item.generated_at,
          createdAt: item.created_at,
        }))
      );

      // 計算額度資訊（每週一重置，兩種報告共用 2 點）
      // 需要查詢「所有類型」的報告來計算共用配額
      const thisMonday = getThisMonday();

      const { data: allReports } = await supabase
        .from("ai_weekly_reports")
        .select("id, status, created_at")
        .eq("workspace_threads_account_id", accountId)
        .eq("status", "completed")
        .gte("created_at", thisMonday.toISOString());

      const completedCount = (allReports || []).length;
      const remaining = Math.max(0, QUOTA_LIMIT - completedCount);

      // 下次重置時間 = 下週一 00:00（台北時間）
      const nextResetAt = remaining === 0 ? getNextMonday() : null;

      setQuota({
        remaining,
        total: QUOTA_LIMIT,
        nextResetAt,
      });
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
        .eq("report_type", "content")
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
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/content-pattern-report`,
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
    quota,
    generateReport,
    fetchLatestReport,
    fetchReportHistory,
    selectReport,
    deleteReport,
  };
}
