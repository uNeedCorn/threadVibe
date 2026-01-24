"use client";

import { useState, useCallback } from "react";
import { FlaskConical, Play, Loader2, Copy, Check, Gauge, RotateCcw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useSelectedAccount } from "@/hooks/use-selected-account";
import { AdminOnly } from "@/components/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TelegramTest } from "./components/telegram-test";

// Supabase 測試結果
interface LatencyResult {
  table: string;
  times: number[];
  min: number;
  max: number;
  avg: number;
  p50: number;
  p95: number;
}

interface LatencyTestState {
  isRunning: boolean;
  progress: number;
  results: LatencyResult[];
  region: string;
}

// 端點類型
type EndpointCategory = "read" | "write" | "delete";

interface ApiEndpoint {
  id: string;
  name: string;
  description: string;
  category: EndpointCategory;
  requirePostId?: boolean;
  requireReplyId?: boolean;
  requireKeyword?: boolean;
  requireUsername?: boolean;
  requireText?: boolean;
  requireLocation?: boolean;
}

// 可用的 API 端點
const API_ENDPOINTS: ApiEndpoint[] = [
  // === 讀取類 ===
  { id: "me", name: "個人資料", description: "取得帳號基本資訊", category: "read" },
  { id: "me_insights", name: "帳號 Insights", description: "取得 views、followers_count", category: "read" },
  { id: "me_threads", name: "貼文列表", description: "取得最近 10 則貼文", category: "read" },
  { id: "post_insights", name: "貼文 Insights", description: "取得指定貼文的成效數據", category: "read", requirePostId: true },
  { id: "post_replies", name: "貼文回覆", description: "取得指定貼文的直接回覆列表", category: "read", requirePostId: true },
  { id: "post_conversation", name: "完整對話串", description: "取得指定貼文的完整對話串（含巢狀回覆）", category: "read", requirePostId: true },
  { id: "me_mentions", name: "被提及內容", description: "取得被提及的內容列表", category: "read" },
  { id: "keyword_search", name: "關鍵字搜尋（需進階權限）", description: "搜尋貼文（需 threads_keyword_search 進階權限核准）", category: "read", requireKeyword: true },
  { id: "profile_lookup", name: "公開帳號資料", description: "取得指定公開帳號的資料", category: "read", requireUsername: true },
  { id: "location_search", name: "地點搜尋", description: "搜尋地點（用於標籤）", category: "read", requireLocation: true },
  // === 寫入類 ===
  { id: "create_post", name: "建立貼文", description: "建立新的文字貼文", category: "write", requireText: true },
  { id: "hide_reply", name: "隱藏回覆", description: "隱藏指定的回覆", category: "write", requireReplyId: true },
  { id: "unhide_reply", name: "取消隱藏回覆", description: "取消隱藏指定的回覆", category: "write", requireReplyId: true },
  // === 刪除類 ===
  { id: "delete_post", name: "刪除貼文", description: "刪除指定的貼文（不可復原）", category: "delete", requirePostId: true },
];

interface ApiResponse {
  endpoint: {
    id: string;
    name: string;
    url: string;
  };
  status: number;
  statusText: string;
  duration_ms: number;
  response: unknown;
}

// 類別顏色
const categoryColors: Record<EndpointCategory, string> = {
  read: "text-green-600 bg-green-100",
  write: "text-yellow-600 bg-yellow-100",
  delete: "text-red-600 bg-red-100",
};

const categoryLabels: Record<EndpointCategory, string> = {
  read: "讀取",
  write: "寫入",
  delete: "刪除",
};

export default function ApiTestPage() {
  const { selectedAccountId } = useSelectedAccount();
  const [selectedEndpoint, setSelectedEndpoint] = useState<string>("me");
  const [postId, setPostId] = useState<string>("");
  const [replyId, setReplyId] = useState<string>("");
  const [keyword, setKeyword] = useState<string>("");
  const [username, setUsername] = useState<string>("");
  const [text, setText] = useState<string>("");
  const [locationQuery, setLocationQuery] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const currentEndpoint = API_ENDPOINTS.find((e) => e.id === selectedEndpoint);

  // Supabase 連線測試狀態
  const [latencyTest, setLatencyTest] = useState<LatencyTestState>({
    isRunning: false,
    progress: 0,
    results: [],
    region: "ap-northeast-1",
  });

  // 計算百分位數
  const percentile = (arr: number[], p: number): number => {
    const sorted = [...arr].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  };

  // 執行 Supabase 連線測試
  const runLatencyTest = useCallback(async () => {
    setLatencyTest((prev) => ({ ...prev, isRunning: true, progress: 0, results: [] }));

    const supabase = createClient();
    const tables = [
      { name: "profiles", query: () => supabase.from("profiles").select("id").limit(1) },
      { name: "workspaces", query: () => supabase.from("workspaces").select("id").limit(1) },
      { name: "workspace_threads_posts", query: () => supabase.from("workspace_threads_posts").select("id").limit(1) },
      { name: "workspace_threads_post_metrics_hourly", query: () => supabase.from("workspace_threads_post_metrics_hourly").select("bucket_ts").limit(1) },
    ];

    const iterations = 10;
    const totalSteps = tables.length * iterations;
    let currentStep = 0;
    const results: LatencyResult[] = [];

    for (const table of tables) {
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await table.query();
        const elapsed = performance.now() - start;
        times.push(elapsed);

        currentStep++;
        setLatencyTest((prev) => ({
          ...prev,
          progress: Math.round((currentStep / totalSteps) * 100),
        }));

        // 小延遲避免過於密集
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      results.push({
        table: table.name,
        times,
        min: Math.min(...times),
        max: Math.max(...times),
        avg: times.reduce((a, b) => a + b, 0) / times.length,
        p50: percentile(times, 50),
        p95: percentile(times, 95),
      });
    }

    setLatencyTest((prev) => ({
      ...prev,
      isRunning: false,
      progress: 100,
      results,
    }));
  }, []);

  // 執行 API 測試
  const handleTest = useCallback(async () => {
    if (!selectedAccountId) {
      setError("請先選擇 Threads 帳號");
      return;
    }

    // 驗證必要參數
    if (currentEndpoint?.requirePostId && !postId) {
      setError("請輸入 Post ID");
      return;
    }
    if (currentEndpoint?.requireReplyId && !replyId) {
      setError("請輸入 Reply ID");
      return;
    }
    if (currentEndpoint?.requireKeyword && !keyword) {
      setError("請輸入搜尋關鍵字");
      return;
    }
    if (currentEndpoint?.requireUsername && !username) {
      setError("請輸入 Username");
      return;
    }
    if (currentEndpoint?.requireText && !text) {
      setError("請輸入貼文內容");
      return;
    }
    if (currentEndpoint?.requireLocation && !locationQuery) {
      setError("請輸入地點名稱");
      return;
    }

    // 確認危險操作
    if (currentEndpoint?.category === "delete") {
      if (!confirm("確定要執行刪除操作？此動作不可復原！")) {
        return;
      }
    }
    if (currentEndpoint?.category === "write") {
      if (!confirm("確定要執行寫入操作？")) {
        return;
      }
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const supabase = createClient();
      const { data, error: fnError } = await supabase.functions.invoke<ApiResponse>(
        "api-test",
        {
          body: {
            account_id: selectedAccountId,
            endpoint: selectedEndpoint,
            post_id: currentEndpoint?.requirePostId ? postId : undefined,
            reply_id: currentEndpoint?.requireReplyId ? replyId : undefined,
            keyword: currentEndpoint?.requireKeyword ? keyword : undefined,
            username: currentEndpoint?.requireUsername ? username : undefined,
            text: currentEndpoint?.requireText ? text : undefined,
            location_query: currentEndpoint?.requireLocation ? locationQuery : undefined,
          },
        }
      );

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (!data) {
        throw new Error("No data returned");
      }

      setResult(data);
    } catch (err) {
      console.error("API test error:", err);
      setError(err instanceof Error ? err.message : "API 測試失敗");
    } finally {
      setIsLoading(false);
    }
  }, [selectedAccountId, selectedEndpoint, postId, replyId, keyword, username, text, locationQuery, currentEndpoint]);

  // 複製結果
  const handleCopy = useCallback(() => {
    if (result) {
      navigator.clipboard.writeText(JSON.stringify(result.response, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [result]);

  return (
    <AdminOnly>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">API 測試</h1>
          <p className="text-muted-foreground">
            使用當前帳號的 Token 測試 Meta/Threads API
          </p>
        </div>

        {/* Supabase 連線測試 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gauge className="size-5" />
              Supabase 連線速度測試
            </CardTitle>
            <CardDescription>
              測試從瀏覽器到 Supabase 的查詢延遲（Region: {latencyTest.region}）
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Button
                onClick={runLatencyTest}
                disabled={latencyTest.isRunning}
              >
                {latencyTest.isRunning ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    測試中...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 size-4" />
                    開始測試
                  </>
                )}
              </Button>
              {latencyTest.results.length > 0 && !latencyTest.isRunning && (
                <Button variant="outline" onClick={runLatencyTest}>
                  <RotateCcw className="mr-2 size-4" />
                  重新測試
                </Button>
              )}
            </div>

            {/* 進度條 */}
            {latencyTest.isRunning && (
              <div className="space-y-2">
                <Progress value={latencyTest.progress} />
                <p className="text-sm text-muted-foreground">
                  測試進度: {latencyTest.progress}%
                </p>
              </div>
            )}

            {/* 測試結果 */}
            {latencyTest.results.length > 0 && (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="py-2 text-left font-medium">資料表</th>
                        <th className="py-2 text-right font-medium">Min</th>
                        <th className="py-2 text-right font-medium">Avg</th>
                        <th className="py-2 text-right font-medium">P50</th>
                        <th className="py-2 text-right font-medium">P95</th>
                        <th className="py-2 text-right font-medium">Max</th>
                      </tr>
                    </thead>
                    <tbody>
                      {latencyTest.results.map((result) => (
                        <tr key={result.table} className="border-b">
                          <td className="py-2 font-mono text-xs">{result.table}</td>
                          <td className="py-2 text-right text-green-600">{result.min.toFixed(0)}ms</td>
                          <td className="py-2 text-right font-medium">{result.avg.toFixed(0)}ms</td>
                          <td className="py-2 text-right">{result.p50.toFixed(0)}ms</td>
                          <td className="py-2 text-right text-yellow-600">{result.p95.toFixed(0)}ms</td>
                          <td className="py-2 text-right text-red-600">{result.max.toFixed(0)}ms</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* 整體統計 */}
                <div className="rounded-lg bg-muted p-4">
                  <h4 className="mb-2 text-sm font-medium">整體統計</h4>
                  {(() => {
                    const allTimes = latencyTest.results.flatMap((r) => r.times);
                    const overallAvg = allTimes.reduce((a, b) => a + b, 0) / allTimes.length;
                    const overallMin = Math.min(...allTimes);
                    const overallMax = Math.max(...allTimes);
                    return (
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <p className="text-2xl font-bold text-green-600">{overallMin.toFixed(0)}ms</p>
                          <p className="text-xs text-muted-foreground">最快</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{overallAvg.toFixed(0)}ms</p>
                          <p className="text-xs text-muted-foreground">平均</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-red-600">{overallMax.toFixed(0)}ms</p>
                          <p className="text-xs text-muted-foreground">最慢</p>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <p className="text-xs text-muted-foreground">
                  * 每個資料表測試 10 次，數據包含網路延遲 + Supabase 查詢時間
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Telegram 通知測試 */}
        <TelegramTest />

        {/* 測試設定 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FlaskConical className="size-5" />
            API 設定
          </CardTitle>
          <CardDescription>
            選擇要測試的 API 端點
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            {/* API 端點選擇 */}
            <div className="space-y-2">
              <Label>API 端點</Label>
              <Select
                value={selectedEndpoint}
                onValueChange={setSelectedEndpoint}
              >
                <SelectTrigger className="w-[240px]">
                  <SelectValue placeholder="選擇端點" />
                </SelectTrigger>
                <SelectContent>
                  {/* 讀取類 */}
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">讀取 API</div>
                  {API_ENDPOINTS.filter(e => e.category === "read").map((endpoint) => (
                    <SelectItem key={endpoint.id} value={endpoint.id}>
                      {endpoint.name}
                    </SelectItem>
                  ))}
                  {/* 寫入類 */}
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">寫入 API</div>
                  {API_ENDPOINTS.filter(e => e.category === "write").map((endpoint) => (
                    <SelectItem key={endpoint.id} value={endpoint.id}>
                      {endpoint.name}
                    </SelectItem>
                  ))}
                  {/* 刪除類 */}
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">刪除 API</div>
                  {API_ENDPOINTS.filter(e => e.category === "delete").map((endpoint) => (
                    <SelectItem key={endpoint.id} value={endpoint.id}>
                      {endpoint.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Post ID 輸入 */}
            {currentEndpoint?.requirePostId && (
              <div className="space-y-2">
                <Label>Post ID</Label>
                <Input
                  value={postId}
                  onChange={(e) => setPostId(e.target.value)}
                  placeholder="輸入 Threads Post ID"
                  className="w-[280px]"
                />
              </div>
            )}

            {/* Reply ID 輸入 */}
            {currentEndpoint?.requireReplyId && (
              <div className="space-y-2">
                <Label>Reply ID</Label>
                <Input
                  value={replyId}
                  onChange={(e) => setReplyId(e.target.value)}
                  placeholder="輸入回覆 ID"
                  className="w-[280px]"
                />
              </div>
            )}

            {/* Keyword 輸入 */}
            {currentEndpoint?.requireKeyword && (
              <div className="space-y-2">
                <Label>搜尋關鍵字</Label>
                <Input
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="輸入搜尋關鍵字"
                  className="w-[200px]"
                />
              </div>
            )}

            {/* Username 輸入 */}
            {currentEndpoint?.requireUsername && (
              <div className="space-y-2">
                <Label>Username</Label>
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="輸入帳號 username"
                  className="w-[200px]"
                />
              </div>
            )}

            {/* Location 輸入 */}
            {currentEndpoint?.requireLocation && (
              <div className="space-y-2">
                <Label>地點名稱</Label>
                <Input
                  value={locationQuery}
                  onChange={(e) => setLocationQuery(e.target.value)}
                  placeholder="輸入地點名稱"
                  className="w-[200px]"
                />
              </div>
            )}

            {/* 執行按鈕 */}
            <Button
              onClick={handleTest}
              disabled={isLoading || !selectedAccountId}
              variant={currentEndpoint?.category === "delete" ? "destructive" : "default"}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  執行中...
                </>
              ) : (
                <>
                  <Play className="mr-2 size-4" />
                  執行測試
                </>
              )}
            </Button>
          </div>

          {/* Text 輸入（發文用，獨立一行） */}
          {currentEndpoint?.requireText && (
            <div className="space-y-2">
              <Label>貼文內容</Label>
              <Input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="輸入要發布的貼文內容"
                className="w-full"
              />
            </div>
          )}

          {/* 端點說明 */}
          {currentEndpoint && (
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 text-xs rounded ${categoryColors[currentEndpoint.category]}`}>
                {categoryLabels[currentEndpoint.category]}
              </span>
              <p className="text-sm text-muted-foreground">
                {currentEndpoint.description}
              </p>
            </div>
          )}
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

      {/* 結果顯示 */}
      {result && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>API 回應</CardTitle>
                <CardDescription>
                  {result.endpoint.name} - {result.status} {result.statusText} ({result.duration_ms}ms)
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={handleCopy}>
                {copied ? (
                  <>
                    <Check className="mr-2 size-4" />
                    已複製
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 size-4" />
                    複製 JSON
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Request URL */}
            <div className="mb-4">
              <Label className="text-xs text-muted-foreground">Request URL</Label>
              <p className="font-mono text-xs break-all bg-muted p-2 rounded mt-1">
                {result.endpoint.url}
              </p>
            </div>

            {/* Response */}
            <div>
              <Label className="text-xs text-muted-foreground">Response</Label>
              <pre className="mt-1 overflow-auto rounded bg-muted p-4 text-xs max-h-[500px]">
                {JSON.stringify(result.response, null, 2)}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}
      </div>
    </AdminOnly>
  );
}
