/**
 * Content Pattern Report - 產生內容模式分析報告
 *
 * POST /content-pattern-report
 * Headers: Authorization: Bearer <USER_JWT>
 * Body: { accountId: string }
 *
 * 分析 90 天貼文數據，找出成功內容模式與失敗模式
 */

import { handleCors } from '../_shared/cors.ts';
import { createAnonClient, createServiceClient } from '../_shared/supabase.ts';
import { jsonResponse, errorResponse, unauthorizedResponse } from '../_shared/response.ts';
import { getAuthenticatedUser, isSystemAdmin } from '../_shared/auth.ts';
import { ClaudeClient } from '../_shared/claude.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');

// 分析期間（天）
const ANALYSIS_DAYS = 90;
// 最低樣本數
const MIN_POSTS_REQUIRED = 5;
// 額度期間（天）
const QUOTA_PERIOD_DAYS = 7;
// 額度限制
const QUOTA_LIMIT = 1;

interface RequestBody {
  accountId: string;
  model?: 'sonnet' | 'opus';
  timezone?: string; // IANA timezone (e.g., 'Asia/Taipei')
  startDate?: string; // YYYY-MM-DD 格式，可選
  endDate?: string;   // YYYY-MM-DD 格式，可選
}

// 常見時區偏移（小時）
const TIMEZONE_OFFSETS: Record<string, number> = {
  'Asia/Taipei': 8,
  'Asia/Tokyo': 9,
  'Asia/Shanghai': 8,
  'Asia/Hong_Kong': 8,
  'America/New_York': -5,
  'America/Los_Angeles': -8,
  'Europe/London': 0,
  'UTC': 0,
};

// 模型 ID 對應
const MODEL_IDS: Record<string, string> = {
  sonnet: 'claude-sonnet-4-20250514',
  opus: 'claude-opus-4-5-20251101',
};

// ============================================================================
// 數據快照類型定義
// ============================================================================

interface ContentPatternSnapshot {
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
    content_type: Array<TagStats>;
    tone: Array<TagStats>;
    intent: Array<TagStats>;
    topic: Array<TagStats>;
    format: Array<TagStats>;
  };
  user_tags: Array<UserTagStats>;
  timing: {
    best_hours: number[];
    best_days: number[];
    heatmap: Array<{ day: number; hour: number; count: number; avg_engagement: number }>;
  };
  success_patterns: {
    top_posts: Array<PostSummary>;
    common_features: string[];
    formula: string;
  };
  failure_patterns: {
    bottom_posts: Array<PostSummary>;
    common_issues: string[];
    avoid: string[];
  };
  throttling_analysis: {
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

interface FeatureStats {
  count: number;
  avg_views: number;
  avg_engagement_rate: number;
  avg_replies: number;
}

interface TagStats {
  tag: string;
  count: number;
  avg_views: number;
  avg_engagement_rate: number;
  rank: number;
}

interface UserTagStats {
  name: string;
  color: string;
  count: number;
  avg_views: number;
  avg_engagement_rate: number;
}

interface PostSummary {
  id: string;
  text: string;
  views: number;
  engagement_rate: number;
  media_type: string;
  char_count: number;
  features: string[];
  published_at: string;
}

// ============================================================================
// 報告內容類型定義
// ============================================================================

interface ContentPatternReport {
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
  user_tag_analysis: {
    summary: string;
    insights: string[];
    recommendations: string[];
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
  throttling_warning: {
    has_risk: boolean;
    summary: string;
    affected_examples: string[];
    recommendations: string[];
  };
}

// ============================================================================
// System Prompt
// ============================================================================

const SYSTEM_PROMPT = `你是一位資深內容策略顧問，專精於社群媒體內容分析。你的任務是根據 90 天的貼文數據，找出帳號的成功內容模式與失敗模式，產出可複製的內容策略建議。

## 你的角色

你不是提供籠統建議的顧問，而是一位數據驅動的內容分析師。你的每一個發現都必須有數據支撐，每一個建議都必須具體到可以直接執行。

## 報告結構

你需要產出一份結構化的 JSON 報告，包含以下區塊：

### 1. 執行摘要 (executive_summary)
- content_health_score: 1-100 的內容健康度評分
- headline: 一句話總結帳號的內容特色
- key_findings: 3 個最重要的發現（用數據說話）
- quick_wins: 3 個可以立即執行的建議

### 2. 內容格式分析 (media_type_analysis)
- 分析不同媒體類型（純文字、圖片、影片、輪播）的效益
- 找出表現最好和最差的格式
- 給出具體的格式選擇建議

### 3. 內容長度分析 (length_analysis)
- 分析不同長度區間的效益
- 找出最佳長度區間
- 說明原因

### 4. 內容特徵分析 (feature_analysis)
- emoji: 使用 emoji 的效益
- hashtag: 使用 hashtag 的效益
- question: 使用問句的效益
- cta: 使用 CTA 的效益

### 5. AI 標籤分析 (ai_tag_analysis)
- 分析各維度標籤的效益排行
- 找出表現最好的標籤組合

### 5.5 用戶自定義標籤分析 (user_tag_analysis)
- 分析用戶自定義標籤的效益
- 找出高表現與低表現的標籤
- 給出標籤使用策略建議

### 6. 發文時間分析 (timing_analysis)
- 找出最佳發文時段
- 說明時段選擇的數據依據

### 7. 成功模式識別 (success_formula)
- 從 Top 貼文中找出共同特徵
- 產出可複製的「成功公式」
- 說明為什麼這個公式有效

### 8. 失敗模式警示 (failure_warning)
- 從低表現貼文中找出共同問題
- 列出應該避免的模式

### 9. 限流警示 (throttling_warning)
- 基於「觸及倍數」分析是否存在「高爆文後限流」的現象
- 觸及倍數 = 貼文曝光數 / 粉絲數，反映演算法對內容的放大倍率
- 觸及倍數閾值定義：
  - ≥ 200：爆文（進入爆發性傳播）
  - < 20：可能被限流
- 當帳號有爆文（觸及倍數 ≥ 200）後，後續 7 天內的貼文觸及倍數可能大幅下降
- 這是 Threads 演算法的「配額制」機制，不是內容品質問題
- 如果偵測到此模式，需要說明：
  - 哪些爆文（附帶觸及倍數）可能觸發了限流
  - 後續哪些貼文的觸及倍數明顯下降
  - 提醒用戶這是正常現象，通常 5-10 天後會恢復

## 回應格式

你必須以純 JSON 格式回應，不要包含 markdown code block：

{
  "executive_summary": {
    "content_health_score": 75,
    "headline": "一句話總結",
    "key_findings": ["發現1", "發現2", "發現3"],
    "quick_wins": ["建議1", "建議2", "建議3"]
  },
  "media_type_analysis": {
    "summary": "摘要",
    "insights": ["洞察1", "洞察2"],
    "recommendation": "建議"
  },
  "length_analysis": {
    "summary": "摘要",
    "insights": ["洞察1", "洞察2"],
    "optimal_range": "100-150 字"
  },
  "feature_analysis": {
    "emoji": { "insight": "洞察", "recommendation": "建議" },
    "hashtag": { "insight": "洞察", "recommendation": "建議" },
    "question": { "insight": "洞察", "recommendation": "建議" },
    "cta": { "insight": "洞察", "recommendation": "建議" }
  },
  "ai_tag_analysis": {
    "summary": "摘要",
    "top_performing_combination": "組合描述",
    "insights": ["洞察1", "洞察2"]
  },
  "user_tag_analysis": {
    "summary": "用戶標籤效益摘要",
    "insights": ["洞察1", "洞察2"],
    "recommendations": ["建議1", "建議2"]
  },
  "timing_analysis": {
    "summary": "摘要",
    "best_slots": ["週三 20:00", "週五 21:00"],
    "insights": ["洞察1", "洞察2"]
  },
  "success_formula": {
    "pattern": "輪播 + 100-150字 + 問句結尾",
    "examples": ["範例貼文摘要1", "範例貼文摘要2"],
    "why_it_works": "解釋為什麼這個公式有效"
  },
  "failure_warning": {
    "patterns_to_avoid": ["避免模式1", "避免模式2"],
    "common_mistakes": ["常見錯誤1", "常見錯誤2"]
  },
  "throttling_warning": {
    "has_risk": true,
    "summary": "偵測到高爆文後限流現象的摘要",
    "affected_examples": ["受影響的例子1", "受影響的例子2"],
    "recommendations": ["建議1", "建議2"]
  }
}

## 分析原則

1. **數據優先**：每個發現都要有數據支撐，不要憑空推測
2. **樣本數檢查**：樣本數不足（< 3 篇）的類別，要明確說明數據不足
3. **相對比較**：使用「與平均比較」的方式呈現效益
4. **可執行性**：建議要具體到可以直接執行
5. **正向框架**：用成長機會取代批評

## 語言規範

請使用**繁體中文（台灣用語）**撰寫，注意以下用詞：
- 使用「貼文」而非「帖子」
- 使用「粉絲」而非「關注者」
- 使用「曝光」而非「展示」
- 使用「互動」而非「交互」
- 使用「轉發」而非「轉帖」
- 使用「回覆」而非「評論」`;

// ============================================================================
// Main Handler
// ============================================================================

Deno.serve(async (req) => {
  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // 驗證使用者
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
        .select('id, report_type')
        .eq('id', reportId)
        .eq('report_type', 'content')
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
    const { accountId, model = 'sonnet', timezone = 'Asia/Taipei', startDate: reqStartDate, endDate: reqEndDate } = body;
    const modelId = MODEL_IDS[model] || MODEL_IDS.sonnet;

    if (!accountId) {
      return errorResponse(req, 'accountId is required');
    }

    // 計算分析期間
    let weekStartStr: string;
    let weekEndStr: string;

    if (reqStartDate && reqEndDate) {
      // 使用者指定日期範圍
      // 驗證日期格式 (YYYY-MM-DD)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(reqStartDate) || !dateRegex.test(reqEndDate)) {
        return errorResponse(req, '日期格式錯誤，請使用 YYYY-MM-DD 格式');
      }

      const start = new Date(reqStartDate);
      const end = new Date(reqEndDate);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return errorResponse(req, '無效的日期');
      }

      if (start > end) {
        return errorResponse(req, '開始日期不能晚於結束日期');
      }

      // 限制最大範圍 90 天
      const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff > 90) {
        return errorResponse(req, '日期範圍不能超過 90 天');
      }

      weekStartStr = reqStartDate;
      weekEndStr = reqEndDate;
    } else {
      // 預設：過去 90 天
      const now = new Date();
      const endDate = new Date(now);
      endDate.setDate(now.getDate() - 1); // 昨天
      const startDate = new Date(endDate);
      startDate.setDate(endDate.getDate() - ANALYSIS_DAYS + 1);

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

    // 非管理員：每 7 天限制產生 1 份內容模式報告（與週報分開計算）
    if (!isAdmin) {
      const sevenDaysAgo = new Date(now.getTime() - QUOTA_PERIOD_DAYS * 24 * 60 * 60 * 1000).toISOString();
      const { count: completedCount } = await serviceClient
        .from('ai_weekly_reports')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_threads_account_id', accountId)
        .eq('report_type', 'content')
        .eq('status', 'completed')
        .gte('created_at', sevenDaysAgo);

      if ((completedCount || 0) >= QUOTA_LIMIT) {
        return errorResponse(
          req,
          '每 7 天只能產生 1 份內容模式報告。請稍後再試。',
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
      .eq('report_type', 'content')
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
        report_type: 'content',
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
        console.log(`Starting content pattern report for account ${accountId}`);

        // 聚合 90 天數據
        const dataSnapshot = await aggregateContentPatternData(
          serviceClient,
          accountId,
          weekStartStr,
          weekEndStr,
          account.current_followers_count,
          timezone
        );

        console.log(`Data aggregation completed: ${dataSnapshot.analysis_period.total_posts} posts`);

        // 檢查是否有足夠的數據
        if (dataSnapshot.analysis_period.total_posts < MIN_POSTS_REQUIRED) {
          await serviceClient
            .from('ai_weekly_reports')
            .update({
              status: 'failed',
              error_message: `數據不足，需要至少 ${MIN_POSTS_REQUIRED} 篇貼文才能產生報告（目前 ${dataSnapshot.analysis_period.total_posts} 篇）`,
            })
            .eq('id', reportId);
          return;
        }

        // 建構 User Prompt
        const userPrompt = buildUserPrompt(dataSnapshot);

        // 呼叫 Claude API
        const claude = new ClaudeClient(ANTHROPIC_API_KEY, modelId);
        const result = await claude.generateWeeklyReport<ContentPatternReport>(SYSTEM_PROMPT, userPrompt);

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
          purpose: 'content_pattern_report',
          metadata: {
            report_id: reportId,
            analysis_days: ANALYSIS_DAYS,
            total_posts: dataSnapshot.analysis_period.total_posts,
          },
        });

        console.log(`Content pattern report ${reportId} completed successfully`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Content pattern report ${reportId} failed:`, errorMessage, error);

        await serviceClient
          .from('ai_weekly_reports')
          .update({
            status: 'failed',
            error_message: errorMessage || '報告產生失敗，請稍後再試',
          })
          .eq('id', reportId);
      }
    };

    // 使用 EdgeRuntime.waitUntil 在背景執行
    // @ts-ignore - EdgeRuntime is available in Supabase Edge Functions
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(processReport());
    } else {
      processReport().catch(console.error);
    }

    // 立即回傳報告 ID
    return jsonResponse(req, {
      reportId,
      status: 'generating',
    });
  } catch (error) {
    console.error('Content pattern report error:', error);
    return errorResponse(req, '報告產生失敗，請稍後再試', 500);
  }
});

// ============================================================================
// 建構 User Prompt
// ============================================================================

function buildUserPrompt(data: ContentPatternSnapshot): string {
  const sections: string[] = [];

  // 帳號與分析期間
  sections.push(`## 帳號資訊
- 用戶名稱：@${data.account.username}
- 顯示名稱：${data.account.name}
- 目前粉絲數：${data.account.followers_count.toLocaleString()}`);

  sections.push(`## 分析期間
- 期間：${data.analysis_period.start} ~ ${data.analysis_period.end}（${data.analysis_period.days} 天）
- 總貼文數：${data.analysis_period.total_posts} 篇`);

  // 整體平均
  sections.push(`## 整體平均表現
- 平均曝光：${data.overall_avg.views.toLocaleString()}
- 平均互動率：${(data.overall_avg.engagement_rate * 100).toFixed(2)}%
- 平均傳播力：${(data.overall_avg.virality_score * 100).toFixed(2)}%`);

  // 媒體類型效益
  if (data.media_type.length > 0) {
    const mediaLines = data.media_type.map(m =>
      `- ${m.type}：${m.count} 篇，平均曝光 ${m.avg_views.toLocaleString()}（${m.vs_average >= 0 ? '+' : ''}${(m.vs_average * 100).toFixed(0)}% vs 平均），互動率 ${(m.avg_engagement_rate * 100).toFixed(2)}%`
    );
    sections.push(`## 媒體類型效益\n${mediaLines.join('\n')}`);
  }

  // 內容長度效益
  if (data.content_length.length > 0) {
    const lengthLines = data.content_length.map(l =>
      `- ${l.range}：${l.count} 篇，平均曝光 ${l.avg_views.toLocaleString()}（${l.vs_average >= 0 ? '+' : ''}${(l.vs_average * 100).toFixed(0)}% vs 平均）`
    );
    sections.push(`## 內容長度效益\n${lengthLines.join('\n')}`);
  }

  // 內容特徵效益
  const features = data.content_features;
  sections.push(`## 內容特徵效益

### Emoji
- 有 Emoji：${features.emoji.with.count} 篇，平均曝光 ${features.emoji.with.avg_views.toLocaleString()}
- 無 Emoji：${features.emoji.without.count} 篇，平均曝光 ${features.emoji.without.avg_views.toLocaleString()}
${features.emoji.optimal_count !== null ? `- 最佳數量：${features.emoji.optimal_count} 個` : ''}

### Hashtag
- 有 Hashtag：${features.hashtag.with.count} 篇，平均曝光 ${features.hashtag.with.avg_views.toLocaleString()}
- 無 Hashtag：${features.hashtag.without.count} 篇，平均曝光 ${features.hashtag.without.avg_views.toLocaleString()}
${features.hashtag.optimal_count !== null ? `- 最佳數量：${features.hashtag.optimal_count} 個` : ''}

### 連結
- 有連結：${features.link.with.count} 篇，平均曝光 ${features.link.with.avg_views.toLocaleString()}
- 無連結：${features.link.without.count} 篇，平均曝光 ${features.link.without.avg_views.toLocaleString()}

### 問句
- 有問句：${features.question.with.count} 篇，平均曝光 ${features.question.with.avg_views.toLocaleString()}，平均回覆 ${features.question.with.avg_replies.toFixed(1)}
- 無問句：${features.question.without.count} 篇，平均曝光 ${features.question.without.avg_views.toLocaleString()}，平均回覆 ${features.question.without.avg_replies.toFixed(1)}
${features.question.best_type ? `- 最佳問句類型：${features.question.best_type}` : ''}

### CTA
- 有 CTA：${features.cta.with.count} 篇，平均曝光 ${features.cta.with.avg_views.toLocaleString()}
- 無 CTA：${features.cta.without.count} 篇，平均曝光 ${features.cta.without.avg_views.toLocaleString()}
${features.cta.best_type ? `- 最佳 CTA 類型：${features.cta.best_type}` : ''}`);

  // AI 標籤效益
  const tags = data.ai_tags;
  const tagSections: string[] = [];

  if (tags.content_type.length > 0) {
    const lines = tags.content_type.slice(0, 5).map((t, i) =>
      `${i + 1}. ${t.tag}：${t.count} 篇，平均曝光 ${t.avg_views.toLocaleString()}`
    );
    tagSections.push(`### 內容類型\n${lines.join('\n')}`);
  }

  if (tags.tone.length > 0) {
    const lines = tags.tone.slice(0, 5).map((t, i) =>
      `${i + 1}. ${t.tag}：${t.count} 篇，平均曝光 ${t.avg_views.toLocaleString()}`
    );
    tagSections.push(`### 語氣\n${lines.join('\n')}`);
  }

  if (tags.intent.length > 0) {
    const lines = tags.intent.slice(0, 5).map((t, i) =>
      `${i + 1}. ${t.tag}：${t.count} 篇，平均曝光 ${t.avg_views.toLocaleString()}`
    );
    tagSections.push(`### 意圖\n${lines.join('\n')}`);
  }

  if (tags.topic.length > 0) {
    const lines = tags.topic.slice(0, 5).map((t, i) =>
      `${i + 1}. ${t.tag}：${t.count} 篇，平均曝光 ${t.avg_views.toLocaleString()}`
    );
    tagSections.push(`### 主題\n${lines.join('\n')}`);
  }

  if (tags.format.length > 0) {
    const lines = tags.format.slice(0, 5).map((t, i) =>
      `${i + 1}. ${t.tag}：${t.count} 篇，平均曝光 ${t.avg_views.toLocaleString()}`
    );
    tagSections.push(`### 格式\n${lines.join('\n')}`);
  }

  if (tagSections.length > 0) {
    sections.push(`## AI 標籤效益排行\n${tagSections.join('\n\n')}`);
  }

  // 用戶自定義標籤效益
  if (data.user_tags && data.user_tags.length > 0) {
    const userTagLines = data.user_tags.slice(0, 10).map((t, i) =>
      `${i + 1}. ${t.name}：${t.count} 篇，平均曝光 ${t.avg_views.toLocaleString()}，互動率 ${(t.avg_engagement_rate * 100).toFixed(2)}%`
    );
    sections.push(`## 用戶自定義標籤效益排行
${userTagLines.join('\n')}

注意：這些是用戶自行定義的分類標籤，分析這些標籤可以幫助用戶了解不同內容主題的表現差異。`);
  }

  // 發文時間效益
  if (data.timing.best_hours.length > 0 || data.timing.best_days.length > 0) {
    const dayNames = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
    sections.push(`## 發文時間效益
- 最佳發文時段：${data.timing.best_hours.map(h => `${h}:00`).join('、')}
- 最佳發文日：${data.timing.best_days.map(d => dayNames[d]).join('、')}`);
  }

  // 成功模式
  if (data.success_patterns.top_posts.length > 0) {
    const postLines = data.success_patterns.top_posts.slice(0, 5).map((p, i) => {
      const text = p.text.length > 50 ? p.text.slice(0, 50) + '...' : p.text;
      return `${i + 1}. 「${text}」
   ${p.media_type} | ${p.char_count} 字 | ${p.features.join(', ')}
   曝光 ${p.views.toLocaleString()} | 互動率 ${(p.engagement_rate * 100).toFixed(2)}%`;
    });
    sections.push(`## Top 5 高表現貼文
${postLines.join('\n\n')}

### 共同特徵
${data.success_patterns.common_features.map(f => `- ${f}`).join('\n')}

### 成功公式
${data.success_patterns.formula}`);
  }

  // 失敗模式
  if (data.failure_patterns.bottom_posts.length > 0) {
    const postLines = data.failure_patterns.bottom_posts.slice(0, 5).map((p, i) => {
      const text = p.text.length > 50 ? p.text.slice(0, 50) + '...' : p.text;
      return `${i + 1}. 「${text}」
   ${p.media_type} | ${p.char_count} 字
   曝光 ${p.views.toLocaleString()} | 互動率 ${(p.engagement_rate * 100).toFixed(2)}%`;
    });
    sections.push(`## Bottom 5 低表現貼文
${postLines.join('\n\n')}

### 共同問題
${data.failure_patterns.common_issues.map(f => `- ${f}`).join('\n')}

### 應避免
${data.failure_patterns.avoid.map(f => `- ${f}`).join('\n')}`);
  }

  // 限流風險分析（基於觸及倍數）
  if (data.throttling_analysis) {
    const throttle = data.throttling_analysis;
    const baselineReachMultiplier = throttle.baseline_vfr ?? 0;

    if (throttle.has_risk) {
      const affectedLines = throttle.affected_posts.map((item, i) => {
        const viralText = item.viral_post.text.length > 30
          ? item.viral_post.text.slice(0, 30) + '...'
          : item.viral_post.text;
        const viralReachMultiplier = (item.viral_post as PostSummary & { vfr?: number }).vfr ?? 0;

        const followingInfo = item.following_posts.map((fp) => {
          const fpText = fp.text.length > 20 ? fp.text.slice(0, 20) + '...' : fp.text;
          const fpReachMultiplier = fp.vfr ?? 0;
          return `   - 「${fpText}」（${fp.hours_after}小時後，觸及倍數 ${fpReachMultiplier.toFixed(1)}x，曝光 ${fp.views.toLocaleString()}）`;
        }).join('\n');

        return `${i + 1}. 爆文：「${viralText}」（觸及倍數 ${viralReachMultiplier.toFixed(1)}x，曝光 ${item.viral_post.views.toLocaleString()}）
   後續貼文（觸及倍數明顯下降）：
${followingInfo}`;
      });

      sections.push(`## 限流風險分析（基於觸及倍數）

### 觸及倍數說明
- 觸及倍數 = 曝光數 / 粉絲數
- 當前粉絲數：${throttle.followers_count?.toLocaleString() ?? 'N/A'}
- 帳號基準觸及倍數：${baselineReachMultiplier.toFixed(1)}x（非爆文貼文平均）
- 爆文定義：觸及倍數 ≥ 200

### 偵測結果
- 偵測到限流風險：**是**
- 爆文數量：${throttle.viral_posts_count} 篇（觸及倍數 ≥ 200）
- 可能受影響的貼文：${throttle.potentially_throttled_count} 篇
- 平均觸及倍數下降幅度：${(throttle.avg_drop_rate * 100).toFixed(0)}%

### 受影響的案例
${affectedLines.join('\n\n')}

### 分析重點
1. 這些低觸及倍數的貼文是否因為「爆文後限流」而受到影響？
2. 比較這些貼文的內容品質與爆文是否相當 — 如果內容品質相近但觸及倍數差距很大，很可能是限流
3. 提醒用戶：這是 Threads 演算法的正常機制，不是內容問題，通常 5-10 天後會恢復`);
    } else {
      sections.push(`## 限流風險分析（基於觸及倍數）

### 觸及倍數說明
- 觸及倍數 = 曝光數 / 粉絲數
- 當前粉絲數：${throttle.followers_count?.toLocaleString() ?? 'N/A'}
- 帳號基準觸及倍數：${baselineReachMultiplier.toFixed(1)}x（非爆文貼文平均）

### 偵測結果
- 偵測到限流風險：否
- 爆文數量：${throttle.viral_posts_count} 篇
- 帳號目前沒有明顯的爆文後限流現象`);
    }
  }

  return sections.join('\n\n');
}

// ============================================================================
// 聚合 90 天數據
// ============================================================================

interface PostData {
  id: string;
  text?: string;
  published_at: string;
  media_type?: string;
  char_count?: number;
  current_views?: number;
  current_likes?: number;
  current_replies?: number;
  current_reposts?: number;
  current_quotes?: number;
  has_emoji?: boolean;
  emoji_count?: number;
  hashtag_count?: number;
  has_link?: boolean;
  has_question?: boolean;
  question_type?: string;
  has_cta?: boolean;
  cta_type?: string;
  ai_selected_tags?: Record<string, string[]>;
}

// Helper function to check if post has hashtags
function hasHashtag(post: PostData): boolean {
  return (post.hashtag_count || 0) > 0;
}

async function aggregateContentPatternData(
  supabase: ReturnType<typeof createServiceClient>,
  accountId: string,
  startDate: string,
  endDate: string,
  currentFollowers: number,
  timezone: string = 'Asia/Taipei'
): Promise<ContentPatternSnapshot> {
  // 取得帳號資訊
  const { data: account } = await supabase
    .from('workspace_threads_accounts')
    .select('username, name, current_followers_count')
    .eq('id', accountId)
    .single();

  if (!account) {
    throw new Error('Account not found');
  }

  // 取得貼文
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
      has_emoji,
      emoji_count,
      hashtag_count,
      has_link,
      has_question,
      question_type,
      has_cta,
      cta_type,
      ai_selected_tags
    `)
    .eq('workspace_threads_account_id', accountId)
    .not('media_type', 'eq', 'REPOST_FACADE')
    .gte('published_at', `${startDate}T00:00:00Z`)
    .lte('published_at', `${endDate}T23:59:59Z`)
    .order('current_views', { ascending: false });

  if (postsError) {
    console.error('Posts query error:', postsError);
    throw new Error('Failed to fetch posts');
  }

  const allPosts: PostData[] = posts || [];

  // 計算整體平均
  const totalViews = allPosts.reduce((sum, p) => sum + (p.current_views || 0), 0);
  const avgViews = allPosts.length > 0 ? totalViews / allPosts.length : 0;

  const avgEngagementRate = allPosts.length > 0
    ? allPosts.reduce((sum, p) => {
        const views = p.current_views || 0;
        const interactions = (p.current_likes || 0) + (p.current_replies || 0) + (p.current_reposts || 0) + (p.current_quotes || 0);
        return sum + (views > 0 ? interactions / views : 0);
      }, 0) / allPosts.length
    : 0;

  const avgViralityScore = allPosts.length > 0
    ? allPosts.reduce((sum, p) => {
        const views = p.current_views || 0;
        const shares = (p.current_reposts || 0) + (p.current_quotes || 0);
        return sum + (views > 0 ? shares / views : 0);
      }, 0) / allPosts.length
    : 0;

  // 分析媒體類型效益
  const mediaTypeAnalysis = analyzeMediaType(allPosts, avgViews);

  // 分析內容長度效益
  const lengthAnalysis = analyzeContentLength(allPosts, avgViews);

  // 分析內容特徵效益
  const featureAnalysis = analyzeContentFeatures(allPosts);

  // 分析 AI 標籤效益
  const aiTagAnalysis = analyzeAITags(allPosts);

  // 分析用戶自定義標籤效益
  const userTagAnalysis = await analyzeUserTags(supabase, allPosts);

  // 分析發文時間效益（使用用戶時區）
  const timingAnalysis = analyzeTimingEffectiveness(allPosts, timezone);

  // 識別成功/失敗模式
  const patterns = identifyPatterns(allPosts, avgViews);

  // 分析高爆文後的限流風險（基於 VFR）
  const throttlingAnalysis = analyzeThrottlingRisk(allPosts, avgViews, currentFollowers || account.current_followers_count || 1);

  return {
    account: {
      username: account.username,
      name: account.name || account.username,
      followers_count: currentFollowers || account.current_followers_count || 0,
    },
    analysis_period: {
      days: Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1,
      start: startDate,
      end: endDate,
      total_posts: allPosts.length,
    },
    overall_avg: {
      views: Math.round(avgViews),
      engagement_rate: avgEngagementRate,
      virality_score: avgViralityScore,
    },
    media_type: mediaTypeAnalysis,
    content_length: lengthAnalysis,
    content_features: featureAnalysis,
    ai_tags: aiTagAnalysis,
    user_tags: userTagAnalysis,
    timing: timingAnalysis,
    success_patterns: patterns.success,
    failure_patterns: patterns.failure,
    throttling_analysis: throttlingAnalysis,
  };
}

// ============================================================================
// 分析函數
// ============================================================================

function analyzeMediaType(posts: PostData[], avgViews: number) {
  const mediaTypeMap = new Map<string, { count: number; views: number; interactions: number; shares: number }>();

  posts.forEach((p) => {
    const type = p.media_type || 'TEXT';
    const existing = mediaTypeMap.get(type) || { count: 0, views: 0, interactions: 0, shares: 0 };
    const views = p.current_views || 0;
    const interactions = (p.current_likes || 0) + (p.current_replies || 0) + (p.current_reposts || 0) + (p.current_quotes || 0);
    const shares = (p.current_reposts || 0) + (p.current_quotes || 0);
    mediaTypeMap.set(type, {
      count: existing.count + 1,
      views: existing.views + views,
      interactions: existing.interactions + interactions,
      shares: existing.shares + shares,
    });
  });

  return Array.from(mediaTypeMap.entries())
    .filter(([_, stats]) => stats.count >= 3) // 最低樣本數
    .map(([type, stats]) => {
      const typeAvgViews = stats.count > 0 ? stats.views / stats.count : 0;
      return {
        type: translateMediaType(type),
        count: stats.count,
        avg_views: Math.round(typeAvgViews),
        avg_engagement_rate: stats.views > 0 ? stats.interactions / stats.views : 0,
        avg_virality_score: stats.views > 0 ? stats.shares / stats.views : 0,
        vs_average: avgViews > 0 ? (typeAvgViews - avgViews) / avgViews : 0,
      };
    })
    .sort((a, b) => b.avg_views - a.avg_views);
}

function translateMediaType(type: string): string {
  const translations: Record<string, string> = {
    TEXT: '純文字',
    TEXT_POST: '純文字',
    IMAGE: '圖片',
    VIDEO: '影片',
    CAROUSEL: '輪播',
    CAROUSEL_ALBUM: '輪播',
    REPOST_FACADE: '轉發',
  };
  return translations[type] || type;
}

function analyzeContentLength(posts: PostData[], avgViews: number) {
  const lengthRanges = [
    { range: '極短文 (1-30字)', min: 1, max: 30 },
    { range: '短文 (31-80字)', min: 31, max: 80 },
    { range: '中文 (81-150字)', min: 81, max: 150 },
    { range: '長文 (151-250字)', min: 151, max: 250 },
    { range: '超長文 (250+字)', min: 251, max: Infinity },
  ];

  return lengthRanges.map((range) => {
    const filtered = posts.filter((p) => {
      const len = p.char_count || 0;
      return len >= range.min && len <= range.max;
    });

    if (filtered.length < 3) {
      return { ...range, count: filtered.length, avg_views: 0, avg_engagement_rate: 0, vs_average: 0 };
    }

    const totalViews = filtered.reduce((sum, p) => sum + (p.current_views || 0), 0);
    const totalInteractions = filtered.reduce(
      (sum, p) => sum + (p.current_likes || 0) + (p.current_replies || 0) + (p.current_reposts || 0) + (p.current_quotes || 0),
      0
    );
    const rangeAvgViews = totalViews / filtered.length;

    return {
      range: range.range,
      min: range.min,
      max: range.max,
      count: filtered.length,
      avg_views: Math.round(rangeAvgViews),
      avg_engagement_rate: totalViews > 0 ? totalInteractions / totalViews : 0,
      vs_average: avgViews > 0 ? (rangeAvgViews - avgViews) / avgViews : 0,
    };
  }).filter((r) => r.count >= 3);
}

function analyzeContentFeatures(posts: PostData[]) {
  // Emoji 分析
  const withEmoji = posts.filter((p) => p.has_emoji === true);
  const withoutEmoji = posts.filter((p) => p.has_emoji !== true);

  const emojiCountMap = new Map<number, { count: number; views: number }>();
  withEmoji.forEach((p) => {
    const count = p.emoji_count || 0;
    const bucket = Math.min(count, 10); // Cap at 10+
    const existing = emojiCountMap.get(bucket) || { count: 0, views: 0 };
    emojiCountMap.set(bucket, {
      count: existing.count + 1,
      views: existing.views + (p.current_views || 0),
    });
  });

  let optimalEmojiCount: number | null = null;
  let maxEmojiAvgViews = 0;
  emojiCountMap.forEach((stats, count) => {
    if (stats.count >= 3) {
      const avgViews = stats.views / stats.count;
      if (avgViews > maxEmojiAvgViews) {
        maxEmojiAvgViews = avgViews;
        optimalEmojiCount = count;
      }
    }
  });

  // Hashtag 分析
  const withHashtag = posts.filter((p) => hasHashtag(p));
  const withoutHashtag = posts.filter((p) => !hasHashtag(p));

  const hashtagCountMap = new Map<number, { count: number; views: number }>();
  withHashtag.forEach((p) => {
    const count = p.hashtag_count || 0;
    const bucket = Math.min(count, 5); // Cap at 5+
    const existing = hashtagCountMap.get(bucket) || { count: 0, views: 0 };
    hashtagCountMap.set(bucket, {
      count: existing.count + 1,
      views: existing.views + (p.current_views || 0),
    });
  });

  let optimalHashtagCount: number | null = null;
  let maxHashtagAvgViews = 0;
  hashtagCountMap.forEach((stats, count) => {
    if (stats.count >= 3) {
      const avgViews = stats.views / stats.count;
      if (avgViews > maxHashtagAvgViews) {
        maxHashtagAvgViews = avgViews;
        optimalHashtagCount = count;
      }
    }
  });

  // 連結分析
  const withLink = posts.filter((p) => p.has_link === true);
  const withoutLink = posts.filter((p) => p.has_link !== true);

  // 問句分析
  const withQuestion = posts.filter((p) => p.has_question === true);
  const withoutQuestion = posts.filter((p) => p.has_question !== true);

  const questionTypeMap = new Map<string, { count: number; views: number }>();
  withQuestion.forEach((p) => {
    const qType = p.question_type || 'unknown';
    const existing = questionTypeMap.get(qType) || { count: 0, views: 0 };
    questionTypeMap.set(qType, {
      count: existing.count + 1,
      views: existing.views + (p.current_views || 0),
    });
  });

  let bestQuestionType: string | null = null;
  let maxQuestionAvgViews = 0;
  questionTypeMap.forEach((stats, qType) => {
    if (stats.count >= 3) {
      const avgViews = stats.views / stats.count;
      if (avgViews > maxQuestionAvgViews) {
        maxQuestionAvgViews = avgViews;
        bestQuestionType = qType;
      }
    }
  });

  // CTA 分析
  const withCta = posts.filter((p) => p.has_cta === true);
  const withoutCta = posts.filter((p) => p.has_cta !== true);

  const ctaTypeMap = new Map<string, { count: number; views: number }>();
  withCta.forEach((p) => {
    const cType = p.cta_type || 'unknown';
    const existing = ctaTypeMap.get(cType) || { count: 0, views: 0 };
    ctaTypeMap.set(cType, {
      count: existing.count + 1,
      views: existing.views + (p.current_views || 0),
    });
  });

  let bestCtaType: string | null = null;
  let maxCtaAvgViews = 0;
  ctaTypeMap.forEach((stats, cType) => {
    if (stats.count >= 3) {
      const avgViews = stats.views / stats.count;
      if (avgViews > maxCtaAvgViews) {
        maxCtaAvgViews = avgViews;
        bestCtaType = cType;
      }
    }
  });

  return {
    emoji: {
      with: calculateFeatureStats(withEmoji),
      without: calculateFeatureStats(withoutEmoji),
      optimal_count: optimalEmojiCount,
    },
    hashtag: {
      with: calculateFeatureStats(withHashtag),
      without: calculateFeatureStats(withoutHashtag),
      optimal_count: optimalHashtagCount,
    },
    link: {
      with: calculateFeatureStats(withLink),
      without: calculateFeatureStats(withoutLink),
    },
    question: {
      with: calculateFeatureStats(withQuestion),
      without: calculateFeatureStats(withoutQuestion),
      best_type: bestQuestionType,
    },
    cta: {
      with: calculateFeatureStats(withCta),
      without: calculateFeatureStats(withoutCta),
      best_type: bestCtaType,
    },
  };
}

function calculateFeatureStats(posts: PostData[]): FeatureStats {
  if (posts.length === 0) {
    return { count: 0, avg_views: 0, avg_engagement_rate: 0, avg_replies: 0 };
  }

  const totalViews = posts.reduce((sum, p) => sum + (p.current_views || 0), 0);
  const totalInteractions = posts.reduce(
    (sum, p) => sum + (p.current_likes || 0) + (p.current_replies || 0) + (p.current_reposts || 0) + (p.current_quotes || 0),
    0
  );
  const totalReplies = posts.reduce((sum, p) => sum + (p.current_replies || 0), 0);

  return {
    count: posts.length,
    avg_views: Math.round(totalViews / posts.length),
    avg_engagement_rate: totalViews > 0 ? totalInteractions / totalViews : 0,
    avg_replies: totalReplies / posts.length,
  };
}

function analyzeAITags(posts: PostData[]) {
  const dimensions = ['content_type', 'tone', 'intent', 'topic', 'format'] as const;
  const result: Record<string, TagStats[]> = {};

  dimensions.forEach((dim) => {
    const tagMap = new Map<string, { count: number; views: number; interactions: number }>();

    posts.forEach((p) => {
      const selectedTags = p.ai_selected_tags as Record<string, string[]> | null;
      if (!selectedTags || !selectedTags[dim]) return;

      const views = p.current_views || 0;
      const interactions = (p.current_likes || 0) + (p.current_replies || 0) + (p.current_reposts || 0) + (p.current_quotes || 0);

      selectedTags[dim].forEach((tag) => {
        const existing = tagMap.get(tag) || { count: 0, views: 0, interactions: 0 };
        tagMap.set(tag, {
          count: existing.count + 1,
          views: existing.views + views,
          interactions: existing.interactions + interactions,
        });
      });
    });

    const tagList = Array.from(tagMap.entries())
      .filter(([_, stats]) => stats.count >= 2) // 降低門檻，至少 2 篇
      .map(([tag, stats]) => ({
        tag,
        count: stats.count,
        avg_views: Math.round(stats.views / stats.count),
        avg_engagement_rate: stats.views > 0 ? stats.interactions / stats.views : 0,
        rank: 0,
      }))
      .sort((a, b) => b.avg_views - a.avg_views);

    // 加入排名
    tagList.forEach((t, i) => {
      t.rank = i + 1;
    });

    result[dim] = tagList;
  });

  return result as ContentPatternSnapshot['ai_tags'];
}

async function analyzeUserTags(
  supabase: ReturnType<typeof createServiceClient>,
  posts: PostData[]
): Promise<UserTagStats[]> {
  if (posts.length === 0) return [];

  const postIds = posts.map((p) => p.id);

  // 取得用戶自定義標籤
  const { data: postTags, error } = await supabase
    .from('workspace_threads_post_tags')
    .select(`
      post_id,
      tag:workspace_threads_account_tags(id, name, color)
    `)
    .in('post_id', postIds);

  if (error || !postTags) {
    console.error('Failed to fetch user tags:', error);
    return [];
  }

  // 建立 post -> metrics 的對應
  const postMap = new Map<string, PostData>();
  posts.forEach((p) => postMap.set(p.id, p));

  // 聚合用戶標籤效益
  const userTagMap = new Map<string, {
    name: string;
    color: string;
    count: number;
    views: number;
    interactions: number;
  }>();

  postTags.forEach((pt) => {
    const tag = pt.tag as { id: string; name: string; color: string } | null;
    if (!tag) return;

    const post = postMap.get(pt.post_id);
    if (!post) return;

    const existing = userTagMap.get(tag.id) || {
      name: tag.name,
      color: tag.color,
      count: 0,
      views: 0,
      interactions: 0,
    };

    const views = post.current_views || 0;
    const interactions =
      (post.current_likes || 0) +
      (post.current_replies || 0) +
      (post.current_reposts || 0) +
      (post.current_quotes || 0);

    userTagMap.set(tag.id, {
      ...existing,
      count: existing.count + 1,
      views: existing.views + views,
      interactions: existing.interactions + interactions,
    });
  });

  // 轉換為陣列並排序
  return Array.from(userTagMap.values())
    .filter((t) => t.count >= 2) // 至少 2 篇
    .map((t) => ({
      name: t.name,
      color: t.color,
      count: t.count,
      avg_views: t.count > 0 ? Math.round(t.views / t.count) : 0,
      avg_engagement_rate: t.views > 0 ? t.interactions / t.views : 0,
    }))
    .sort((a, b) => b.avg_views - a.avg_views);
}

function analyzeTimingEffectiveness(posts: PostData[], timezone: string = 'Asia/Taipei') {
  // 取得時區偏移小時數
  const offsetHours = TIMEZONE_OFFSETS[timezone] ?? 8; // 預設 UTC+8

  // 時段分析（24 小時 x 7 天）
  const heatmap: Array<{ day: number; hour: number; count: number; totalViews: number; totalInteractions: number }> = [];
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      heatmap.push({ day, hour, count: 0, totalViews: 0, totalInteractions: 0 });
    }
  }

  posts.forEach((p) => {
    // published_at 是 UTC 時間，需要轉換為用戶時區
    const utcDate = new Date(p.published_at);
    // 加上時區偏移轉為當地時間
    const localDate = new Date(utcDate.getTime() + offsetHours * 60 * 60 * 1000);
    const day = localDate.getUTCDay(); // 0 = Sunday (使用 UTC 方法因為我們已經手動調整時區)
    const hour = localDate.getUTCHours();
    const views = p.current_views || 0;
    const interactions = (p.current_likes || 0) + (p.current_replies || 0) + (p.current_reposts || 0) + (p.current_quotes || 0);

    const idx = day * 24 + hour;
    heatmap[idx].count += 1;
    heatmap[idx].totalViews += views;
    heatmap[idx].totalInteractions += interactions;
  });

  // 找出最佳時段（有足夠樣本）
  const validSlots = heatmap.filter((slot) => slot.count >= 2);

  // 按小時聚合
  const hourlyStats = new Map<number, { count: number; views: number }>();
  heatmap.forEach((slot) => {
    const existing = hourlyStats.get(slot.hour) || { count: 0, views: 0 };
    hourlyStats.set(slot.hour, {
      count: existing.count + slot.count,
      views: existing.views + slot.totalViews,
    });
  });

  const bestHours = Array.from(hourlyStats.entries())
    .filter(([_, stats]) => stats.count >= 3)
    .map(([hour, stats]) => ({
      hour,
      avgViews: stats.views / stats.count,
    }))
    .sort((a, b) => b.avgViews - a.avgViews)
    .slice(0, 3)
    .map((h) => h.hour);

  // 按日期聚合
  const dailyStats = new Map<number, { count: number; views: number }>();
  heatmap.forEach((slot) => {
    const existing = dailyStats.get(slot.day) || { count: 0, views: 0 };
    dailyStats.set(slot.day, {
      count: existing.count + slot.count,
      views: existing.views + slot.totalViews,
    });
  });

  const bestDays = Array.from(dailyStats.entries())
    .filter(([_, stats]) => stats.count >= 3)
    .map(([day, stats]) => ({
      day,
      avgViews: stats.views / stats.count,
    }))
    .sort((a, b) => b.avgViews - a.avgViews)
    .slice(0, 3)
    .map((d) => d.day);

  return {
    best_hours: bestHours,
    best_days: bestDays,
    heatmap: validSlots.map((slot) => ({
      day: slot.day,
      hour: slot.hour,
      count: slot.count,
      avg_engagement: slot.totalViews > 0 ? slot.totalInteractions / slot.totalViews : 0,
    })),
  };
}

function identifyPatterns(posts: PostData[], avgViews: number) {
  // Top 貼文（前 10）- 按曝光排序
  const topPosts = posts.slice(0, 10);

  // Bottom 貼文（後 10，但排除 0 曝光的）
  const bottomPosts = posts
    .filter((p) => (p.current_views || 0) > 0)
    .slice(-10)
    .reverse();

  // 分析共同特徵
  const analyzeCommonFeatures = (postList: PostData[]) => {
    const features: string[] = [];

    // 媒體類型
    const mediaTypes = postList.map((p) => p.media_type || 'TEXT');
    const mediaTypeCount = mediaTypes.reduce((acc, type) => {
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const dominantMediaType = Object.entries(mediaTypeCount).sort((a, b) => b[1] - a[1])[0];
    if (dominantMediaType && dominantMediaType[1] >= postList.length * 0.5) {
      features.push(`${translateMediaType(dominantMediaType[0])}格式為主`);
    }

    // 長度
    const avgCharCount = postList.reduce((sum, p) => sum + (p.char_count || 0), 0) / postList.length;
    if (avgCharCount <= 50) {
      features.push('短文（≤50字）');
    } else if (avgCharCount <= 150) {
      features.push('中等長度（51-150字）');
    } else {
      features.push('長文（>150字）');
    }

    // 問句
    const questionRatio = postList.filter((p) => p.has_question).length / postList.length;
    if (questionRatio >= 0.5) {
      features.push('使用問句');
    }

    // CTA
    const ctaRatio = postList.filter((p) => p.has_cta).length / postList.length;
    if (ctaRatio >= 0.5) {
      features.push('含有 CTA');
    }

    // Emoji
    const emojiRatio = postList.filter((p) => p.has_emoji).length / postList.length;
    if (emojiRatio >= 0.5) {
      features.push('使用 Emoji');
    }

    return features;
  };

  const successFeatures = analyzeCommonFeatures(topPosts);
  const failureFeatures = analyzeCommonFeatures(bottomPosts);

  // 產生成功公式
  const formula = successFeatures.length > 0
    ? successFeatures.join(' + ')
    : '尚無明確模式';

  // 產生失敗警示
  const avoid = failureFeatures.filter((f) => !successFeatures.includes(f));

  return {
    success: {
      top_posts: topPosts.map((p) => formatPostSummary(p)),
      common_features: successFeatures,
      formula,
    },
    failure: {
      bottom_posts: bottomPosts.map((p) => formatPostSummary(p)),
      common_issues: failureFeatures,
      avoid,
    },
  };
}

function formatPostSummary(p: PostData): PostSummary {
  const features: string[] = [];
  if (p.has_question) features.push('問句');
  if (p.has_cta) features.push('CTA');
  if (p.has_emoji) features.push('Emoji');
  if (hasHashtag(p)) features.push('Hashtag');
  if (p.has_link) features.push('連結');

  const views = p.current_views || 0;
  const interactions = (p.current_likes || 0) + (p.current_replies || 0) + (p.current_reposts || 0) + (p.current_quotes || 0);

  return {
    id: p.id,
    text: p.text || '',
    views,
    engagement_rate: views > 0 ? interactions / views : 0,
    media_type: translateMediaType(p.media_type || 'TEXT'),
    char_count: p.char_count || 0,
    features,
    published_at: new Date(p.published_at).toLocaleDateString('zh-TW'),
  };
}

// ============================================================================
// 分析高爆文後的限流風險（基於觸及倍數配額制模型）
// 參考：docs/research/threads-rate-limiting-hypothesis.md
// ============================================================================

function analyzeThrottlingRisk(
  posts: PostData[],
  avgViews: number,
  followersCount: number
): ContentPatternSnapshot['throttling_analysis'] {
  // 沒有足夠貼文或粉絲數時，無法分析
  if (posts.length < 5 || followersCount < 1) {
    return {
      has_risk: false,
      viral_posts_count: 0,
      potentially_throttled_count: 0,
      affected_posts: [],
      avg_drop_rate: 0,
    };
  }

  // 按時間排序
  const sortedByTime = [...posts].sort(
    (a, b) => new Date(a.published_at).getTime() - new Date(b.published_at).getTime()
  );

  // 計算每篇貼文的觸及倍數
  const postsWithVfr = sortedByTime.map((p) => ({
    ...p,
    vfr: (p.current_views || 0) / followersCount,
  }));

  // 觸及倍數閾值（根據研究文件）
  const REACH_MULTIPLIER_BURST_THRESHOLD = 200; // 爆文門檻：觸及倍數 ≥ 200
  const REACH_MULTIPLIER_THROTTLED_THRESHOLD = 20; // 限流門檻：觸及倍數 < 20

  // 找出爆文（觸及倍數 ≥ 200）
  const burstPosts = postsWithVfr.filter((p) => p.vfr >= REACH_MULTIPLIER_BURST_THRESHOLD);

  if (burstPosts.length === 0) {
    return {
      has_risk: false,
      viral_posts_count: 0,
      potentially_throttled_count: 0,
      affected_posts: [],
      avg_drop_rate: 0,
    };
  }

  // 計算爆發前的基準觸及倍數（用所有非爆文貼文）
  const nonBurstPosts = postsWithVfr.filter((p) => p.vfr < REACH_MULTIPLIER_BURST_THRESHOLD);
  const baselineVfr = nonBurstPosts.length > 0
    ? nonBurstPosts.reduce((sum, p) => sum + p.vfr, 0) / nonBurstPosts.length
    : 10; // 預設基準

  // 分析每個爆文之後 7 天內的貼文
  const THROTTLE_WINDOW_DAYS = 7;
  const THROTTLE_WINDOW_MS = THROTTLE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const affectedPosts: ContentPatternSnapshot['throttling_analysis']['affected_posts'] = [];
  let throttledCount = 0;
  let totalVfrDrop = 0;
  let dropEventCount = 0;

  burstPosts.forEach((burstPost) => {
    const burstTime = new Date(burstPost.published_at).getTime();
    const windowEnd = burstTime + THROTTLE_WINDOW_MS;

    // 找出爆文之後 7 天內的貼文（排除爆文本身和其他爆文）
    const followingPosts = postsWithVfr.filter((p) => {
      const postTime = new Date(p.published_at).getTime();
      return postTime > burstTime &&
             postTime <= windowEnd &&
             p.id !== burstPost.id &&
             p.vfr < REACH_MULTIPLIER_BURST_THRESHOLD; // 排除其他爆文
    });

    if (followingPosts.length === 0) return;

    // 檢查這些貼文是否有被限流的跡象（觸及倍數明顯低於基準）
    const throttledPosts = followingPosts.filter((p) => {
      // 觸及倍數低於基準的 50% 或低於 20，視為可能被限流
      return p.vfr < baselineVfr * 0.5 || p.vfr < REACH_MULTIPLIER_THROTTLED_THRESHOLD;
    });

    if (throttledPosts.length === 0) return;

    // 計算觸及倍數下降幅度
    const avgFollowingVfr = followingPosts.reduce((sum, p) => sum + p.vfr, 0) / followingPosts.length;
    const vfrDropRate = baselineVfr > 0 ? (baselineVfr - avgFollowingVfr) / baselineVfr : 0;

    // 只有當觸及倍數下降幅度 > 30% 且有明顯限流跡象時，才記錄
    if (vfrDropRate > 0.3 && throttledPosts.length > 0) {
      throttledCount += throttledPosts.length;
      totalVfrDrop += vfrDropRate;
      dropEventCount += 1;

      affectedPosts.push({
        viral_post: {
          ...formatPostSummary(burstPost),
          vfr: Math.round(burstPost.vfr * 10) / 10,
        },
        following_posts: followingPosts.slice(0, 5).map((p) => ({
          ...formatPostSummary(p),
          vfr: Math.round(p.vfr * 10) / 10,
          hours_after: Math.round(
            (new Date(p.published_at).getTime() - burstTime) / (60 * 60 * 1000)
          ),
        })),
      });
    }
  });

  const hasRisk = affectedPosts.length > 0;
  const avgDropRate = dropEventCount > 0 ? totalVfrDrop / dropEventCount : 0;

  return {
    has_risk: hasRisk,
    viral_posts_count: burstPosts.length,
    potentially_throttled_count: throttledCount,
    affected_posts: affectedPosts.slice(0, 3), // 最多顯示 3 個案例
    avg_drop_rate: avgDropRate,
    // 新增：觸及倍數相關數據
    baseline_vfr: Math.round(baselineVfr * 10) / 10,
    followers_count: followersCount,
  };
}
