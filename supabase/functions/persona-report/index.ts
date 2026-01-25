/**
 * Persona Report - 人設定位報告
 *
 * POST /persona-report
 * Headers: Authorization: Bearer <USER_JWT>
 * Body: { accountId: string, startDate?: string, endDate?: string, model?: 'sonnet' | 'opus' }
 *
 * 分析帳號人設定位，幫助用戶了解「別人眼中的我」vs「我想呈現的形象」是否一致
 *
 * 三階段分段處理：
 * Phase 1: 資料收集（bio + 貼文 + 回覆抽樣）
 * Phase 2: 分段 AI 分析（5 次呼叫）
 * Phase 3: 儲存報告
 */

import { handleCors } from '../_shared/cors.ts';
import { createAnonClient, createServiceClient } from '../_shared/supabase.ts';
import { jsonResponse, errorResponse, unauthorizedResponse, forbiddenResponse } from '../_shared/response.ts';
import { getAuthenticatedUser, isSystemAdmin, validateWorkspaceMembership } from '../_shared/auth.ts';
import { ClaudeClient } from '../_shared/claude.ts';
import { decrypt } from '../_shared/crypto.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const THREADS_API_BASE = 'https://graph.threads.net/v1.0';

interface RequestBody {
  accountId: string;
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  timezone?: string;  // IANA timezone
  model?: 'sonnet' | 'opus';
}

const MODEL_IDS: Record<string, string> = {
  sonnet: 'claude-sonnet-4-20250514',
  opus: 'claude-opus-4-5-20251101',
};

// ============================================================================
// 報告內容類型定義（深度分析版本 v2）
// ============================================================================

interface PersonaReportContent {
  // Part 1: 總覽 - 30 秒內理解現況
  executive_summary: {
    positioning: string; // 一句話定位
    health_score: number; // 0-100
    stage: {
      current: 'building' | 'growing' | 'stable' | 'influential';
      label: string; // 建立期/成長期/穩定期/影響力期
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

  // Part 2: 你的形象 - 認知落差分析
  persona_image: {
    tags: Array<{ tag: string; type: 'primary' | 'secondary' }>;
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

  // Part 3: 你的受眾 - 以受眾為核心的完整分析
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
        urgency: 'high' | 'medium' | 'low';
        satisfaction: number; // 0-100
        content_gap?: string;
      }>;
      desires: Array<{
        title: string;
        satisfaction: number;
      }>;
    };
    advancement: {
      target: string; // e.g., "互動者 → 信任者"
      strategies: Array<{
        content_type: string;
        example: string;
        expected_effect: string;
      }>;
    };
  }>;

  // Part 4: 內容健檢 - 內容組合診斷
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

  // Part 5: 行動清單 - 優先級排序的執行計畫
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
// 回覆收集相關類型
// ============================================================================

interface ThreadsReply {
  id: string;
  text?: string;
  username?: string;
  timestamp?: string;
  is_reply_owned_by_me?: boolean;
}

interface CollectedReply {
  text: string;
  username: string;
  timestamp: string;
  is_owner_reply: boolean;
  post_id: string;
  post_text: string;
}

interface PostWithReplies {
  id: string;
  text: string;
  threads_post_id: string;
  current_views: number;
  current_replies: number;
  replies: CollectedReply[];
}

// ============================================================================
// System Prompts for Each Stage (深度分析版本 v2)
// ============================================================================

// Stage 1: 總覽 + 形象分析
const EXECUTIVE_AND_IMAGE_PROMPT = `你是一位資深社群策略顧問。根據提供的 Bio 和貼文內容，進行帳號總覽診斷和形象分析。

## 分析任務

### Part 1: 總覽診斷
1. **階段判定**：這個帳號處於什麼發展階段？
   - building（建立期）：還在摸索定位、內容不穩定
   - growing（成長期）：有穩定風格、開始累積受眾
   - stable（穩定期）：有明確定位、穩定互動
   - influential（影響力期）：有號召力、受眾會主動推薦

2. **核心瓶頸**：目前最關鍵的問題是什麼？用數據支撐。

3. **突破方向**：從什麼狀態轉變到什麼狀態？

### Part 2: 形象分析
1. **認知落差**：Bio 說的 vs 內容實際傳達的，有沒有不一致？
2. **獨特性**：跟市場上類似帳號比，差異化在哪？
3. **Bio 改寫建議**：具體的改寫方案

## 回應格式（純 JSON）
{
  "executive_summary": {
    "positioning": "一句話定位（15字內）",
    "health_score": 78,
    "stage": {
      "current": "growing",
      "label": "成長期",
      "description": "已有穩定的內容風格，互動率開始穩定但深度不足"
    },
    "core_bottleneck": {
      "title": "核心瓶頸的標題（如：內容有價值但缺乏轉化路徑）",
      "evidence": ["數據支撐1", "數據支撐2", "數據支撐3"],
      "implication": "這意味著什麼（對經營的影響）"
    },
    "breakthrough": {
      "from_state": "目前狀態（如：知識輸出者）",
      "to_state": "目標狀態（如：問題解決者）",
      "how": "如何轉變的具體說明"
    },
    "top_action": "現階段最重要的一件事",
    "strengths": ["做得好的點1", "做得好的點2", "做得好的點3"],
    "improvements": ["待加強的點1", "待加強的點2"]
  },
  "persona_image": {
    "tags": [
      { "tag": "標籤名稱", "type": "primary" },
      { "tag": "標籤名稱", "type": "secondary" }
    ],
    "style_spectrum": {
      "professional_friendly": { "value": 65, "label": "偏專業但不冷淡" },
      "educational_entertaining": { "value": 80, "label": "以教學為主" },
      "rational_emotional": { "value": 45, "label": "理性為主帶點感性" }
    },
    "perception_gap": {
      "bio_claims": ["Bio 說的重點1", "Bio 說的重點2"],
      "content_shows": ["內容實際傳達的1", "內容實際傳達的2", "內容實際傳達的3"],
      "mismatches": [
        {
          "issue": "落差描述",
          "in_bio": false,
          "in_content": true,
          "suggestion": "建議如何處理"
        }
      ],
      "analysis": "整體認知落差分析（50字內）"
    },
    "uniqueness": {
      "common_accounts": ["市場上類似帳號的特點1", "類似帳號的特點2"],
      "your_differentiators": ["你的獨特之處1", "你的獨特之處2"],
      "positioning_suggestion": "建議的差異化定位"
    },
    "bio_rewrite": {
      "current": "現有的 Bio",
      "suggested": "建議改寫的 Bio",
      "improvements": ["改了什麼1", "改了什麼2", "改了什麼3"]
    }
  }
}

## 注意事項
- health_score 範圍 0-100
- style_spectrum value 範圍 0-100，50 為中間值
- 標籤要具體有辨識度，避免「內容創作者」這類籠統標籤
- 使用繁體中文（台灣用語）`;

// Stage 2: 受眾深度分析（整合輪廓+需求+旅程）
const AUDIENCE_SEGMENTS_PROMPT = `你是一位資深用戶研究專家。根據提供的回覆內容，進行受眾深度分析。

## 分析任務

對每個受眾類型，分析：
1. **為什麼追蹤**：他們被什麼吸引？
2. **旅程分布**：他們停在哪個階段？為什麼卡住？
3. **需求滿足度**：痛點和渴望，現有內容滿足了多少？
4. **推進策略**：什麼內容能推動他們到下一階段？

## 受眾旅程階段（由淺到深）
1. 路人：只是看看，不互動
2. 關注者：有追蹤但很少互動
3. 互動者：會按讚、偶爾留言
4. 信任者：認可觀點、常互動、會回來看

## 回應格式（純 JSON）
{
  "audience_segments": [
    {
      "name": "具體的受眾名稱（如：資深開發者）",
      "percentage": 40,
      "description": "這類受眾的背景描述（30-50字）",
      "why_follow": [
        "追蹤原因1：被什麼吸引",
        "追蹤原因2"
      ],
      "journey": {
        "distribution": {
          "passerby": 20,
          "follower": 40,
          "engager": 30,
          "truster": 10
        },
        "stuck_at": "大多卡在哪個階段（如：互動者）",
        "stuck_reasons": [
          "卡住的原因1",
          "卡住的原因2"
        ]
      },
      "needs": {
        "pain_points": [
          {
            "title": "痛點描述",
            "urgency": "high",
            "satisfaction": 30,
            "content_gap": "如果滿足度低，缺少什麼內容"
          }
        ],
        "desires": [
          {
            "title": "渴望描述",
            "satisfaction": 70
          }
        ]
      },
      "advancement": {
        "target": "互動者 → 信任者",
        "strategies": [
          {
            "content_type": "觀點型內容",
            "example": "為什麼我不用 XX 而用 YY",
            "expected_effect": "讓讀者知道你的判斷標準，產生認同感"
          }
        ]
      }
    }
  ]
}

## 受眾命名原則
- 使用【身份 + 特質】組合，如「資深開發者」「技術探索者」「創業新手」
- 避免「一般用戶」「普通讀者」這類泛稱

## 注意事項
- percentage 加總應為 100
- journey.distribution 加總應為 100
- satisfaction 範圍 0-100，越高表示現有內容越能滿足
- urgency 分為 high/medium/low
- 提供 2-4 個受眾類型
- 使用繁體中文（台灣用語）
- 重要：所有階段名稱必須使用中文（路人、關注者、互動者、信任者），不要使用英文（passerby、follower、engager、truster）`;

// Stage 3: 內容健檢
const CONTENT_HEALTH_PROMPT = `你是一位資深內容策略師。根據提供的分析結果，進行內容健檢。

## 分析任務

1. **內容類型分布**：目前各類內容的比例 vs 建議比例
2. **內容組合問題**：有什麼失衡的地方？影響是什麼？
3. **階段服務分析**：內容服務哪個階段 vs 受眾在哪個階段，有沒有落差？
4. **價值維度評分**：各價值維度的表現

## 內容類型定義
- 教學乾貨：知識、技能、教程
- 工具介紹：工具推薦、使用心得
- 觀點輸出：看法、立場、評論
- 個人故事：經歷、心路歷程、失敗經驗
- 互動貼文：問問題、投票、邀請分享

## 回應格式（純 JSON）
{
  "content_health": {
    "type_distribution": {
      "current": [
        { "type": "教學乾貨", "percentage": 45 },
        { "type": "工具介紹", "percentage": 30 },
        { "type": "觀點輸出", "percentage": 10 },
        { "type": "個人故事", "percentage": 10 },
        { "type": "互動貼文", "percentage": 5 }
      ],
      "recommended": [
        { "type": "教學乾貨", "percentage": 30 },
        { "type": "工具介紹", "percentage": 20 },
        { "type": "觀點輸出", "percentage": 25 },
        { "type": "個人故事", "percentage": 15 },
        { "type": "互動貼文", "percentage": 10 }
      ],
      "issues": [
        {
          "problem": "問題標題（如：乾貨太多，觀點太少）",
          "detail": "具體說明（如：75% 是教你做什麼，只有 10% 是我怎麼看）",
          "impact": "造成什麼影響（如：讀者學到東西但不知道你的想法）"
        }
      ]
    },
    "stage_analysis": {
      "content_serving": {
        "attraction": 40,
        "retention": 35,
        "engagement": 15,
        "trust_building": 10
      },
      "audience_at": {
        "passerby": 60,
        "engager": 25,
        "truster": 12,
        "advocate": 3
      },
      "gap_analysis": "落差分析：內容服務的階段 vs 受眾所在階段的落差說明",
      "adjustment": "建議如何調整內容比例"
    },
    "value_scores": [
      {
        "dimension": "教育價值",
        "score": 85,
        "interpretation": "這個分數代表什麼，有什麼建議"
      },
      {
        "dimension": "實用價值",
        "score": 90,
        "interpretation": "解讀"
      },
      {
        "dimension": "社交價值",
        "score": 70,
        "interpretation": "解讀"
      },
      {
        "dimension": "靈感價值",
        "score": 60,
        "interpretation": "解讀"
      },
      {
        "dimension": "娛樂價值",
        "score": 45,
        "interpretation": "解讀"
      }
    ]
  }
}

## 注意事項
- 所有 percentage 加總應為 100
- score 範圍 0-100
- issues 提供 2-4 個具體問題
- 使用繁體中文（台灣用語）
- 重要：所有階段名稱必須使用中文：
  - 內容服務階段：吸引、留存、互動、信任
  - 受眾階段：路人、互動者、信任者、擁護者
  - gap_analysis 和 adjustment 中不要使用英文術語`;

// Stage 4: 行動計畫
const ACTION_PLAN_PROMPT = `你是一位資深內容策略顧問。根據提供的完整分析，制定具體可執行的行動計畫。

## 分析任務

1. **優先級聲明**：根據分析，最優先要解決的是什麼？
2. **立即行動**：今天就能做的 2-3 件事
3. **內容建議**：建議發什麼內容，為什麼，怎麼寫
4. **月度規劃**：接下來 4 週的內容方向

## 內容類型說明
- 觀點型：表達立場、判斷標準
- 故事型：個人經歷、失敗教訓
- 教學型：乾貨、教程、方法
- 互動型：問問題、邀請分享

## 回應格式（純 JSON）
{
  "action_plan": {
    "priority_focus": "根據分析，你的優先級是：xxxxx",
    "immediate_actions": [
      {
        "action": "行動描述",
        "current_state": "現在是什麼狀態（如有）",
        "target_state": "要改成什麼（如有）",
        "reason": "為什麼要做這件事"
      }
    ],
    "weekly_content": [
      {
        "priority": 1,
        "content_type": "觀點型",
        "solves_problem": "解決什麼問題（如：觀點內容不足）",
        "topic": "主題名稱",
        "angle": "切入角度說明",
        "hook_example": "開頭範例（30-50字）",
        "ending_cta": "結尾互動邀請（如有）",
        "expected_effects": ["預期效果1", "預期效果2"],
        "format": "純文字/圖文/影片"
      }
    ],
    "monthly_plan": {
      "weeks": [
        { "week": 1, "content_type": "觀點型", "topic": "主題" },
        { "week": 2, "content_type": "教學型", "topic": "主題" },
        { "week": 3, "content_type": "故事型", "topic": "主題" },
        { "week": 4, "content_type": "互動型", "topic": "主題" }
      ],
      "purpose": "這個組合的目的是什麼"
    }
  }
}

## 注意事項
- immediate_actions 提供 2-3 個
- weekly_content 提供 2-3 個內容建議，按優先級排序
- hook_example 要具體可用，不是抽象描述
- 使用繁體中文（台灣用語）`;

// ============================================================================
// Main Handler
// ============================================================================

Deno.serve(async (req) => {
  console.log('=== Persona Report Function Called ===', req.method, req.url);

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

  // DELETE: 軟刪除報告
  if (req.method === 'DELETE') {
    try {
      const { reportId } = await req.json();
      if (!reportId) {
        return errorResponse(req, 'reportId is required');
      }

      const { data: report, error: reportError } = await anonClient
        .from('ai_weekly_reports')
        .select('id')
        .eq('id', reportId)
        .eq('report_type', 'persona')
        .maybeSingle();

      if (reportError || !report) {
        return errorResponse(req, '找不到此報告或無權限', 404);
      }

      const { error: deleteError } = await serviceClient
        .from('ai_weekly_reports')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', reportId);

      if (deleteError) throw new Error(deleteError.message);

      return jsonResponse(req, { success: true });
    } catch (error) {
      console.error('Delete report error:', error);
      return errorResponse(req, '刪除失敗，請稍後再試', 500);
    }
  }

  // POST: 產生報告
  if (req.method !== 'POST') {
    return errorResponse(req, 'Method not allowed', 405);
  }

  try {
    if (!ANTHROPIC_API_KEY) {
      return errorResponse(req, '系統設定錯誤，請聯繫管理員', 500);
    }

    const isAdmin = await isSystemAdmin(serviceClient, user.id);
    const body: RequestBody = await req.json();
    const { accountId, startDate, endDate: endDateParam, timezone = 'Asia/Taipei', model = 'sonnet' } = body;
    const modelId = MODEL_IDS[model] || MODEL_IDS.sonnet;

    console.log('Persona report request:', { accountId, startDate, endDate: endDateParam, model });

    if (!accountId) {
      return errorResponse(req, 'accountId is required');
    }

    // 計算日期範圍（預設最近 90 天）
    const now = new Date();
    let startDateStr: string;
    let endDateStr: string;

    if (startDate && endDateParam) {
      startDateStr = startDate;
      endDateStr = endDateParam;
    } else {
      const endDate = new Date(now);
      endDate.setDate(now.getDate() - 1);
      const start = new Date(endDate);
      start.setDate(endDate.getDate() - 89);
      startDateStr = start.toISOString().split('T')[0];
      endDateStr = endDate.toISOString().split('T')[0];
    }

    // 取得帳號資訊
    const { data: account, error: accountError } = await serviceClient
      .from('workspace_threads_accounts')
      .select('id, username, name, biography, current_followers_count, workspace_id, threads_user_id')
      .eq('id', accountId)
      .single();

    if (accountError || !account) {
      console.error('Account query error:', { accountId, accountError });
      return errorResponse(req, '找不到此帳號', 404);
    }

    // 驗證 Workspace 權限
    if (!isAdmin) {
      const membership = await validateWorkspaceMembership(anonClient, user.id, account.workspace_id);
      if (!membership) {
        return forbiddenResponse(req, 'No access to this workspace');
      }
    }

    // 檢查是否有正在產生中的報告
    const { data: generatingReport } = await serviceClient
      .from('ai_weekly_reports')
      .select('id')
      .eq('workspace_threads_account_id', accountId)
      .eq('report_type', 'persona')
      .eq('status', 'generating')
      .maybeSingle();

    if (generatingReport) {
      return jsonResponse(req, { reportId: generatingReport.id, status: 'generating' });
    }

    // 建立新報告記錄
    const { data: newReport, error: insertError } = await serviceClient
      .from('ai_weekly_reports')
      .insert({
        workspace_threads_account_id: accountId,
        week_start: startDateStr,
        week_end: endDateStr,
        status: 'generating',
        model_name: modelId,
        report_type: 'persona',
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
        // Phase 1: 資料收集
        console.log(`[${reportId}] Phase 1: 資料收集`);
        const { posts, replies, bio } = await collectData(
          serviceClient, accountId, startDateStr, endDateStr, timezone, account
        );

        if (posts.length === 0) {
          throw new Error('分析期間沒有貼文資料');
        }

        // Phase 2: 分段 AI 分析（4 階段深度分析）
        console.log(`[${reportId}] Phase 2: 分段 AI 分析`);
        const claude = new ClaudeClient(ANTHROPIC_API_KEY!, modelId);
        let totalInputTokens = 0;
        let totalOutputTokens = 0;

        // Stage 1: 總覽 + 形象分析
        console.log(`[${reportId}] Stage 1: 總覽 + 形象分析`);
        const executivePrompt = buildExecutiveAndImagePrompt(bio, posts);
        const executiveResult = await claude.generateWeeklyReport<{
          executive_summary: PersonaReportContent['executive_summary'];
          persona_image: PersonaReportContent['persona_image'];
        }>(EXECUTIVE_AND_IMAGE_PROMPT, executivePrompt);
        totalInputTokens += executiveResult.usage.input_tokens;
        totalOutputTokens += executiveResult.usage.output_tokens;

        // Stage 2: 受眾深度分析
        console.log(`[${reportId}] Stage 2: 受眾深度分析`);
        const audiencePrompt = buildAudienceSegmentsPrompt(replies, posts);
        const audienceResult = await claude.generateWeeklyReport<{
          audience_segments: PersonaReportContent['audience_segments'];
        }>(AUDIENCE_SEGMENTS_PROMPT, audiencePrompt);
        totalInputTokens += audienceResult.usage.input_tokens;
        totalOutputTokens += audienceResult.usage.output_tokens;

        // Stage 3: 內容健檢
        console.log(`[${reportId}] Stage 3: 內容健檢`);
        const contentHealthPrompt = buildContentHealthPrompt(
          executiveResult.content, audienceResult.content.audience_segments, posts
        );
        const contentHealthResult = await claude.generateWeeklyReport<{
          content_health: PersonaReportContent['content_health'];
        }>(CONTENT_HEALTH_PROMPT, contentHealthPrompt);
        totalInputTokens += contentHealthResult.usage.input_tokens;
        totalOutputTokens += contentHealthResult.usage.output_tokens;

        // Stage 4: 行動計畫
        console.log(`[${reportId}] Stage 4: 行動計畫`);
        const actionPlanPrompt = buildActionPlanPrompt(
          executiveResult.content,
          audienceResult.content.audience_segments,
          contentHealthResult.content.content_health
        );
        const actionPlanResult = await claude.generateWeeklyReport<{
          action_plan: PersonaReportContent['action_plan'];
        }>(ACTION_PLAN_PROMPT, actionPlanPrompt);
        totalInputTokens += actionPlanResult.usage.input_tokens;
        totalOutputTokens += actionPlanResult.usage.output_tokens;

        // Phase 3: 整合報告
        console.log(`[${reportId}] Phase 3: 整合報告`);
        const reportContent: PersonaReportContent = {
          executive_summary: executiveResult.content.executive_summary,
          persona_image: executiveResult.content.persona_image,
          audience_segments: audienceResult.content.audience_segments,
          content_health: contentHealthResult.content.content_health,
          action_plan: actionPlanResult.content.action_plan,
        };

        const dataSnapshot = {
          account: {
            username: account.username,
            name: account.name,
            bio: bio,
            followers_count: account.current_followers_count,
          },
          period: { start: startDateStr, end: endDateStr },
          stats: {
            post_count: posts.length,
            reply_count: replies.length,
          },
        };

        // 更新報告
        await serviceClient
          .from('ai_weekly_reports')
          .update({
            status: 'completed',
            report_content: reportContent,
            data_snapshot: dataSnapshot,
            input_tokens: totalInputTokens,
            output_tokens: totalOutputTokens,
            generated_at: new Date().toISOString(),
          })
          .eq('id', reportId);

        // 記錄 LLM 使用量
        await serviceClient.from('llm_usage_logs').insert({
          workspace_id: account.workspace_id,
          workspace_threads_account_id: accountId,
          model_name: modelId,
          input_tokens: totalInputTokens,
          output_tokens: totalOutputTokens,
          total_tokens: totalInputTokens + totalOutputTokens,
          purpose: 'persona_report',
          metadata: { report_id: reportId, period: { start: startDateStr, end: endDateStr } },
        });

        console.log(`[${reportId}] Report completed successfully`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : '';
        console.error(`[${reportId}] Report failed:`, errorMessage);
        console.error(`[${reportId}] Stack:`, errorStack);
        await serviceClient
          .from('ai_weekly_reports')
          .update({
            status: 'failed',
            error_message: `報告產生失敗: ${errorMessage}`,
          })
          .eq('id', reportId);
      }
    };

    // 背景執行
    // @ts-ignore - EdgeRuntime is available in Supabase Edge Functions
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(processReport());
    } else {
      processReport().catch(console.error);
    }

    return jsonResponse(req, { reportId, status: 'generating' });
  } catch (error) {
    console.error('Persona report error:', error);
    return errorResponse(req, '報告產生失敗，請稍後再試', 500);
  }
});

// ============================================================================
// 資料收集函數
// ============================================================================

async function collectData(
  supabase: ReturnType<typeof createServiceClient>,
  accountId: string,
  startDate: string,
  endDate: string,
  timezone: string,
  account: { threads_user_id: string; biography?: string | null }
): Promise<{ posts: PostWithReplies[]; replies: CollectedReply[]; bio: string }> {
  // 時區轉換
  const timezoneOffsets: Record<string, number> = {
    'Asia/Taipei': 8, 'Asia/Tokyo': 9, 'UTC': 0,
  };
  const offsetHours = timezoneOffsets[timezone] ?? 8;
  const startLocalMs = new Date(`${startDate}T00:00:00Z`).getTime();
  const endLocalMs = new Date(`${endDate}T23:59:59Z`).getTime();
  const startDateTime = new Date(startLocalMs - offsetHours * 60 * 60 * 1000).toISOString();
  const endDateTime = new Date(endLocalMs - offsetHours * 60 * 60 * 1000).toISOString();

  // 取得 Bio（從帳號資料或 API）
  const bio = account.biography || '';

  // 取得分析期間貼文
  const { data: posts } = await supabase
    .from('workspace_threads_posts')
    .select('id, text, threads_post_id, current_views, current_replies, current_likes, ai_selected_tags')
    .eq('workspace_threads_account_id', accountId)
    .not('media_type', 'eq', 'REPOST_FACADE')
    .gte('published_at', startDateTime)
    .lte('published_at', endDateTime)
    .order('current_views', { ascending: false });

  const currentPosts = posts || [];

  // 取得 Token 用於 API 呼叫
  const { data: tokenData } = await supabase
    .from('workspace_threads_tokens')
    .select('access_token_encrypted')
    .eq('workspace_threads_account_id', accountId)
    .eq('is_primary', true)
    .is('revoked_at', null)
    .single();

  let allReplies: CollectedReply[] = [];
  const postsWithReplies: PostWithReplies[] = [];

  if (tokenData?.access_token_encrypted) {
    const accessToken = await decrypt(tokenData.access_token_encrypted);
    allReplies = await collectRepliesWithSampling(currentPosts, accessToken, account.threads_user_id);
  }

  // 整理貼文資料
  for (const post of currentPosts) {
    const postReplies = allReplies.filter(r => r.post_id === post.id);
    postsWithReplies.push({
      id: post.id,
      text: post.text || '',
      threads_post_id: post.threads_post_id,
      current_views: post.current_views || 0,
      current_replies: post.current_replies || 0,
      replies: postReplies,
    });
  }

  return { posts: postsWithReplies, replies: allReplies, bio };
}

// ============================================================================
// 回覆收集（分層抽樣）
// ============================================================================

async function collectRepliesWithSampling(
  posts: Array<{ id: string; text?: string | null; threads_post_id: string; current_views?: number | null; current_replies?: number | null }>,
  accessToken: string,
  ownerThreadsUserId: string
): Promise<CollectedReply[]> {
  const allReplies: CollectedReply[] = [];
  const MAX_TOTAL_REPLIES = 1500;
  const MAX_CHARS_PER_REPLY = 200;

  // 依互動量分類貼文
  const sortedPosts = [...posts].sort((a, b) => (b.current_replies || 0) - (a.current_replies || 0));

  // P0: 經營者參與的對話串（全部保留）→ 需要先取得再判斷
  // P1: 高互動貼文（前 20%）→ 每篇最多 15 則
  // P2: 中互動貼文（20-60%）→ 每篇最多 10 則
  // P3: 低互動貼文（後 40%）→ 每篇最多 5 則

  const highThreshold = Math.ceil(sortedPosts.length * 0.2);
  const midThreshold = Math.ceil(sortedPosts.length * 0.6);

  for (let i = 0; i < sortedPosts.length && allReplies.length < MAX_TOTAL_REPLIES; i++) {
    const post = sortedPosts[i];
    if (!post.current_replies || post.current_replies === 0) continue;

    let limit: number;
    if (i < highThreshold) {
      limit = 15; // 高互動
    } else if (i < midThreshold) {
      limit = 10; // 中互動
    } else {
      limit = 5;  // 低互動
    }

    try {
      const replies = await fetchPostReplies(post.threads_post_id, accessToken, limit);

      for (const reply of replies) {
        if (allReplies.length >= MAX_TOTAL_REPLIES) break;

        const text = (reply.text || '').slice(0, MAX_CHARS_PER_REPLY);
        if (!text.trim()) continue;

        // 判斷是否為經營者回覆
        const isOwnerReply = reply.is_reply_owned_by_me === true;

        allReplies.push({
          text,
          username: reply.username || 'anonymous',
          timestamp: reply.timestamp || '',
          is_owner_reply: isOwnerReply,
          post_id: post.id,
          post_text: (post.text || '').slice(0, 100),
        });
      }
    } catch (error) {
      console.error(`Failed to fetch replies for post ${post.threads_post_id}:`, error);
    }
  }

  return allReplies;
}

async function fetchPostReplies(
  threadsPostId: string,
  accessToken: string,
  limit: number
): Promise<ThreadsReply[]> {
  const fields = 'id,text,username,timestamp,is_reply_owned_by_me';
  const url = `${THREADS_API_BASE}/${threadsPostId}/conversation?fields=${fields}&limit=${Math.min(limit, 50)}`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('Threads API error:', { status: response.status, body: errorBody });
    return [];
  }

  const data = await response.json();
  return data.data || [];
}

// ============================================================================
// Prompt 建構函數（深度分析版本 v2）
// ============================================================================

function buildExecutiveAndImagePrompt(bio: string, posts: PostWithReplies[]): string {
  const sections: string[] = [];

  sections.push(`## 帳號 Bio\n${bio || '（未設定）'}`);

  // 貼文統計
  const totalViews = posts.reduce((sum, p) => sum + p.current_views, 0);
  const totalReplies = posts.reduce((sum, p) => sum + p.current_replies, 0);
  const avgViews = posts.length > 0 ? Math.round(totalViews / posts.length) : 0;
  const avgReplies = posts.length > 0 ? Math.round(totalReplies / posts.length) : 0;

  sections.push(`## 貼文統計
- 分析期間貼文數：${posts.length} 篇
- 總觀看數：${totalViews.toLocaleString()}
- 總回覆數：${totalReplies.toLocaleString()}
- 平均觀看：${avgViews.toLocaleString()} / 篇
- 平均回覆：${avgReplies} / 篇`);

  // 貼文內容
  const postTexts = posts.slice(0, 30).map((p, i) =>
    `${i + 1}. [觀看${p.current_views}｜回覆${p.current_replies}] ${p.text.slice(0, 300)}`
  );
  sections.push(`## 近期貼文（取前 30 篇）\n${postTexts.join('\n')}`);

  return sections.join('\n\n');
}

function buildAudienceSegmentsPrompt(replies: CollectedReply[], posts: PostWithReplies[]): string {
  const sections: string[] = [];

  // 排除經營者自己的回覆
  const audienceReplies = replies.filter(r => !r.is_owner_reply);

  // 統計資訊
  const uniqueUsers = new Set(audienceReplies.map(r => r.username)).size;
  sections.push(`## 回覆統計
- 總回覆數：${audienceReplies.length} 則
- 獨立用戶數：${uniqueUsers} 人
- 平均每人回覆：${(audienceReplies.length / uniqueUsers).toFixed(1)} 則`);

  // 回覆內容（含貼文脈絡）
  sections.push(`## 受眾回覆（共 ${audienceReplies.length} 則）`);
  const replyTexts = audienceReplies.slice(0, 300).map((r, i) =>
    `${i + 1}. @${r.username}: ${r.text}\n   └ 回覆的貼文：「${r.post_text}...」`
  );
  sections.push(replyTexts.join('\n'));

  // 貼文主題供參考
  sections.push(`## 貼文主題參考（供分析受眾興趣）`);
  const postSummary = posts.slice(0, 20).map((p, i) => `${i + 1}. ${p.text.slice(0, 100)}...`);
  sections.push(postSummary.join('\n'));

  return sections.join('\n\n');
}

function buildContentHealthPrompt(
  executiveAndImage: {
    executive_summary: PersonaReportContent['executive_summary'];
    persona_image: PersonaReportContent['persona_image'];
  },
  audienceSegments: PersonaReportContent['audience_segments'],
  posts: PostWithReplies[]
): string {
  const sections: string[] = [];

  // 前一階段結果摘要
  sections.push(`## 人設定位摘要
- 定位：${executiveAndImage.executive_summary.positioning}
- 健康度：${executiveAndImage.executive_summary.health_score}/100
- 階段：${executiveAndImage.executive_summary.stage.label}
- 核心瓶頸：${executiveAndImage.executive_summary.core_bottleneck.title}`);

  // 受眾摘要
  sections.push(`## 受眾分群摘要`);
  audienceSegments.forEach((seg, i) => {
    const needsSummary = seg.needs.pain_points.map(p => `${p.title}(滿足${p.satisfaction}%)`).join('、');
    sections.push(`${i + 1}. **${seg.name}**（${seg.percentage}%）
   - 卡在：${seg.journey.stuck_at}
   - 痛點：${needsSummary}`);
  });

  // 貼文資料
  sections.push(`## 貼文統計
- 分析期間貼文數：${posts.length}
- 總回覆數：${posts.reduce((sum, p) => sum + p.replies.length, 0)}`);

  // 貼文內容供分析內容類型
  sections.push(`## 貼文內容（供分析內容類型分布）`);
  const postTexts = posts.slice(0, 30).map((p, i) => `${i + 1}. ${p.text.slice(0, 200)}`);
  sections.push(postTexts.join('\n'));

  return sections.join('\n\n');
}

function buildActionPlanPrompt(
  executiveAndImage: {
    executive_summary: PersonaReportContent['executive_summary'];
    persona_image: PersonaReportContent['persona_image'];
  },
  audienceSegments: PersonaReportContent['audience_segments'],
  contentHealth: PersonaReportContent['content_health']
): string {
  const sections: string[] = [];

  // 總覽
  sections.push(`## 總覽診斷
- 定位：${executiveAndImage.executive_summary.positioning}
- 階段：${executiveAndImage.executive_summary.stage.label}
- 核心瓶頸：${executiveAndImage.executive_summary.core_bottleneck.title}
- 突破方向：從「${executiveAndImage.executive_summary.breakthrough.from_state}」→「${executiveAndImage.executive_summary.breakthrough.to_state}」`);

  // 形象問題
  if (executiveAndImage.persona_image.perception_gap.mismatches.length > 0) {
    sections.push(`## 形象問題
- 認知落差：${executiveAndImage.persona_image.perception_gap.analysis}
- Bio 建議改為：${executiveAndImage.persona_image.bio_rewrite.suggested}`);
  }

  // 受眾需求缺口
  sections.push(`## 受眾需求缺口`);
  audienceSegments.forEach((seg) => {
    const gaps = seg.needs.pain_points.filter(p => p.satisfaction < 50);
    if (gaps.length > 0) {
      sections.push(`- ${seg.name}：${gaps.map(g => `${g.title}(${g.satisfaction}%)`).join('、')}`);
    }
    // 推進策略
    sections.push(`  推進目標：${seg.advancement.target}`);
  });

  // 內容問題
  sections.push(`## 內容組合問題`);
  contentHealth.type_distribution.issues.forEach((issue, i) => {
    sections.push(`${i + 1}. ${issue.problem}：${issue.detail}`);
  });

  sections.push(`## 階段落差
${contentHealth.stage_analysis.gap_analysis}
建議調整：${contentHealth.stage_analysis.adjustment}`);

  sections.push(`## 任務
根據以上分析，制定具體可執行的行動計畫。包含：
1. 2-3 個立即可做的行動
2. 建議發的 2-3 篇內容（含具體開頭範例）
3. 未來 4 週的內容規劃`);

  return sections.join('\n\n');
}
