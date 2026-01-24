/**
 * AI Weekly Report - 產生 AI 洞察報告
 *
 * POST /ai-weekly-report
 * Headers: Authorization: Bearer <USER_JWT>
 * Body: { accountId: string, weekStart?: string }
 *
 * 使用 Claude 分析週數據並產生報告
 */

import { handleCors } from '../_shared/cors.ts';
import { createAnonClient, createServiceClient } from '../_shared/supabase.ts';
import { jsonResponse, errorResponse, unauthorizedResponse, forbiddenResponse } from '../_shared/response.ts';
import { getAuthenticatedUser, isSystemAdmin } from '../_shared/auth.ts';
import { ClaudeClient } from '../_shared/claude.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');

interface RequestBody {
  accountId: string;
  weekStart?: string; // YYYY-MM-DD 格式
  weekEnd?: string;   // YYYY-MM-DD 格式
  timezone?: string;  // IANA timezone (e.g., 'Asia/Taipei')
  model?: 'sonnet' | 'opus'; // 模型選擇
}

// 模型 ID 對應
const MODEL_IDS: Record<string, string> = {
  sonnet: 'claude-sonnet-4-20250514',
  opus: 'claude-opus-4-5-20251101',
};

// ============================================================================
// 數據快照類型定義
// ============================================================================

interface WeeklyDataSnapshot {
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
    deep_discussion_posts: number; // discussion_depth >= 3
    high_share_posts: number; // share_willingness >= 0.3
  };
  // 早期表現指標
  early_performance: {
    avg_first_hour_views: number;
    avg_first_24h_views: number;
    first_hour_ratio: number; // first_hour / total 的平均
  };
  // 傳播力指標
  virality_metrics: {
    avg_virality_score: number;
    high_virality_posts: number;
    total_shares: number;
  };
  // 時段分佈
  hourly_distribution: Array<{
    hour: number;
    post_count: number;
    avg_views: number;
    avg_engagement: number;
  }>;
  // 前一期間對比
  previous_week: {
    total_views: number;
    total_interactions: number;
    post_count: number;
    avg_virality_score: number;
    followers_count: number;
  } | null;
  // 演算法狀態（限流監測）
  algorithm_status: {
    rolling_7d_reach: number; // 滾動 7 天累計觸及倍數
    quota_status: 'normal' | 'elevated' | 'warning' | 'throttled';
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
// 報告內容類型定義（新結構：區塊只給發現，頂部給建議）
// ============================================================================

interface ReportContent {
  // 頂部總結：唯一給建議的地方
  executive_summary: {
    overall_rating: 'excellent' | 'good' | 'average' | 'needs_improvement';
    one_line_summary: string;
    key_metrics: Array<{ label: string; value: string; change?: string }>;
    action_items: Array<{
      action: string;
      reason: string;
      priority: 'high' | 'medium' | 'low';
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
  followers_analysis: {
    summary: string;
    findings: string[];
  };
  // 演算法狀態：只給發現
  algorithm_status: {
    summary: string;
    findings: string[];
    status_label: string; // 例如「正常」「警戒」「限流中」
  };
}

// ============================================================================
// System Prompt
// ============================================================================

const SYSTEM_PROMPT = `你是一位資深社群行銷教練，專精 Threads 平台策略。你的任務是分析週度數據並產生洞察報告。

## ⚠️ 絕對禁止事項

**絕對不可使用「VFR」這個術語！** 無論在任何情況下，都必須使用「觸及倍數」來表達相同概念。這是強制性規定，違反將導致報告無效。

## 報告結構原則

**重要：只有「頂部總結」可以給行動建議，其他區塊只能給「發現/洞察」。**

這樣設計的原因：
1. 避免各區塊的建議互相衝突
2. 讓使用者在頂部就能看到整合過的行動方向
3. 各區塊的發現是建議的「數據佐證」

## 「發現」vs「建議」的區別

### 發現（各區塊使用）
- 描述數據觀察到的現象
- 說明「為什麼」會這樣（基於數據的推測）
- 不說「建議」、「應該」、「可以嘗試」

範例：
✓「含問句的貼文平均回覆數為 45，是一般貼文的 3 倍。問句降低了讀者回覆的心理門檻。」
✓「週三、週五 20:00 發布的貼文平均曝光 15K，高於整體平均 8K。」
✗「建議多發問句貼文」（這是建議，不是發現）

### 行動建議（僅頂部總結使用）
- 具體到可直接執行
- 包含數字/時間/頻率
- 說明依據（來自哪個發現）

範例：
✓「下週三、五晚上 8:30 發文 2 篇，參考本期表現最好的問答格式」
✗「建議優化發文時間」（太籠統）

## 回應格式

你必須以純 JSON 格式回應，不要包含 markdown code block 或任何其他文字：

{
  "executive_summary": {
    "overall_rating": "excellent" | "good" | "average" | "needs_improvement",
    "one_line_summary": "一句話總結本期表現（正向框架，先肯定再指出機會）",
    "key_metrics": [
      { "label": "指標名稱", "value": "數值", "change": "+15%" }
    ],
    "action_items": [
      {
        "action": "具體行動（含數字/時間/頻率）",
        "reason": "依據哪個發現",
        "priority": "high" | "medium" | "low"
      }
    ]
  },
  "reach_analysis": {
    "summary": "曝光現況摘要（50-80字），包含關鍵數據和觀察",
    "findings": ["發現1（數據+觀察，不是建議）", "發現2"]
  },
  "engagement_analysis": {
    "summary": "互動現況摘要（50-80字）",
    "findings": ["發現1", "發現2"]
  },
  "content_strategy": {
    "summary": "內容策略現況摘要（50-80字）",
    "findings": ["發現1", "發現2"],
    "top_performing": ["表現最好的內容特徵1", "特徵2"]
  },
  "timing_analysis": {
    "summary": "發文時間現況摘要（50-80字）",
    "findings": ["發現1", "發現2"],
    "best_times": ["週三 20:00", "週五 20:30"]
  },
  "followers_analysis": {
    "summary": "粉絲成長現況摘要（50-80字）",
    "findings": ["發現1", "發現2"]
  },
  "algorithm_status": {
    "summary": "演算法狀態摘要（50-80字），說明目前帳號在演算法中的狀態",
    "findings": ["發現1（基於觸及倍數數據的觀察）", "發現2"],
    "status_label": "正常" | "累積中" | "警戒" | "限流中"
  }
}

## 語氣原則

1. **正向框架**：先肯定做得好的地方，再指出成長機會
2. **數據驅動**：每個發現都要有數據支撐
3. **不批評**：用「機會」取代「問題」，用「可以更好」取代「不好」

範例：
✓「本期曝光成長 25%，週四的貼文表現特別亮眼。」
✓「互動率維持在 4.2%，其中問答型內容的回覆數是平均的 3 倍。」
✗「本期表現不佳，互動率下降了...」

## 重要限制

1. 不要推測沒有數據支撐的事情（如「演算法推播給非粉絲」）
2. 不要提及我們沒有的數據（如「收藏數」、「曝光來源」）
3. 發現要基於提供的數據，不要憑空編造
4. **嚴禁使用「VFR」這個術語**，一律使用「觸及倍數」來表達
5. **如果沒有提供「與前一期間比較」的數據**：
   - key_metrics 中不要加入 change 欄位
   - 不要在分析中提及「成長」「下降」「變化」等比較用語
   - 專注於描述本期的絕對數據表現

## 演算法狀態分析指南

### 觸及倍數
觸及倍數 = 貼文曝光數 / 發布當日粉絲數

| 觸及倍數 | 意義 |
|----------|------|
| = 1 | 曝光數 = 粉絲數（只有粉絲看到） |
| ≥ 10 | 開始進入推薦池 |
| ≥ 100 | 熱門貼文 |
| ≥ 200 | 爆發性傳播（可能觸發限流） |

### 配額狀態判斷
根據「滾動 7 天累計觸及倍數」判斷配額狀態：

| 累計觸及倍數 | 狀態 | status_label |
|--------------|------|--------------|
| < 200 | 正常，可以爆發 | 正常 |
| 200-500 | 開始累積，表現可能不穩定 | 累積中 |
| 500-900 | 高風險，可能被限流 | 警戒 |
| > 900 | 幾乎確定被限流 | 限流中 |

### 分析重點
1. 如果有爆發事件（單篇觸及倍數 ≥ 200），說明爆發的影響
2. 如果累計觸及倍數高，提醒用戶曝光可能暫時下降是正常現象
3. 如果累計觸及倍數正在消化（下降），說明恢復趨勢
4. 限流不是永久的，配額消化後可再次爆發

## 語言規範

請使用**繁體中文（台灣用語）**撰寫，注意以下用詞：
- 使用「貼文」而非「帖子」
- 使用「粉絲」而非「粉絲數」或「關注者」
- 使用「曝光」而非「展示」或「印象」
- 使用「互動」而非「交互」
- 使用「觸及倍數」而非「VFR」或「Views-to-Followers Ratio」
- 使用「轉發」而非「轉帖」
- 使用「回覆」而非「評論」或「留言」`;

// ============================================================================
// Main Handler
// ============================================================================

Deno.serve(async (req) => {
  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // 驗證使用者（共用邏輯）
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return unauthorizedResponse(req, 'Missing authorization header');
  }

  const anonClient = createAnonClient(authHeader);
  const user = await getAuthenticatedUser(anonClient);
  if (!user) {
    return unauthorizedResponse(req, 'Invalid token');
  }

  const serviceClient = createServiceClient();

  // ============================================================================
  // DELETE: 軟刪除報告
  // ============================================================================
  if (req.method === 'DELETE') {
    try {
      const { reportId } = await req.json();

      if (!reportId) {
        return errorResponse(req, 'reportId is required');
      }

      // 檢查報告是否存在且使用者有權限
      const { data: report, error: reportError } = await anonClient
        .from('ai_weekly_reports')
        .select('id')
        .eq('id', reportId)
        .maybeSingle();

      if (reportError || !report) {
        return errorResponse(req, '找不到此報告或無權限', 404);
      }

      // 軟刪除
      const { error: deleteError } = await serviceClient
        .from('ai_weekly_reports')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', reportId);

      if (deleteError) {
        throw new Error(deleteError.message);
      }

      return jsonResponse(req, { success: true });
    } catch (error) {
      console.error('Delete report error:', error);
      return errorResponse(req, '刪除失敗，請稍後再試', 500);
    }
  }

  // ============================================================================
  // POST: 產生報告
  // ============================================================================
  if (req.method !== 'POST') {
    return errorResponse(req, 'Method not allowed', 405);
  }

  try {
    // 驗證 API Key
    if (!ANTHROPIC_API_KEY) {
      console.error('ANTHROPIC_API_KEY not configured');
      return errorResponse(req, '系統設定錯誤，請聯繫管理員', 500);
    }

    // 檢查是否為系統管理員
    const isAdmin = await isSystemAdmin(serviceClient, user.id);

    // 解析請求
    const body: RequestBody = await req.json();
    const { accountId, weekStart, weekEnd: weekEndParam, timezone = 'Asia/Taipei', model = 'opus' } = body;
    const modelId = MODEL_IDS[model] || MODEL_IDS.opus;

    if (!accountId) {
      return errorResponse(req, 'accountId is required');
    }

    // 計算週期範圍
    const now = new Date();
    let weekStartStr: string;
    let weekEndStr: string;

    if (weekStart && weekEndParam) {
      // 使用指定的日期區間
      weekStartStr = weekStart;
      weekEndStr = weekEndParam;
    } else if (weekStart) {
      // 只有開始日期，結束日期 = 開始 + 6 天
      weekStartStr = weekStart;
      const endDate = new Date(weekStart);
      endDate.setDate(endDate.getDate() + 6);
      weekEndStr = endDate.toISOString().split('T')[0];
    } else {
      // 預設為前 7 天（昨天往前推 6 天）
      const endDate = new Date(now);
      endDate.setDate(now.getDate() - 1); // 昨天
      const startDate = new Date(endDate);
      startDate.setDate(endDate.getDate() - 6); // 昨天往前 6 天
      weekStartStr = startDate.toISOString().split('T')[0];
      weekEndStr = endDate.toISOString().split('T')[0];
    }

    // 取得帳號資訊
    const { data: account, error: accountError } = await serviceClient
      .from('workspace_threads_accounts')
      .select('id, username, name, current_followers_count, workspace_id')
      .eq('id', accountId)
      .single();

    if (accountError || !account) {
      console.error('Account query error:', { accountId, accountError });
      return errorResponse(req, '找不到此帳號', 404);
    }

    // 非管理員：每 7 天限制產生 1 份報告
    if (!isAdmin) {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { count: recentCount } = await serviceClient
        .from('ai_weekly_reports')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_threads_account_id', accountId)
        .gte('created_at', sevenDaysAgo);

      if ((recentCount || 0) >= 1) {
        return errorResponse(
          req,
          '每 7 天只能產生 1 份報告。請稍後再試。',
          429,
          'RATE_LIMIT_EXCEEDED'
        );
      }
    }

    // 檢查是否有正在產生中的報告
    const { data: generatingReport } = await serviceClient
      .from('ai_weekly_reports')
      .select('id')
      .eq('workspace_threads_account_id', accountId)
      .eq('status', 'generating')
      .maybeSingle();

    if (generatingReport) {
      return jsonResponse(req, {
        reportId: generatingReport.id,
        status: 'generating',
      });
    }

    // 建立新報告記錄
    const { data: newReport, error: insertError } = await serviceClient
      .from('ai_weekly_reports')
      .insert({
        workspace_threads_account_id: accountId,
        week_start: weekStartStr,
        week_end: weekEndStr,
        status: 'generating',
        model_name: modelId,
      })
      .select('id')
      .single();

    if (insertError || !newReport) {
      throw new Error(`Failed to create report: ${insertError?.message}`);
    }
    const reportId = newReport.id;

    // 背景處理函數
    const processReport = async () => {
      try {
        // 聚合週數據
        const dataSnapshot = await aggregateWeeklyData(serviceClient, accountId, weekStartStr, weekEndStr, timezone);

        // 建構 User Prompt
        const userPrompt = buildUserPrompt(dataSnapshot);

        // 呼叫 Claude API
        const claude = new ClaudeClient(ANTHROPIC_API_KEY, modelId);
        const result = await claude.generateWeeklyReport<ReportContent>(SYSTEM_PROMPT, userPrompt);

        // 更新報告
        await serviceClient
          .from('ai_weekly_reports')
          .update({
            status: 'completed',
            report_content: result.content,
            data_snapshot: dataSnapshot,
            input_tokens: result.usage.input_tokens,
            output_tokens: result.usage.output_tokens,
            generated_at: new Date().toISOString(),
          })
          .eq('id', reportId);

        // 記錄 LLM 使用量
        await serviceClient.from('llm_usage_logs').insert({
          workspace_id: account.workspace_id,
          workspace_threads_account_id: accountId,
          model_name: modelId,
          input_tokens: result.usage.input_tokens,
          output_tokens: result.usage.output_tokens,
          total_tokens: result.usage.input_tokens + result.usage.output_tokens,
          purpose: 'weekly_report',
          metadata: {
            report_id: reportId,
            week_start: weekStartStr,
            week_end: weekEndStr,
          },
        });

        console.log(`Report ${reportId} completed successfully`);
      } catch (error) {
        console.error(`Report ${reportId} failed:`, error);

        // 內部錯誤訊息（僅記錄到資料庫供管理員除錯）
        const internalError = error instanceof Error ? error.message : 'Unknown error';

        // 使用者可見的錯誤訊息（不暴露 API 細節）
        const userFacingError = '報告產生失敗，請稍後再試';

        // 更新報告狀態為 failed
        await serviceClient
          .from('ai_weekly_reports')
          .update({
            status: 'failed',
            error_message: userFacingError,
            // 內部錯誤記錄到 metadata（僅管理員可見）
          })
          .eq('id', reportId);
      }
    };

    // 使用 EdgeRuntime.waitUntil 在背景執行（不阻塞回應）
    // @ts-ignore - EdgeRuntime is available in Supabase Edge Functions
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(processReport());
    } else {
      // Fallback: 直接執行（不等待）
      processReport().catch(console.error);
    }

    // 立即回傳報告 ID，讓前端輪詢狀態
    return jsonResponse(req, {
      reportId,
      status: 'generating',
    });
  } catch (error) {
    // 詳細錯誤記錄到 console（僅伺服器端可見）
    console.error('AI weekly report error:', error);
    // 返回通用錯誤訊息給前端
    return errorResponse(req, '報告產生失敗，請稍後再試', 500);
  }
});

// ============================================================================
// 建構 User Prompt
// ============================================================================

function buildUserPrompt(data: WeeklyDataSnapshot): string {
  const sections: string[] = [];

  // 帳號資訊
  sections.push(`## 帳號資訊
- 用戶名稱：@${data.account.username}
- 顯示名稱：${data.account.name}
- 目前粉絲數：${data.account.followers_count.toLocaleString()}
- 本期粉絲成長：${data.account.followers_growth >= 0 ? '+' : ''}${data.account.followers_growth.toLocaleString()}`);

  // 分析期間
  sections.push(`## 分析期間
${data.period.start} ~ ${data.period.end}`);

  // 本期整體表現
  sections.push(`## 本期整體表現
- 發文數：${data.summary.post_count}
- 總曝光：${data.summary.total_views.toLocaleString()}
- 總互動：${data.summary.total_interactions.toLocaleString()}
  - 讚：${data.summary.total_likes.toLocaleString()}
  - 回覆：${data.summary.total_replies.toLocaleString()}
  - 轉發：${data.summary.total_reposts.toLocaleString()}
  - 引用：${data.summary.total_quotes.toLocaleString()}
- 互動率：${(data.summary.engagement_rate * 100).toFixed(2)}%
- 傳播力：${(data.summary.avg_virality_score * 100).toFixed(2)}%`);

  // 與前一期間比較
  if (data.previous_week) {
    const viewsChange = ((data.summary.total_views - data.previous_week.total_views) / (data.previous_week.total_views || 1) * 100);
    const interactionsChange = ((data.summary.total_interactions - data.previous_week.total_interactions) / (data.previous_week.total_interactions || 1) * 100);
    const followersChange = data.account.followers_count - data.previous_week.followers_count;

    sections.push(`## 與前一期間比較
- 曝光變化：${viewsChange >= 0 ? '+' : ''}${viewsChange.toFixed(1)}%（前期 ${data.previous_week.total_views.toLocaleString()}）
- 互動變化：${interactionsChange >= 0 ? '+' : ''}${interactionsChange.toFixed(1)}%（前期 ${data.previous_week.total_interactions.toLocaleString()}）
- 粉絲變化：${followersChange >= 0 ? '+' : ''}${followersChange.toLocaleString()}`);
  }

  // 每日趨勢
  if (data.daily_metrics.length > 0) {
    const dailyLines = data.daily_metrics.map(d =>
      `- ${d.date}：${d.views.toLocaleString()} 曝光、${d.interactions.toLocaleString()} 互動、${d.post_count} 篇`
    );
    sections.push(`## 每日趨勢\n${dailyLines.join('\n')}`);
  }

  // Top 貼文
  if (data.top_posts.length > 0) {
    const postLines = data.top_posts.slice(0, 5).map((p, i) => {
      const text = p.text.length > 50 ? p.text.slice(0, 50) + '...' : p.text;
      const features: string[] = [];
      if (p.has_question) features.push('問句');
      if (p.has_cta) features.push('CTA');
      const featureStr = features.length > 0 ? `[${features.join('+')}] ` : '';

      return `${i + 1}. ${featureStr}「${text}」
   曝光 ${p.views.toLocaleString()} | 互動率 ${(p.engagement_rate * 100).toFixed(2)}% | ${p.media_type} | ${p.char_count} 字`;
    });
    sections.push(`## Top 5 貼文\n${postLines.join('\n\n')}`);
  }

  // 內容特徵效益
  sections.push(`## 內容特徵分析`);

  // 媒體類型
  if (data.content_features.by_media_type.length > 0) {
    const mediaLines = data.content_features.by_media_type.map(m =>
      `- ${m.type}：${m.count} 篇，平均曝光 ${m.avg_views.toLocaleString()}，互動率 ${(m.avg_engagement_rate * 100).toFixed(2)}%`
    );
    sections.push(`### 媒體類型\n${mediaLines.join('\n')}`);
  }

  // 貼文長度
  if (data.content_features.by_length.length > 0) {
    const lengthLines = data.content_features.by_length.map(l =>
      `- ${l.range}：${l.count} 篇，平均曝光 ${l.avg_views.toLocaleString()}`
    );
    sections.push(`### 貼文長度\n${lengthLines.join('\n')}`);
  }

  // 問句效益
  const q = data.content_features.by_question;
  if (q.with_question.count > 0 || q.without_question.count > 0) {
    sections.push(`### 問句效益
- 含問句：${q.with_question.count} 篇，平均曝光 ${q.with_question.avg_views.toLocaleString()}，平均回覆 ${q.with_question.avg_replies.toFixed(1)}
- 無問句：${q.without_question.count} 篇，平均曝光 ${q.without_question.avg_views.toLocaleString()}，平均回覆 ${q.without_question.avg_replies.toFixed(1)}`);
  }

  // CTA 效益
  const c = data.content_features.by_cta;
  if (c.with_cta.count > 0 || c.without_cta.count > 0) {
    sections.push(`### CTA 效益
- 含 CTA：${c.with_cta.count} 篇，平均曝光 ${c.with_cta.avg_views.toLocaleString()}
- 無 CTA：${c.without_cta.count} 篇，平均曝光 ${c.without_cta.avg_views.toLocaleString()}`);
  }

  // 標籤效益
  if (data.tag_performance.user_tags.length > 0) {
    const tagLines = data.tag_performance.user_tags.slice(0, 5).map(t =>
      `- ${t.name}：${t.count} 篇，平均曝光 ${t.avg_views.toLocaleString()}`
    );
    sections.push(`## 用戶標籤效益\n${tagLines.join('\n')}`);
  }

  if (data.tag_performance.ai_tags.length > 0) {
    const aiTagLines = data.tag_performance.ai_tags.slice(0, 5).map(t =>
      `- [${t.dimension}] ${t.tag}：${t.count} 篇，平均曝光 ${t.avg_views.toLocaleString()}`
    );
    sections.push(`## AI 標籤效益（用戶已選）\n${aiTagLines.join('\n')}`);
  }

  // 互動品質
  sections.push(`## 互動品質指標
- 平均討論深度：${data.engagement_quality.avg_discussion_depth.toFixed(2)}
- 平均分享意願：${(data.engagement_quality.avg_share_willingness * 100).toFixed(1)}%
- 深度討論貼文：${data.engagement_quality.deep_discussion_posts} 篇
- 高分享意願貼文：${data.engagement_quality.high_share_posts} 篇`);

  // 早期表現
  if (data.early_performance.avg_first_hour_views > 0) {
    sections.push(`## 早期表現指標
- 平均首小時曝光：${data.early_performance.avg_first_hour_views.toLocaleString()}
- 平均 24 小時曝光：${data.early_performance.avg_first_24h_views.toLocaleString()}
- 首小時佔比：${(data.early_performance.first_hour_ratio * 100).toFixed(1)}%`);
  }

  // 發文時段
  const activeHours = data.hourly_distribution.filter(h => h.post_count > 0);
  if (activeHours.length > 0) {
    const hourLines = activeHours.map(h =>
      `- ${h.hour.toString().padStart(2, '0')}:00：${h.post_count} 篇，平均曝光 ${h.avg_views.toLocaleString()}`
    );
    sections.push(`## 發文時段分佈\n${hourLines.join('\n')}`);
  }

  // 演算法狀態（限流監測）
  const algo = data.algorithm_status;
  const quotaLabels: Record<string, string> = {
    normal: '正常',
    elevated: '累積中',
    warning: '警戒',
    throttled: '限流中',
  };

  sections.push(`## 演算法狀態監測
- 滾動 7 天累計觸及倍數：${algo.rolling_7d_reach}
- 配額狀態：${quotaLabels[algo.quota_status] || algo.quota_status}
- 爆發事件數：${algo.burst_events.length} 篇`);

  if (algo.burst_events.length > 0) {
    const burstLines = algo.burst_events.map(b =>
      `- 「${b.post_text}」(${b.date}) - 觸及倍數 ${b.reach_multiplier}，曝光 ${b.views.toLocaleString()}`
    );
    sections.push(`### 爆發事件（觸及倍數 ≥ 200）\n${burstLines.join('\n')}`);
  }

  if (algo.daily_reach.length > 0) {
    const reachLines = algo.daily_reach.map(d =>
      `- ${d.date}：當日觸及倍數 ${d.avg_reach}，累計 ${d.cumulative_reach}（${d.post_count} 篇）`
    );
    sections.push(`### 每日觸及倍數趨勢\n${reachLines.join('\n')}`);
  }

  return sections.join('\n\n');
}

// ============================================================================
// 聚合週數據
// ============================================================================

async function aggregateWeeklyData(
  supabase: ReturnType<typeof createServiceClient>,
  accountId: string,
  weekStart: string,
  weekEnd: string,
  timezone: string = 'Asia/Taipei'
): Promise<WeeklyDataSnapshot> {
  // 常見時區偏移（小時）
  const timezoneOffsets: Record<string, number> = {
    'Asia/Taipei': 8,
    'Asia/Tokyo': 9,
    'Asia/Shanghai': 8,
    'Asia/Hong_Kong': 8,
    'America/New_York': -5,
    'America/Los_Angeles': -8,
    'Europe/London': 0,
    'UTC': 0,
  };

  const offsetHours = timezoneOffsets[timezone] ?? 8; // 預設 UTC+8

  // 將本地日期轉換為 UTC 時間
  // 例如：台灣 2025-01-13 00:00 (UTC+8) = UTC 2025-01-12 16:00
  // 公式：UTC = Local - offset
  const startLocalMs = new Date(`${weekStart}T00:00:00Z`).getTime();
  const endLocalMs = new Date(`${weekEnd}T23:59:59Z`).getTime();

  const weekStartDateTime = new Date(startLocalMs - offsetHours * 60 * 60 * 1000).toISOString();
  const weekEndDateTime = new Date(endLocalMs - offsetHours * 60 * 60 * 1000).toISOString();

  // 取得帳號資訊
  const { data: account } = await supabase
    .from('workspace_threads_accounts')
    .select('username, name, current_followers_count')
    .eq('id', accountId)
    .single();

  if (!account) {
    throw new Error('Account not found');
  }

  // 取得粉絲成長
  const { data: startInsight } = await supabase
    .from('workspace_threads_account_insights_daily')
    .select('followers_count')
    .eq('workspace_threads_account_id', accountId)
    .lte('bucket_date', weekStart)
    .order('bucket_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: endInsight } = await supabase
    .from('workspace_threads_account_insights_daily')
    .select('followers_count')
    .eq('workspace_threads_account_id', accountId)
    .lte('bucket_date', weekEnd)
    .order('bucket_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  const followersGrowth = (endInsight?.followers_count ?? account.current_followers_count) -
    (startInsight?.followers_count ?? account.current_followers_count);

  // 取得本期貼文
  const { data: posts, error: postsError } = await supabase
    .from('workspace_threads_posts')
    .select(`
      id,
      text,
      published_at,
      media_type,
      char_count,
      current_views,
      current_likes,
      current_replies,
      current_reposts,
      current_quotes,
      current_shares,
      engagement_rate,
      reply_rate,
      repost_rate,
      quote_rate,
      discussion_depth,
      share_willingness,
      first_hour_views,
      first_24h_views,
      ai_selected_tags,
      has_question,
      question_type,
      has_cta,
      cta_type
    `)
    .eq('workspace_threads_account_id', accountId)
    .not('media_type', 'eq', 'REPOST_FACADE')
    .gte('published_at', weekStartDateTime)
    .lte('published_at', weekEndDateTime)
    .order('current_views', { ascending: false });

  if (postsError) {
    console.error('Posts query error:', postsError);
  }

  const currentPosts = posts || [];

  // 計算總計
  const totalViews = currentPosts.reduce((sum, p) => sum + (p.current_views || 0), 0);
  const totalLikes = currentPosts.reduce((sum, p) => sum + (p.current_likes || 0), 0);
  const totalReplies = currentPosts.reduce((sum, p) => sum + (p.current_replies || 0), 0);
  const totalReposts = currentPosts.reduce((sum, p) => sum + (p.current_reposts || 0), 0);
  const totalQuotes = currentPosts.reduce((sum, p) => sum + (p.current_quotes || 0), 0);
  const totalShares = currentPosts.reduce((sum, p) => sum + (p.current_shares || 0), 0);
  const totalInteractions = totalLikes + totalReplies + totalReposts + totalQuotes;

  // 計算每日趨勢
  const dailyMap = new Map<string, { views: number; interactions: number; posts: number }>();
  currentPosts.forEach((p) => {
    const date = new Date(p.published_at).toISOString().split('T')[0];
    const existing = dailyMap.get(date) || { views: 0, interactions: 0, posts: 0 };
    const interactions = (p.current_likes || 0) + (p.current_replies || 0) + (p.current_reposts || 0) + (p.current_quotes || 0);
    dailyMap.set(date, {
      views: existing.views + (p.current_views || 0),
      interactions: existing.interactions + interactions,
      posts: existing.posts + 1,
    });
  });

  // 取得每日粉絲數
  const { data: dailyInsights } = await supabase
    .from('workspace_threads_account_insights_daily')
    .select('bucket_date, followers_count')
    .eq('workspace_threads_account_id', accountId)
    .gte('bucket_date', weekStart)
    .lte('bucket_date', weekEnd)
    .order('bucket_date');

  const dailyFollowersMap = new Map<string, number>();
  (dailyInsights || []).forEach((i) => {
    dailyFollowersMap.set(i.bucket_date, i.followers_count);
  });

  const dailyMetrics = Array.from(dailyMap.entries())
    .map(([date, stats]) => ({
      date,
      views: stats.views,
      interactions: stats.interactions,
      post_count: stats.posts,
      followers_count: dailyFollowersMap.get(date) || account.current_followers_count,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Top 貼文
  const topPosts = currentPosts.slice(0, 10).map((p) => {
    const views = p.current_views || 0;
    const interactions = (p.current_likes || 0) + (p.current_replies || 0) + (p.current_reposts || 0) + (p.current_quotes || 0);
    const shares = (p.current_reposts || 0) + (p.current_quotes || 0);
    return {
      id: p.id,
      text: p.text || '',
      views,
      likes: p.current_likes || 0,
      replies: p.current_replies || 0,
      reposts: p.current_reposts || 0,
      quotes: p.current_quotes || 0,
      engagement_rate: views > 0 ? interactions / views : 0,
      virality_score: views > 0 ? shares / views : 0,
      published_at: new Date(p.published_at).toLocaleDateString('zh-TW'),
      media_type: p.media_type || 'TEXT',
      char_count: p.char_count || 0,
      has_question: p.has_question || false,
      has_cta: p.has_cta || false,
    };
  });

  // 內容特徵效益分析
  const contentFeatures = analyzeContentFeatures(currentPosts);

  // 標籤效益分析
  const tagPerformance = await analyzeTagPerformance(supabase, accountId, currentPosts);

  // 互動品質指標
  const engagementQuality = analyzeEngagementQuality(currentPosts);

  // 早期表現指標
  const earlyPerformance = analyzeEarlyPerformance(currentPosts);

  // 傳播力指標
  const totalSharesForVirality = totalReposts + totalQuotes;
  const avgViralityScore = totalViews > 0 ? totalSharesForVirality / totalViews : 0;
  const highViralityPosts = currentPosts.filter((p) => {
    const views = p.current_views || 0;
    const shares = (p.current_reposts || 0) + (p.current_quotes || 0);
    return views > 0 && (shares / views) > 0.01;
  }).length;

  // 時段分佈
  const hourlyMap = new Map<number, { count: number; views: number; interactions: number }>();
  for (let h = 0; h < 24; h++) {
    hourlyMap.set(h, { count: 0, views: 0, interactions: 0 });
  }
  currentPosts.forEach((p) => {
    const hour = new Date(p.published_at).getHours();
    const views = p.current_views || 0;
    const interactions = (p.current_likes || 0) + (p.current_replies || 0) + (p.current_reposts || 0) + (p.current_quotes || 0);
    const existing = hourlyMap.get(hour)!;
    hourlyMap.set(hour, {
      count: existing.count + 1,
      views: existing.views + views,
      interactions: existing.interactions + interactions,
    });
  });

  const hourlyDistribution = Array.from(hourlyMap.entries()).map(([hour, stats]) => ({
    hour,
    post_count: stats.count,
    avg_views: stats.count > 0 ? Math.round(stats.views / stats.count) : 0,
    avg_engagement: stats.views > 0 ? stats.interactions / stats.views : 0,
  }));

  // 前一期間數據（根據當前選擇的期間長度動態計算）
  const periodDays = Math.ceil(
    (new Date(weekEnd).getTime() - new Date(weekStart).getTime()) / (1000 * 60 * 60 * 24)
  ) + 1; // +1 因為包含首尾兩天

  const prevWeekEnd = new Date(weekStart);
  prevWeekEnd.setDate(prevWeekEnd.getDate() - 1); // 前一期間結束 = 當前期間開始的前一天
  const prevWeekStart = new Date(prevWeekEnd);
  prevWeekStart.setDate(prevWeekEnd.getDate() - periodDays + 1); // 往前推相同天數

  const prevWeekStartStr = prevWeekStart.toISOString().split('T')[0];
  const prevWeekEndStr = prevWeekEnd.toISOString().split('T')[0];

  const { data: prevPosts } = await supabase
    .from('workspace_threads_posts')
    .select('current_views, current_likes, current_replies, current_reposts, current_quotes')
    .eq('workspace_threads_account_id', accountId)
    .neq('media_type', 'REPOST_FACADE')
    .gte('published_at', `${prevWeekStartStr}T00:00:00Z`)
    .lte('published_at', `${prevWeekEndStr}T23:59:59Z`);

  const { data: prevEndInsight } = await supabase
    .from('workspace_threads_account_insights_daily')
    .select('followers_count')
    .eq('workspace_threads_account_id', accountId)
    .lte('bucket_date', prevWeekEndStr)
    .order('bucket_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  let previousWeek = null;
  if (prevPosts && prevPosts.length > 0) {
    const prevTotalViews = prevPosts.reduce((sum, p) => sum + (p.current_views || 0), 0);
    const prevTotalInteractions = prevPosts.reduce(
      (sum, p) => sum + (p.current_likes || 0) + (p.current_replies || 0) + (p.current_reposts || 0) + (p.current_quotes || 0),
      0
    );
    const prevTotalShares = prevPosts.reduce(
      (sum, p) => sum + (p.current_reposts || 0) + (p.current_quotes || 0),
      0
    );
    previousWeek = {
      total_views: prevTotalViews,
      total_interactions: prevTotalInteractions,
      post_count: prevPosts.length,
      avg_virality_score: prevTotalViews > 0 ? prevTotalShares / prevTotalViews : 0,
      followers_count: prevEndInsight?.followers_count || account.current_followers_count,
    };
  }

  // 演算法狀態分析
  const algorithmStatus = analyzeAlgorithmStatus(currentPosts, dailyMetrics, dailyFollowersMap, account.current_followers_count);

  return {
    account: {
      username: account.username,
      name: account.name || account.username,
      followers_count: account.current_followers_count || 0,
      followers_growth: followersGrowth,
    },
    period: {
      start: weekStart,
      end: weekEnd,
    },
    summary: {
      post_count: currentPosts.length,
      total_views: totalViews,
      total_likes: totalLikes,
      total_replies: totalReplies,
      total_reposts: totalReposts,
      total_quotes: totalQuotes,
      total_shares: totalShares,
      total_interactions: totalInteractions,
      engagement_rate: totalViews > 0 ? totalInteractions / totalViews : 0,
      avg_virality_score: avgViralityScore,
    },
    daily_metrics: dailyMetrics,
    top_posts: topPosts,
    content_features: contentFeatures,
    tag_performance: tagPerformance,
    engagement_quality: engagementQuality,
    early_performance: earlyPerformance,
    virality_metrics: {
      avg_virality_score: avgViralityScore,
      high_virality_posts: highViralityPosts,
      total_shares: totalSharesForVirality,
    },
    hourly_distribution: hourlyDistribution,
    previous_week: previousWeek,
    algorithm_status: algorithmStatus,
  };
}

// ============================================================================
// 內容特徵分析
// ============================================================================

interface PostData {
  media_type?: string;
  char_count?: number;
  current_views?: number;
  current_likes?: number;
  current_replies?: number;
  current_reposts?: number;
  current_quotes?: number;
  has_question?: boolean;
  question_type?: string | null;
  has_cta?: boolean;
  cta_type?: string | null;
}

function analyzeContentFeatures(posts: PostData[]) {
  // 媒體類型分析
  const mediaTypeMap = new Map<string, { count: number; views: number; interactions: number }>();
  posts.forEach((p) => {
    const type = p.media_type || 'TEXT';
    const existing = mediaTypeMap.get(type) || { count: 0, views: 0, interactions: 0 };
    const views = p.current_views || 0;
    const interactions = (p.current_likes || 0) + (p.current_replies || 0) + (p.current_reposts || 0) + (p.current_quotes || 0);
    mediaTypeMap.set(type, {
      count: existing.count + 1,
      views: existing.views + views,
      interactions: existing.interactions + interactions,
    });
  });

  const byMediaType = Array.from(mediaTypeMap.entries()).map(([type, stats]) => ({
    type,
    count: stats.count,
    avg_views: stats.count > 0 ? Math.round(stats.views / stats.count) : 0,
    avg_engagement_rate: stats.views > 0 ? stats.interactions / stats.views : 0,
  })).sort((a, b) => b.avg_views - a.avg_views);

  // 長度分析
  const lengthRanges = [
    { range: '短文 (1-50字)', min: 1, max: 50 },
    { range: '中文 (51-150字)', min: 51, max: 150 },
    { range: '長文 (151-300字)', min: 151, max: 300 },
    { range: '超長文 (300+字)', min: 301, max: Infinity },
  ];

  const byLength = lengthRanges.map((range) => {
    const filtered = posts.filter((p) => {
      const len = p.char_count || 0;
      return len >= range.min && len <= range.max;
    });
    const totalViews = filtered.reduce((sum, p) => sum + (p.current_views || 0), 0);
    const totalInteractions = filtered.reduce(
      (sum, p) => sum + (p.current_likes || 0) + (p.current_replies || 0) + (p.current_reposts || 0) + (p.current_quotes || 0),
      0
    );
    return {
      range: range.range,
      count: filtered.length,
      avg_views: filtered.length > 0 ? Math.round(totalViews / filtered.length) : 0,
      avg_engagement_rate: totalViews > 0 ? totalInteractions / totalViews : 0,
    };
  }).filter((r) => r.count > 0);

  // 問句分析
  const withQuestion = posts.filter((p) => p.has_question === true);
  const withoutQuestion = posts.filter((p) => p.has_question !== true);

  const withQuestionViews = withQuestion.reduce((sum, p) => sum + (p.current_views || 0), 0);
  const withQuestionReplies = withQuestion.reduce((sum, p) => sum + (p.current_replies || 0), 0);
  const withoutQuestionViews = withoutQuestion.reduce((sum, p) => sum + (p.current_views || 0), 0);
  const withoutQuestionReplies = withoutQuestion.reduce((sum, p) => sum + (p.current_replies || 0), 0);

  const byQuestion = {
    with_question: {
      count: withQuestion.length,
      avg_views: withQuestion.length > 0 ? Math.round(withQuestionViews / withQuestion.length) : 0,
      avg_replies: withQuestion.length > 0 ? withQuestionReplies / withQuestion.length : 0,
    },
    without_question: {
      count: withoutQuestion.length,
      avg_views: withoutQuestion.length > 0 ? Math.round(withoutQuestionViews / withoutQuestion.length) : 0,
      avg_replies: withoutQuestion.length > 0 ? withoutQuestionReplies / withoutQuestion.length : 0,
    },
  };

  // CTA 分析
  const withCta = posts.filter((p) => p.has_cta === true);
  const withoutCta = posts.filter((p) => p.has_cta !== true);

  const withCtaViews = withCta.reduce((sum, p) => sum + (p.current_views || 0), 0);
  const withCtaInteractions = withCta.reduce(
    (sum, p) => sum + (p.current_likes || 0) + (p.current_replies || 0) + (p.current_reposts || 0) + (p.current_quotes || 0),
    0
  );
  const withoutCtaViews = withoutCta.reduce((sum, p) => sum + (p.current_views || 0), 0);
  const withoutCtaInteractions = withoutCta.reduce(
    (sum, p) => sum + (p.current_likes || 0) + (p.current_replies || 0) + (p.current_reposts || 0) + (p.current_quotes || 0),
    0
  );

  const byCta = {
    with_cta: {
      count: withCta.length,
      avg_views: withCta.length > 0 ? Math.round(withCtaViews / withCta.length) : 0,
      avg_engagement_rate: withCtaViews > 0 ? withCtaInteractions / withCtaViews : 0,
    },
    without_cta: {
      count: withoutCta.length,
      avg_views: withoutCta.length > 0 ? Math.round(withoutCtaViews / withoutCta.length) : 0,
      avg_engagement_rate: withoutCtaViews > 0 ? withoutCtaInteractions / withoutCtaViews : 0,
    },
  };

  return {
    by_media_type: byMediaType,
    by_length: byLength,
    by_question: byQuestion,
    by_cta: byCta,
  };
}

// ============================================================================
// 標籤效益分析
// ============================================================================

interface PostWithTags {
  id: string;
  current_views?: number;
  current_likes?: number;
  current_replies?: number;
  current_reposts?: number;
  current_quotes?: number;
  ai_selected_tags?: Record<string, string[]>;
}

async function analyzeTagPerformance(
  supabase: ReturnType<typeof createServiceClient>,
  accountId: string,
  posts: PostWithTags[]
) {
  const postIds = posts.map((p) => p.id);

  // 取得用戶標籤
  const { data: postTags } = await supabase
    .from('workspace_threads_post_tags')
    .select(`
      post_id,
      tag:workspace_threads_account_tags(id, name, color)
    `)
    .in('post_id', postIds);

  // 聚合用戶標籤效益
  const userTagMap = new Map<string, { name: string; color: string; count: number; views: number; interactions: number }>();

  (postTags || []).forEach((pt) => {
    const tag = pt.tag as { id: string; name: string; color: string } | null;
    if (!tag) return;

    const post = posts.find((p) => p.id === pt.post_id);
    if (!post) return;

    const existing = userTagMap.get(tag.id) || { name: tag.name, color: tag.color, count: 0, views: 0, interactions: 0 };
    const views = post.current_views || 0;
    const interactions = (post.current_likes || 0) + (post.current_replies || 0) + (post.current_reposts || 0) + (post.current_quotes || 0);

    userTagMap.set(tag.id, {
      ...existing,
      count: existing.count + 1,
      views: existing.views + views,
      interactions: existing.interactions + interactions,
    });
  });

  const userTags = Array.from(userTagMap.values()).map((t) => ({
    name: t.name,
    color: t.color,
    count: t.count,
    avg_views: t.count > 0 ? Math.round(t.views / t.count) : 0,
    avg_engagement_rate: t.views > 0 ? t.interactions / t.views : 0,
  })).sort((a, b) => b.avg_views - a.avg_views);

  // 聚合 AI 標籤效益（只計算已選的）
  const aiTagMap = new Map<string, { dimension: string; tag: string; count: number; views: number; interactions: number }>();

  posts.forEach((p) => {
    const selectedTags = p.ai_selected_tags as Record<string, string[]> | null;
    if (!selectedTags) return;

    const views = p.current_views || 0;
    const interactions = (p.current_likes || 0) + (p.current_replies || 0) + (p.current_reposts || 0) + (p.current_quotes || 0);

    Object.entries(selectedTags).forEach(([dimension, tags]) => {
      (tags || []).forEach((tag) => {
        const key = `${dimension}:${tag}`;
        const existing = aiTagMap.get(key) || { dimension, tag, count: 0, views: 0, interactions: 0 };
        aiTagMap.set(key, {
          ...existing,
          count: existing.count + 1,
          views: existing.views + views,
          interactions: existing.interactions + interactions,
        });
      });
    });
  });

  const aiTags = Array.from(aiTagMap.values()).map((t) => ({
    dimension: t.dimension,
    tag: t.tag,
    count: t.count,
    avg_views: t.count > 0 ? Math.round(t.views / t.count) : 0,
    avg_engagement_rate: t.views > 0 ? t.interactions / t.views : 0,
  })).sort((a, b) => b.avg_views - a.avg_views);

  return {
    user_tags: userTags,
    ai_tags: aiTags,
  };
}

// ============================================================================
// 互動品質分析
// ============================================================================

interface PostWithQuality {
  discussion_depth?: number;
  share_willingness?: number;
}

function analyzeEngagementQuality(posts: PostWithQuality[]) {
  const postsWithData = posts.filter((p) => p.discussion_depth !== null && p.discussion_depth !== undefined);

  const avgDiscussionDepth = postsWithData.length > 0
    ? postsWithData.reduce((sum, p) => sum + (p.discussion_depth || 0), 0) / postsWithData.length
    : 0;

  const avgShareWillingness = postsWithData.length > 0
    ? postsWithData.reduce((sum, p) => sum + (p.share_willingness || 0), 0) / postsWithData.length
    : 0;

  const deepDiscussionPosts = posts.filter((p) => (p.discussion_depth || 0) >= 3).length;
  const highSharePosts = posts.filter((p) => (p.share_willingness || 0) >= 0.3).length;

  return {
    avg_discussion_depth: avgDiscussionDepth,
    avg_share_willingness: avgShareWillingness,
    deep_discussion_posts: deepDiscussionPosts,
    high_share_posts: highSharePosts,
  };
}

// ============================================================================
// 早期表現分析
// ============================================================================

interface PostWithEarlyMetrics {
  first_hour_views?: number;
  first_24h_views?: number;
  current_views?: number;
}

function analyzeEarlyPerformance(posts: PostWithEarlyMetrics[]) {
  const postsWithData = posts.filter((p) => p.first_hour_views !== null && p.first_hour_views !== undefined);

  if (postsWithData.length === 0) {
    return {
      avg_first_hour_views: 0,
      avg_first_24h_views: 0,
      first_hour_ratio: 0,
    };
  }

  const avgFirstHourViews = postsWithData.reduce((sum, p) => sum + (p.first_hour_views || 0), 0) / postsWithData.length;
  const avgFirst24hViews = postsWithData.reduce((sum, p) => sum + (p.first_24h_views || 0), 0) / postsWithData.length;

  // 計算首小時佔總曝光的比例
  const ratios = postsWithData
    .filter((p) => (p.current_views || 0) > 0)
    .map((p) => (p.first_hour_views || 0) / (p.current_views || 1));

  const firstHourRatio = ratios.length > 0
    ? ratios.reduce((sum, r) => sum + r, 0) / ratios.length
    : 0;

  return {
    avg_first_hour_views: Math.round(avgFirstHourViews),
    avg_first_24h_views: Math.round(avgFirst24hViews),
    first_hour_ratio: firstHourRatio,
  };
}

// ============================================================================
// 演算法狀態分析（限流監測）
// ============================================================================

interface PostForAlgorithm {
  id: string;
  text?: string;
  published_at: string;
  current_views?: number;
}

interface DailyMetric {
  date: string;
  views: number;
  post_count: number;
}

function analyzeAlgorithmStatus(
  posts: PostForAlgorithm[],
  dailyMetrics: DailyMetric[],
  dailyFollowersMap: Map<string, number>,
  currentFollowers: number
) {
  // 計算每日觸及倍數
  const dailyReachData: Array<{
    date: string;
    avg_reach: number;
    cumulative_reach: number;
    post_count: number;
  }> = [];

  // 按日期排序
  const sortedDays = [...dailyMetrics].sort((a, b) => a.date.localeCompare(b.date));

  // 計算滾動累計觸及倍數
  let rollingViews = 0;
  const viewsWindow: number[] = [];

  sortedDays.forEach((day) => {
    const followers = dailyFollowersMap.get(day.date) || currentFollowers;
    const dailyReach = followers > 0 ? day.views / followers : 0;

    // 加入滾動視窗
    viewsWindow.push(day.views);
    rollingViews += day.views;

    // 保持 7 天視窗
    if (viewsWindow.length > 7) {
      rollingViews -= viewsWindow.shift()!;
    }

    const cumulativeReach = followers > 0 ? rollingViews / followers : 0;

    dailyReachData.push({
      date: day.date,
      avg_reach: Math.round(dailyReach * 100) / 100,
      cumulative_reach: Math.round(cumulativeReach * 100) / 100,
      post_count: day.post_count,
    });
  });

  // 計算最終的滾動 7 天累計觸及倍數
  const latestFollowers = currentFollowers;
  const rolling7dReach = latestFollowers > 0 ? rollingViews / latestFollowers : 0;

  // 判斷配額狀態
  let quotaStatus: 'normal' | 'elevated' | 'warning' | 'throttled';
  if (rolling7dReach < 200) {
    quotaStatus = 'normal';
  } else if (rolling7dReach < 500) {
    quotaStatus = 'elevated';
  } else if (rolling7dReach < 900) {
    quotaStatus = 'warning';
  } else {
    quotaStatus = 'throttled';
  }

  // 偵測爆發事件（單篇觸及倍數 >= 200）
  const burstEvents: Array<{
    post_id: string;
    post_text: string;
    date: string;
    reach_multiplier: number;
    views: number;
  }> = [];

  posts.forEach((post) => {
    const views = post.current_views || 0;
    const publishDate = new Date(post.published_at).toISOString().split('T')[0];
    const followers = dailyFollowersMap.get(publishDate) || currentFollowers;
    const reachMultiplier = followers > 0 ? views / followers : 0;

    if (reachMultiplier >= 200) {
      burstEvents.push({
        post_id: post.id,
        post_text: (post.text || '').slice(0, 50) + ((post.text?.length || 0) > 50 ? '...' : ''),
        date: publishDate,
        reach_multiplier: Math.round(reachMultiplier * 10) / 10,
        views,
      });
    }
  });

  // 按觸及倍數排序
  burstEvents.sort((a, b) => b.reach_multiplier - a.reach_multiplier);

  return {
    rolling_7d_reach: Math.round(rolling7dReach * 10) / 10,
    quota_status: quotaStatus,
    burst_events: burstEvents.slice(0, 3), // 最多顯示 3 個
    daily_reach: dailyReachData,
  };
}
