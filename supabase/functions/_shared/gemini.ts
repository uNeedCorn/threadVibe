/**
 * Gemini API Client
 *
 * 用於 AI 內容分析
 */

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

export interface TagResult {
  tag: string;
  confidence: number;
}

export interface ContentFeaturesAi {
  has_question: boolean;
  question_type: 'direct' | 'rhetorical' | 'poll' | null;
  has_cta: boolean;
  cta_type: 'ask_opinion' | 'share' | 'comment' | 'click_link' | 'follow' | null;
}

export interface AiSuggestedTags {
  content_type: TagResult[];
  tone: TagResult[];
  intent: TagResult[];
  emotion: TagResult[];
  audience: TagResult[];
  content_features: ContentFeaturesAi;
}

export interface GeminiUsage {
  promptTokenCount: number;
  candidatesTokenCount: number;
  totalTokenCount: number;
}

export interface GeminiResponse {
  tags: AiSuggestedTags;
  usage: GeminiUsage;
}

const TAGGING_PROMPT = `你是一個內容分析專家，專門分析社群媒體貼文。請分析以下貼文內容，並從 5 個維度進行分類，同時識別內容特徵。

每個維度請回傳信心度最高的前 3 個標籤，信心度範圍為 0-1（保留兩位小數）。

## 維度與選項

### 1. 內容類型 (content_type)
選項：教學分享、日常隨筆、產品推廣、時事評論、問答互動、公告通知、個人故事、迷因娛樂

### 2. 語氣風格 (tone)
選項：專業正式、輕鬆幽默、真誠感性、犀利直接、中立客觀

### 3. 互動意圖 (intent)
選項：引發討論、知識傳遞、導流轉換、品牌建立、社群互動、個人抒發

### 4. 情緒色彩 (emotion)
選項：正向積極、中性平和、感性溫暖、幽默諷刺、批判反思

### 5. 目標受眾 (audience)
選項：新手入門、進階玩家、一般大眾、業界同行、忠實粉絲

### 6. 內容特徵 (content_features)
請分析以下特徵：
- has_question: 貼文是否在詢問讀者意見或提出問題（包含隱性問句，如「不知道大家怎麼想」）
- question_type: 問題類型
  - direct: 直接提問（如「你覺得呢？」「有人試過嗎？」）
  - rhetorical: 反問/修辭問句（如「這不是很棒嗎？」）
  - poll: 投票選擇（如「A 還是 B？」）
  - null: 無問句
- has_cta: 是否有呼籲讀者採取行動
- cta_type: CTA 類型
  - ask_opinion: 徵求意見（如「留言告訴我」「想聽你的想法」）
  - share: 分享/轉發（如「分享給朋友」「標記需要的人」）
  - comment: 留言互動（如「留言+1」「底下留言」）
  - click_link: 點擊連結（如「點擊連結」「看更多」）
  - follow: 追蹤（如「記得追蹤」「開啟通知」）
  - null: 無 CTA

## 回傳格式

請以 JSON 格式回傳，結構如下：
{
  "content_type": [
    {"tag": "標籤名稱", "confidence": 0.95},
    {"tag": "標籤名稱", "confidence": 0.72},
    {"tag": "標籤名稱", "confidence": 0.58}
  ],
  "tone": [...],
  "intent": [...],
  "emotion": [...],
  "audience": [...],
  "content_features": {
    "has_question": true,
    "question_type": "direct",
    "has_cta": true,
    "cta_type": "ask_opinion"
  }
}

## 貼文內容

`;

export class GeminiClient {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model = 'gemini-2.0-flash') {
    this.apiKey = apiKey;
    this.model = model;
  }

  async analyzePost(postText: string): Promise<GeminiResponse> {
    const url = `${GEMINI_API_URL}/${this.model}:generateContent?key=${this.apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: TAGGING_PROMPT + postText,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 1024,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('Gemini API error:', { status: response.status, body: errorBody });
      throw new Error('AI 服務暫時無法使用');
    }

    const data = await response.json();

    // 解析回應
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) {
      console.error('No content in Gemini response:', data);
      throw new Error('AI 回應格式錯誤');
    }

    // 解析 JSON 回應
    let tags: AiSuggestedTags;
    try {
      tags = JSON.parse(content) as AiSuggestedTags;
    } catch (parseError) {
      console.error('Failed to parse Gemini response as JSON:', { content: content.slice(0, 500), error: parseError });
      throw new Error('AI 回應格式錯誤');
    }

    // 取得 usage
    const usage: GeminiUsage = {
      promptTokenCount: data.usageMetadata?.promptTokenCount ?? 0,
      candidatesTokenCount: data.usageMetadata?.candidatesTokenCount ?? 0,
      totalTokenCount: data.usageMetadata?.totalTokenCount ?? 0,
    };

    return { tags, usage };
  }
}
