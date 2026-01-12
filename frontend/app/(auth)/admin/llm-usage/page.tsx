"use client";

import { useState, useEffect, useCallback } from "react";
import { Coins, TrendingUp, Calendar, Loader2, RefreshCw, Building2, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AdminOnly } from "@/components/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Gemini 定價 (per 1M tokens)
const GEMINI_PRICING = {
  "gemini-2.0-flash": {
    input: 0.10,
    output: 0.40,
  },
  "gemini-1.5-flash": {
    input: 0.075,
    output: 0.30,
  },
  "gemini-1.5-pro": {
    input: 1.25,
    output: 5.00,
  },
} as const;

type ModelName = keyof typeof GEMINI_PRICING;

interface UsageStats {
  model_name: string;
  purpose: string;
  call_count: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_tokens: number;
}

interface DailyUsage {
  date: string;
  model_name: string;
  call_count: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_tokens: number;
}

interface WorkspaceUsage {
  workspace_id: string;
  workspace_name: string;
  account_id: string | null;
  account_username: string | null;
  model_name: string;
  purpose: string;
  call_count: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_tokens: number;
}

function calculateCost(modelName: string, inputTokens: number, outputTokens: number): number {
  const pricing = GEMINI_PRICING[modelName as ModelName];
  if (!pricing) return 0;
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  return inputCost + outputCost;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(amount);
}

function formatNumber(num: number): string {
  return new Intl.NumberFormat("zh-TW").format(num);
}

// 取得預設日期範圍（最近 30 天）
function getDefaultDateRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  return {
    start: start.toISOString().split("T")[0],
    end: end.toISOString().split("T")[0],
  };
}

export default function LlmUsagePage() {
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<UsageStats[]>([]);
  const [dailyUsage, setDailyUsage] = useState<DailyUsage[]>([]);
  const [workspaceUsage, setWorkspaceUsage] = useState<WorkspaceUsage[]>([]);

  const defaultRange = getDefaultDateRange();
  const [startDate, setStartDate] = useState(defaultRange.start);
  const [endDate, setEndDate] = useState(defaultRange.end);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    const supabase = createClient();

    // 轉換日期為 ISO 格式
    const startISO = startDate ? new Date(startDate).toISOString() : null;
    const endISO = endDate ? new Date(endDate + "T23:59:59").toISOString() : null;

    try {
      // 並行請求所有數據
      const [statsRes, dailyRes, workspaceRes] = await Promise.all([
        supabase.rpc("get_llm_usage_stats", {
          start_date: startISO,
          end_date: endISO,
        }),
        supabase.rpc("get_llm_daily_usage", {
          start_date: startISO,
          end_date: endISO,
        }),
        supabase.rpc("get_llm_usage_by_workspace", {
          start_date: startISO,
          end_date: endISO,
        }),
      ]);

      if (statsRes.data) setStats(statsRes.data);
      if (dailyRes.data) setDailyUsage(dailyRes.data);
      if (workspaceRes.data) setWorkspaceUsage(workspaceRes.data);
    } catch (error) {
      console.error("Failed to fetch LLM usage:", error);
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 計算總費用
  const totalCost = stats.reduce((sum, stat) => {
    return sum + calculateCost(stat.model_name, stat.total_input_tokens, stat.total_output_tokens);
  }, 0);

  const totalTokens = stats.reduce((sum, stat) => sum + stat.total_tokens, 0);
  const totalCalls = stats.reduce((sum, stat) => sum + stat.call_count, 0);

  return (
    <AdminOnly>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">LLM 費用統計</h1>
            <p className="text-muted-foreground">
              Gemini API 使用量與費用追蹤
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={isLoading}>
            <RefreshCw className={`mr-2 size-4 ${isLoading ? "animate-spin" : ""}`} />
            重新整理
          </Button>
        </div>

        {/* 日期篩選 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">日期範圍</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-2">
                <Label>開始日期</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-40"
                />
              </div>
              <div className="space-y-2">
                <Label>結束日期</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-40"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const range = getDefaultDateRange();
                    setStartDate(range.start);
                    setEndDate(range.end);
                  }}
                >
                  最近 30 天
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const end = new Date();
                    const start = new Date();
                    start.setDate(start.getDate() - 7);
                    setStartDate(start.toISOString().split("T")[0]);
                    setEndDate(end.toISOString().split("T")[0]);
                  }}
                >
                  最近 7 天
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const now = new Date();
                    const start = new Date(now.getFullYear(), now.getMonth(), 1);
                    setStartDate(start.toISOString().split("T")[0]);
                    setEndDate(now.toISOString().split("T")[0]);
                  }}
                >
                  本月
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* 總覽卡片 */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">總費用</CardTitle>
                  <Coins className="size-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(totalCost)}</div>
                  <p className="text-xs text-muted-foreground">
                    基於 Gemini API 定價計算
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">總 Token 數</CardTitle>
                  <TrendingUp className="size-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatNumber(totalTokens)}</div>
                  <p className="text-xs text-muted-foreground">
                    Input + Output tokens
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">API 呼叫次數</CardTitle>
                  <Calendar className="size-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatNumber(totalCalls)}</div>
                  <p className="text-xs text-muted-foreground">
                    總請求數
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* 工作區/帳號明細 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="size-5" />
                  工作區 / 帳號明細
                </CardTitle>
                <CardDescription>依工作區與帳號分類的使用量</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>工作區</TableHead>
                      <TableHead>帳號</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead>用途</TableHead>
                      <TableHead className="text-right">呼叫次數</TableHead>
                      <TableHead className="text-right">Total Tokens</TableHead>
                      <TableHead className="text-right">費用</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {workspaceUsage.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground">
                          該期間無使用記錄
                        </TableCell>
                      </TableRow>
                    ) : (
                      workspaceUsage.map((item, index) => {
                        const cost = calculateCost(item.model_name, item.total_input_tokens, item.total_output_tokens);
                        return (
                          <TableRow key={index}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Building2 className="size-4 text-muted-foreground" />
                                {item.workspace_name || "-"}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <User className="size-4 text-muted-foreground" />
                                {item.account_username ? `@${item.account_username}` : "-"}
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-sm">{item.model_name}</TableCell>
                            <TableCell>{item.purpose}</TableCell>
                            <TableCell className="text-right">{formatNumber(item.call_count)}</TableCell>
                            <TableCell className="text-right">{formatNumber(item.total_tokens)}</TableCell>
                            <TableCell className="text-right font-medium">{formatCurrency(cost)}</TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* 用途分類統計 */}
            <Card>
              <CardHeader>
                <CardTitle>用途分類統計</CardTitle>
                <CardDescription>依 Model 與用途分類的使用量</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Model</TableHead>
                      <TableHead>用途</TableHead>
                      <TableHead className="text-right">呼叫次數</TableHead>
                      <TableHead className="text-right">Input Tokens</TableHead>
                      <TableHead className="text-right">Output Tokens</TableHead>
                      <TableHead className="text-right">費用</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                          該期間無使用記錄
                        </TableCell>
                      </TableRow>
                    ) : (
                      stats.map((stat, index) => {
                        const cost = calculateCost(stat.model_name, stat.total_input_tokens, stat.total_output_tokens);
                        return (
                          <TableRow key={index}>
                            <TableCell className="font-mono text-sm">{stat.model_name}</TableCell>
                            <TableCell>{stat.purpose}</TableCell>
                            <TableCell className="text-right">{formatNumber(stat.call_count)}</TableCell>
                            <TableCell className="text-right">{formatNumber(stat.total_input_tokens)}</TableCell>
                            <TableCell className="text-right">{formatNumber(stat.total_output_tokens)}</TableCell>
                            <TableCell className="text-right font-medium">{formatCurrency(cost)}</TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* 每日統計 */}
            <Card>
              <CardHeader>
                <CardTitle>每日使用量</CardTitle>
                <CardDescription>依日期分類的使用量趨勢</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>日期</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead className="text-right">呼叫次數</TableHead>
                      <TableHead className="text-right">Total Tokens</TableHead>
                      <TableHead className="text-right">費用</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dailyUsage.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          該期間無使用記錄
                        </TableCell>
                      </TableRow>
                    ) : (
                      dailyUsage.map((day, index) => {
                        const cost = calculateCost(day.model_name, day.total_input_tokens, day.total_output_tokens);
                        return (
                          <TableRow key={index}>
                            <TableCell>{day.date}</TableCell>
                            <TableCell className="font-mono text-sm">{day.model_name}</TableCell>
                            <TableCell className="text-right">{formatNumber(day.call_count)}</TableCell>
                            <TableCell className="text-right">{formatNumber(day.total_tokens)}</TableCell>
                            <TableCell className="text-right font-medium">{formatCurrency(cost)}</TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* 定價說明 */}
            <Card>
              <CardHeader>
                <CardTitle>Gemini API 定價參考</CardTitle>
                <CardDescription>Per 1M tokens</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Model</TableHead>
                      <TableHead className="text-right">Input</TableHead>
                      <TableHead className="text-right">Output</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(GEMINI_PRICING).map(([model, pricing]) => (
                      <TableRow key={model}>
                        <TableCell className="font-mono text-sm">{model}</TableCell>
                        <TableCell className="text-right">${pricing.input.toFixed(3)}</TableCell>
                        <TableCell className="text-right">${pricing.output.toFixed(3)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AdminOnly>
  );
}
