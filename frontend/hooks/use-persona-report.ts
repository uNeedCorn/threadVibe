"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

// ============================================================================
// 報告內容類型定義（深度分析版本 v2）
// ============================================================================

export interface PersonaReportContent {
  // Part 1: 總覽
  executive_summary: {
    positioning: string;
    health_score: number;
    stage: {
      current: "building" | "growing" | "stable" | "influential";
      label: string;
      description: string;
    };
    core_bottleneck: {
      title: string;
      evidence: string[];
      implication: string;
    };
    breakthrough: {
      from_state: string;
      to_state: string;
      how: string;
    };
    top_action: string;
    strengths: string[];
    improvements: string[];
  };

  // Part 2: 你的形象
  persona_image: {
    tags: Array<{ tag: string; type: "primary" | "secondary" }>;
    style_spectrum: {
      professional_friendly: { value: number; label: string };
      educational_entertaining: { value: number; label: string };
      rational_emotional: { value: number; label: string };
    };
    perception_gap: {
      bio_claims: string[];
      content_shows: string[];
      mismatches: Array<{
        issue: string;
        in_bio: boolean;
        in_content: boolean;
        suggestion: string;
      }>;
      analysis: string;
    };
    uniqueness: {
      common_accounts: string[];
      your_differentiators: string[];
      positioning_suggestion: string;
    };
    bio_rewrite: {
      current: string;
      suggested: string;
      improvements: string[];
    };
  };

  // Part 3: 你的受眾
  audience_segments: Array<{
    name: string;
    percentage: number;
    description: string;
    why_follow: string[];
    journey: {
      distribution: {
        passerby: number;
        follower: number;
        engager: number;
        truster: number;
      };
      stuck_at: string;
      stuck_reasons: string[];
    };
    needs: {
      pain_points: Array<{
        title: string;
        urgency: "high" | "medium" | "low";
        satisfaction: number;
        content_gap?: string;
      }>;
      desires: Array<{
        title: string;
        satisfaction: number;
      }>;
    };
    advancement: {
      target: string;
      strategies: Array<{
        content_type: string;
        example: string;
        expected_effect: string;
      }>;
    };
  }>;

  // Part 4: 內容健檢
  content_health: {
    type_distribution: {
      current: Array<{ type: string; percentage: number }>;
      recommended: Array<{ type: string; percentage: number }>;
      issues: Array<{
        problem: string;
        detail: string;
        impact: string;
      }>;
    };
    stage_analysis: {
      content_serving: {
        attraction: number;
        retention: number;
        engagement: number;
        trust_building: number;
      };
      audience_at: {
        passerby: number;
        engager: number;
        truster: number;
        advocate: number;
      };
      gap_analysis: string;
      adjustment: string;
    };
    value_scores: Array<{
      dimension: string;
      score: number;
      interpretation: string;
    }>;
  };

  // Part 5: 行動清單
  action_plan: {
    priority_focus: string;
    immediate_actions: Array<{
      action: string;
      current_state?: string;
      target_state?: string;
      reason: string;
    }>;
    weekly_content: Array<{
      priority: number;
      content_type: string;
      solves_problem: string;
      topic: string;
      angle: string;
      hook_example: string;
      ending_cta?: string;
      expected_effects: string[];
      format: string;
    }>;
    monthly_plan: {
      weeks: Array<{
        week: number;
        content_type: string;
        topic: string;
      }>;
      purpose: string;
    };
  };
}

// ============================================================================
// 數據快照類型定義
// ============================================================================

export interface PersonaDataSnapshot {
  account: {
    username: string;
    name: string;
    bio: string;
    followers_count: number;
  };
  period: {
    start: string;
    end: string;
  };
  stats: {
    post_count: number;
    reply_count: number;
  };
}

// ============================================================================
// 報告類型（供 detail page 使用）
// ============================================================================

export interface PersonaReport {
  id: string;
  weekStart: string;
  weekEnd: string;
  status: "pending" | "generating" | "completed" | "failed";
  report: PersonaReportContent | null;
  dataSnapshot: PersonaDataSnapshot | null;
  generatedAt: string | null;
  errorMessage: string | null;
}

// 歷史報告項目（供 page.tsx 列表使用）
export interface PersonaReportHistoryItem {
  id: string;
  weekStart: string;
  weekEnd: string;
  status: "pending" | "generating" | "completed" | "failed";
  generatedAt: string | null;
  createdAt: string;
  reportType: string;
}

// 額度資訊
export interface PersonaQuotaInfo {
  remaining: number;
  total: number;
  nextResetAt: Date | null;
}

// ============================================================================
// Hook
// ============================================================================

interface GenerateOptions {
  startDate?: string;
  endDate?: string;
  model?: "sonnet" | "opus";
}

// 額度常數
const QUOTA_LIMIT = 5; // 每月可產生 5 份（所有報告共用）

// 計算本月 1 號 00:00（台北時間）
function getThisMonthStart(): Date {
  const now = new Date();
  const taipeiOffset = 8 * 60; // UTC+8
  const localOffset = now.getTimezoneOffset();
  const taipeiTime = new Date(now.getTime() + (taipeiOffset + localOffset) * 60 * 1000);

  const monthStart = new Date(taipeiTime);
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  return new Date(monthStart.getTime() - (taipeiOffset + localOffset) * 60 * 1000);
}

// 計算下月 1 號 00:00（台北時間）
function getNextMonthStart(): Date {
  const thisMonthStart = getThisMonthStart();
  const nextMonth = new Date(thisMonthStart);
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  return nextMonth;
}

export function usePersonaReport(accountId: string | null) {
  const supabase = createClient();
  const [report, setReport] = useState<PersonaReport | null>(null);
  const [history, setHistory] = useState<PersonaReportHistoryItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasEnoughData, setHasEnoughData] = useState(true);
  const [dataAge, setDataAge] = useState<number | null>(null);
  const [quota, setQuota] = useState<PersonaQuotaInfo>({
    remaining: QUOTA_LIMIT,
    total: QUOTA_LIMIT,
    nextResetAt: null,
  });
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const [pollingReportId, setPollingReportId] = useState<string | null>(null);

  // 取得報告歷史列表
  const fetchReportHistory = useCallback(async () => {
    if (!accountId) {
      setHistory([]);
      return;
    }

    try {
      const { data, error: fetchError } = await supabase
        .from("ai_weekly_reports")
        .select("id, week_start, week_end, status, generated_at, created_at, report_type, deleted_at")
        .eq("workspace_threads_account_id", accountId)
        .eq("report_type", "persona")
        .order("created_at", { ascending: false })
        .limit(20);

      if (fetchError) {
        console.error("Fetch report history error:", fetchError);
        return;
      }

      // 過濾已刪除
      const filteredData = (data || []).filter(item => !item.deleted_at);

      setHistory(
        filteredData.map((item) => ({
          id: item.id,
          weekStart: item.week_start,
          weekEnd: item.week_end,
          status: item.status,
          generatedAt: item.generated_at,
          createdAt: item.created_at,
          reportType: item.report_type || "persona",
        }))
      );

      // 計算額度（與其他報告共用，每月重置）
      const thisMonthStart = getThisMonthStart();

      const { data: allReports } = await supabase
        .from("ai_weekly_reports")
        .select("id, status, created_at")
        .eq("workspace_threads_account_id", accountId)
        .eq("status", "completed")
        .gte("created_at", thisMonthStart.toISOString());

      const completedCount = (allReports || []).length;
      const remaining = Math.max(0, QUOTA_LIMIT - completedCount);
      const nextResetAt = remaining === 0 ? getNextMonthStart() : null;

      setQuota({
        remaining,
        total: QUOTA_LIMIT,
        nextResetAt,
      });
    } catch (err) {
      console.error("Fetch report history error:", err);
    }
  }, [accountId, supabase]);

  // 輪詢報告狀態（使用 effect 而非 callback）
  useEffect(() => {
    if (!pollingReportId) return;

    const poll = async () => {
      try {
        const { data, error: pollError } = await supabase
          .from("ai_weekly_reports")
          .select("*")
          .eq("id", pollingReportId)
          .single();

        if (pollError) throw pollError;

        const reportData = {
          id: data.id,
          weekStart: data.week_start,
          weekEnd: data.week_end,
          status: data.status,
          report: data.report_content,
          dataSnapshot: data.data_snapshot,
          generatedAt: data.generated_at,
          errorMessage: data.error_message,
        } as PersonaReport;

        setReport(reportData);

        if (reportData.status === "completed" || reportData.status === "failed") {
          setIsGenerating(false);
          setPollingReportId(null);
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
          fetchReportHistory();
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    };

    // 立即執行一次
    poll();

    // 設定輪詢
    pollingRef.current = setInterval(poll, 3000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [pollingReportId, supabase, fetchReportHistory]);

  // 取得最新報告
  const fetchLatestReport = useCallback(async () => {
    if (!accountId) {
      setReport(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
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
        setHasEnoughData(ageDays >= 1); // persona report 只需 1 天
      } else {
        setDataAge(0);
        setHasEnoughData(false);
      }

      // 取得最新報告
      const { data, error: fetchError } = await supabase
        .from("ai_weekly_reports")
        .select("*")
        .eq("workspace_threads_account_id", accountId)
        .eq("report_type", "persona")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchError) throw fetchError;

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

        // 如果正在產生中，開始輪詢
        if (data.status === "generating") {
          setIsGenerating(true);
          setPollingReportId(data.id);
        }
      } else {
        setReport(null);
      }
    } catch (err) {
      console.error("Failed to fetch persona report:", err);
      setError("無法載入報告");
    } finally {
      setIsLoading(false);
    }
  }, [accountId, supabase]);

  // 產生報告
  const generateReport = useCallback(
    async (options?: GenerateOptions) => {
      if (!accountId || isGenerating) return null;

      setIsGenerating(true);
      setError(null);

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) throw new Error("未登入");

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/persona-report`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              accountId,
              startDate: options?.startDate,
              endDate: options?.endDate,
              model: options?.model || "sonnet",
            }),
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        const result = await response.json();

        if (result.reportId) {
          setPollingReportId(result.reportId);
          return result.reportId;
        }

        return null;
      } catch (err) {
        const message = err instanceof Error ? err.message : "產生報告失敗";
        setError(message);
        setIsGenerating(false);
        return null;
      }
    },
    [accountId, isGenerating, supabase]
  );

  // 刪除報告
  const deleteReport = useCallback(
    async (reportId: string) => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) throw new Error("未登入");

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/persona-report`,
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
          throw new Error("刪除失敗");
        }

        // 重新載入列表
        fetchReportHistory();
        return true;
      } catch (err) {
        console.error("Delete report error:", err);
        return false;
      }
    },
    [supabase, fetchReportHistory]
  );

  // 初始化
  useEffect(() => {
    if (accountId) {
      fetchLatestReport();
      fetchReportHistory();
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [accountId]);

  return {
    report,
    history,
    isGenerating,
    isLoading,
    error,
    hasEnoughData,
    dataAge,
    quota,
    generateReport,
    deleteReport,
    fetchLatestReport,
    fetchReportHistory,
  };
}
