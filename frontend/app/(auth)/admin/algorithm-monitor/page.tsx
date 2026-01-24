"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Activity,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  Loader2,
  Users,
  Eye,
  FileText,
  CheckCircle2,
  AlertCircle,
  XCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AdminOnly } from "@/components/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

// ============ Types ============

type QuotaStatus = "healthy" | "caution" | "warning" | "throttled";
type AnomalySignal = "normal" | "partial_drop" | "algorithm_change";

interface VfrTrendPoint {
  date: string;
  accountCount: number;
  postCount: number;
  avgVfr: number;
  maxVfr: number;
  medianVfr: number;
}

interface AccountQuotaStatus {
  workspaceName: string;
  username: string;
  followers: number;
  postCount7d: number;
  totalViews7d: number;
  cumulativeVfr7d: number;
  quotaStatus: QuotaStatus;
  quotaPct: number;
}

interface AnomalySignalPoint {
  date: string;
  totalAccounts: number;
  accountsDropped: number;
  avgChangePct: number | null;
  avgVfr: number;
  signal: AnomalySignal;
  signalLabel: string;
}

interface CliffEvent {
  username: string;
  postDate: string;
  vfr: number;
  cumulativeVfrBefore: number;
  accountAvgVfr: number;
  dropRatio: number;
}

interface ThresholdAnalysis {
  cliffEvents: CliffEvent[];
  estimatedThreshold: number | null;
  thresholdConfidence: "low" | "medium" | "high";
  thresholdRange: { min: number; max: number } | null;
  sampleSize: number;
  analysisNote: string;
}

interface AlgorithmMonitorResponse {
  vfrTrend: VfrTrendPoint[];
  quotaStatus: AccountQuotaStatus[];
  anomalySignals: AnomalySignalPoint[];
  thresholdAnalysis: ThresholdAnalysis;
  generatedAt: string;
}

// ============ Helper Functions ============

function formatNumber(num: number): string {
  return new Intl.NumberFormat("zh-TW").format(num);
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function getQuotaStatusBadge(status: QuotaStatus) {
  switch (status) {
    case "healthy":
      return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">✅ 健康</Badge>;
    case "caution":
      return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">🟡 謹慎</Badge>;
    case "warning":
      return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">⚠️ 高風險</Badge>;
    case "throttled":
      return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">🔴 限流中</Badge>;
  }
}

function getSignalIcon(signal: AnomalySignal) {
  switch (signal) {
    case "normal":
      return <CheckCircle2 className="size-4 text-green-500" />;
    case "partial_drop":
      return <AlertCircle className="size-4 text-yellow-500" />;
    case "algorithm_change":
      return <XCircle className="size-4 text-red-500" />;
  }
}

// ============ Component ============

export default function AlgorithmMonitorPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AlgorithmMonitorResponse | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        setError("未登入");
        return;
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/algorithm-monitor`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result: AlgorithmMonitorResponse = await response.json();
      setData(result);
    } catch (err) {
      console.error("Failed to fetch algorithm monitor data:", err);
      setError(err instanceof Error ? err.message : "載入失敗");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 計算摘要數據
  const summary = data ? {
    totalAccounts: data.quotaStatus.length,
    healthyCount: data.quotaStatus.filter(a => a.quotaStatus === "healthy").length,
    warningCount: data.quotaStatus.filter(a => a.quotaStatus === "warning" || a.quotaStatus === "throttled").length,
    recentAlerts: data.anomalySignals.filter(s => s.signal === "algorithm_change").length,
  } : null;

  // 準備圖表數據（反轉順序讓時間從左到右）
  const chartData = data?.vfrTrend ? [...data.vfrTrend].reverse().map(point => ({
    ...point,
    date: formatDate(point.date),
  })) : [];

  return (
    <AdminOnly>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">演算法健康監測</h1>
            <p className="text-muted-foreground">
              監測 Threads 演算法變動與帳號限流風險
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={isLoading}>
            <RefreshCw className={`mr-2 size-4 ${isLoading ? "animate-spin" : ""}`} />
            重新整理
          </Button>
        </div>

        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <p className="text-red-700">{error}</p>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        ) : data && (
          <>
            {/* 總覽卡片 */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">監測帳號</CardTitle>
                  <Users className="size-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{summary?.totalAccounts}</div>
                  <p className="text-xs text-muted-foreground">活躍帳號數</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">健康狀態</CardTitle>
                  <Activity className="size-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{summary?.healthyCount}</div>
                  <p className="text-xs text-muted-foreground">Quota 健康的帳號</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">風險帳號</CardTitle>
                  <AlertTriangle className="size-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600">{summary?.warningCount}</div>
                  <p className="text-xs text-muted-foreground">需要關注的帳號</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">異常信號</CardTitle>
                  <TrendingUp className="size-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{summary?.recentAlerts}</div>
                  <p className="text-xs text-muted-foreground">14 天內疑似演算法變動</p>
                </CardContent>
              </Card>
            </div>

            {/* VFR 趨勢圖 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="size-5" />
                  全帳號 VFR 趨勢（30 天）
                </CardTitle>
                <CardDescription>
                  追蹤整體 VFR 變化，偵測演算法波動
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 12 }}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#ffffff",
                          border: "1px solid #e5e7eb",
                          borderRadius: "8px",
                        }}
                        formatter={(value: number, name: string) => {
                          const labels: Record<string, string> = {
                            avgVfr: "平均 VFR",
                            maxVfr: "最高 VFR",
                            medianVfr: "中位數 VFR",
                          };
                          return [value.toFixed(1), labels[name] || name];
                        }}
                      />
                      <Legend
                        formatter={(value) => {
                          const labels: Record<string, string> = {
                            avgVfr: "平均",
                            maxVfr: "最高",
                            medianVfr: "中位數",
                          };
                          return labels[value] || value;
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="avgVfr"
                        stroke="#2563eb"
                        strokeWidth={2}
                        dot={{ r: 3, fill: "#2563eb" }}
                        activeDot={{ r: 5 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="maxVfr"
                        stroke="#dc2626"
                        strokeWidth={1}
                        strokeDasharray="5 5"
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="medianVfr"
                        stroke="#6b7280"
                        strokeWidth={1}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* 帳號 Quota 狀態 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="size-5" />
                  各帳號 Quota 狀態（7 天累計）
                </CardTitle>
                <CardDescription>
                  累計 VFR 閾值：&lt;200 健康 | 200-500 謹慎 | 500-900 高風險 | &gt;900 限流
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>工作區</TableHead>
                      <TableHead>帳號</TableHead>
                      <TableHead className="text-right">粉絲數</TableHead>
                      <TableHead className="text-right">7日貼文</TableHead>
                      <TableHead className="text-right">7日曝光</TableHead>
                      <TableHead className="text-right">累計 VFR</TableHead>
                      <TableHead className="text-right">Quota %</TableHead>
                      <TableHead>狀態</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.quotaStatus.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground">
                          無帳號資料
                        </TableCell>
                      </TableRow>
                    ) : (
                      data.quotaStatus.map((account, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{account.workspaceName}</TableCell>
                          <TableCell>@{account.username}</TableCell>
                          <TableCell className="text-right">{formatNumber(account.followers)}</TableCell>
                          <TableCell className="text-right">{account.postCount7d}</TableCell>
                          <TableCell className="text-right">{formatNumber(account.totalViews7d)}</TableCell>
                          <TableCell className="text-right font-mono">{account.cumulativeVfr7d.toFixed(1)}</TableCell>
                          <TableCell className="text-right">
                            <span className={
                              account.quotaPct > 100 ? "text-red-600 font-bold" :
                              account.quotaPct > 60 ? "text-orange-600" :
                              "text-muted-foreground"
                            }>
                              {account.quotaPct.toFixed(0)}%
                            </span>
                          </TableCell>
                          <TableCell>{getQuotaStatusBadge(account.quotaStatus)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* 異常偵測時間軸 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="size-5" />
                  異常偵測時間軸（14 天）
                </CardTitle>
                <CardDescription>
                  偵測多帳號同時下降，判斷是否為演算法變動
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>日期</TableHead>
                      <TableHead className="text-right">帳號數</TableHead>
                      <TableHead className="text-right">下降數</TableHead>
                      <TableHead className="text-right">平均變化</TableHead>
                      <TableHead className="text-right">平均 VFR</TableHead>
                      <TableHead>信號</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.anomalySignals.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                          無異常偵測資料
                        </TableCell>
                      </TableRow>
                    ) : (
                      data.anomalySignals.map((signal, index) => (
                        <TableRow key={index} className={
                          signal.signal === "algorithm_change" ? "bg-red-50" :
                          signal.signal === "partial_drop" ? "bg-yellow-50" : ""
                        }>
                          <TableCell className="font-medium">{signal.date}</TableCell>
                          <TableCell className="text-right">{signal.totalAccounts}</TableCell>
                          <TableCell className="text-right">{signal.accountsDropped}</TableCell>
                          <TableCell className="text-right">
                            <span className={
                              signal.avgChangePct !== null && signal.avgChangePct < -30 ? "text-red-600" :
                              signal.avgChangePct !== null && signal.avgChangePct > 30 ? "text-green-600" :
                              ""
                            }>
                              {signal.avgChangePct !== null ? `${signal.avgChangePct > 0 ? "+" : ""}${signal.avgChangePct.toFixed(1)}%` : "-"}
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-mono">{signal.avgVfr.toFixed(1)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getSignalIcon(signal.signal)}
                              <span className={
                                signal.signal === "algorithm_change" ? "text-red-700 font-medium" :
                                signal.signal === "partial_drop" ? "text-yellow-700" :
                                "text-green-700"
                              }>
                                {signal.signalLabel}
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* 門檻分析結果 */}
            <Card className="border-purple-200 bg-purple-50/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="size-5 text-purple-600" />
                  <span className="text-purple-900">門檻分析結果（Cliff Detection）</span>
                </CardTitle>
                <CardDescription>
                  {data.thresholdAnalysis.analysisNote}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 估計門檻摘要 */}
                {data.thresholdAnalysis.estimatedThreshold !== null ? (
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-lg border border-purple-200 bg-white p-4 text-center">
                      <p className="text-xs text-muted-foreground mb-1">推估門檻</p>
                      <p className="text-3xl font-bold text-purple-700">
                        {data.thresholdAnalysis.estimatedThreshold}
                      </p>
                      <p className="text-xs text-muted-foreground">7 天累計 VFR</p>
                    </div>
                    <div className="rounded-lg border border-purple-200 bg-white p-4 text-center">
                      <p className="text-xs text-muted-foreground mb-1">門檻範圍</p>
                      <p className="text-2xl font-bold text-purple-700">
                        {data.thresholdAnalysis.thresholdRange?.min} - {data.thresholdAnalysis.thresholdRange?.max}
                      </p>
                      <p className="text-xs text-muted-foreground">最小 - 最大</p>
                    </div>
                    <div className="rounded-lg border border-purple-200 bg-white p-4 text-center">
                      <p className="text-xs text-muted-foreground mb-1">置信度</p>
                      <p className={`text-2xl font-bold ${
                        data.thresholdAnalysis.thresholdConfidence === "high" ? "text-green-600" :
                        data.thresholdAnalysis.thresholdConfidence === "medium" ? "text-yellow-600" :
                        "text-gray-500"
                      }`}>
                        {data.thresholdAnalysis.thresholdConfidence === "high" ? "🟢 高" :
                         data.thresholdAnalysis.thresholdConfidence === "medium" ? "🟡 中" :
                         "⚪ 低"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        基於 {data.thresholdAnalysis.sampleSize} 個樣本
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center">
                    <p className="text-gray-500">⚪ 尚無足夠資料推估門檻</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      樣本數：{data.thresholdAnalysis.sampleSize}
                    </p>
                  </div>
                )}

                {/* 懸崖事件列表 */}
                {data.thresholdAnalysis.cliffEvents.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2 text-purple-900">
                      懸崖事件（VFR 驟降 &gt;80%）
                    </h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>帳號</TableHead>
                          <TableHead>日期</TableHead>
                          <TableHead className="text-right">發布前累計 VFR</TableHead>
                          <TableHead className="text-right">該篇 VFR</TableHead>
                          <TableHead className="text-right">帳號平均 VFR</TableHead>
                          <TableHead className="text-right">下降比例</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.thresholdAnalysis.cliffEvents.map((event, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">@{event.username}</TableCell>
                            <TableCell>{event.postDate}</TableCell>
                            <TableCell className="text-right font-mono font-bold text-purple-700">
                              {event.cumulativeVfrBefore.toFixed(1)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-red-600">
                              {event.vfr.toFixed(1)}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {event.accountAvgVfr.toFixed(1)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                                {(event.dropRatio * 100).toFixed(0)}%
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 指標說明 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="size-5" />
                  指標說明
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-muted-foreground">
                <div>
                  <h4 className="font-medium text-foreground mb-1">VFR (Views-to-Followers Ratio)</h4>
                  <p>曝光數 ÷ 粉絲數，反映演算法放大倍率。VFR &gt; 200 視為爆發。</p>
                </div>
                <div>
                  <h4 className="font-medium text-foreground mb-1">Quota % 計算方式</h4>
                  <p>
                    以 VFR 500 為 100% 基準：Quota % = 累計 VFR ÷ 5。
                    <span className="text-orange-600 ml-1">⚠️ 此基準為假設值，實際門檻需透過資料驗證。</span>
                  </p>
                </div>
                <div>
                  <h4 className="font-medium text-foreground mb-1">Quota 狀態閾值</h4>
                  <p>&lt;200 健康（40%）→ 200-500 謹慎（40-100%）→ 500-900 高風險（100-180%）→ &gt;900 限流（&gt;180%）</p>
                </div>
                <div>
                  <h4 className="font-medium text-foreground mb-1">異常偵測邏輯</h4>
                  <p>當 ≥3 個帳號且 &gt;50% 同時下降超過 50% 時，判定為「可能演算法變動」。</p>
                </div>
              </CardContent>
            </Card>

            {/* 偵測策略說明 */}
            <Card className="border-blue-200 bg-blue-50/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="size-5 text-blue-600" />
                  <span className="text-blue-900">門檻偵測策略</span>
                </CardTitle>
                <CardDescription>
                  如何偵測 Threads 演算法門檻變動
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-lg border border-blue-200 bg-white p-4">
                    <h4 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
                      <span className="text-lg">📉</span> Cliff Detection
                    </h4>
                    <p className="text-muted-foreground text-xs mb-2">懸崖偵測</p>
                    <p className="text-sm text-gray-700">
                      追蹤「VFR 突然歸零」的臨界點。當多個帳號在相近的累計 VFR 值後突然驟降，可推估實際門檻。
                    </p>
                    <div className="mt-3 text-xs bg-gray-100 rounded p-2 font-mono">
                      帳號 A: VFR 450 → 0.3<br/>
                      帳號 B: VFR 480 → 0.2<br/>
                      → 門檻約 450-500
                    </div>
                  </div>

                  <div className="rounded-lg border border-blue-200 bg-white p-4">
                    <h4 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
                      <span className="text-lg">📊</span> Historical Baseline
                    </h4>
                    <p className="text-muted-foreground text-xs mb-2">歷史基線比較</p>
                    <p className="text-sm text-gray-700">
                      建立每個帳號的「正常 VFR 範圍」，偵測偏離超過 2 個標準差的異常。
                    </p>
                    <div className="mt-3 text-xs bg-gray-100 rounded p-2 font-mono">
                      30 天平均: 2.5 ± 0.8<br/>
                      今天 VFR: 0.2<br/>
                      → 異常！偏離 &gt;2σ
                    </div>
                  </div>

                  <div className="rounded-lg border border-blue-200 bg-white p-4">
                    <h4 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
                      <span className="text-lg">🔄</span> Recovery Pattern
                    </h4>
                    <p className="text-muted-foreground text-xs mb-2">恢復模式觀察</p>
                    <p className="text-sm text-gray-700">
                      觀察限流後的恢復時間，推估 Quota 重置週期與門檻寬鬆度。
                    </p>
                    <div className="mt-3 text-xs bg-gray-100 rounded p-2 font-mono">
                      7 天後恢復 → 週期重置<br/>
                      3 天後恢復 → 門檻較寬<br/>
                      未恢復 → 可能被標記
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 mt-4">
                  <h4 className="font-medium text-orange-900 mb-2 flex items-center gap-2">
                    <AlertTriangle className="size-4" />
                    待收集資料（尚未實作）
                  </h4>
                  <ul className="text-sm text-orange-800 space-y-1 list-disc list-inside">
                    <li>每篇貼文的即時 VFR，找出「最後正常」vs「首篇被限」分界點</li>
                    <li>累計 VFR 達到多少時觸發限流，估算真實門檻</li>
                    <li>限流持續時間，估算 Quota 重置週期</li>
                    <li>恢復後的 VFR 表現，判斷是完全重置還是漸進恢復</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* 生成時間 */}
            <p className="text-xs text-muted-foreground text-right">
              資料生成於：{new Date(data.generatedAt).toLocaleString("zh-TW")}
            </p>
          </>
        )}
      </div>
    </AdminOnly>
  );
}
