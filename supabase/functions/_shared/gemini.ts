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

export interface AiSuggestedTags {
  content_type: TagResult[];
  tone: TagResult[];
  intent: TagResult[];
  emotion: TagResult[];
  audience: TagResult[];
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

const TAGGING_PROMPT = `你是一個內容分析專家，專門分析社群媒體貼文。請分析以下貼文內容，並從 5 個維度進行分類。

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
  "audience": [...]
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
      const error = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${error}`);
    }

    const data = await response.json();

    // 解析回應
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) {
      throw new Error('No content in Gemini response');
    }

    // 解析 JSON 回應
    const tags = JSON.parse(content) as AiSuggestedTags;

    // 取得 usage
    const usage: GeminiUsage = {
      promptTokenCount: data.usageMetadata?.promptTokenCount ?? 0,
      candidatesTokenCount: data.usageMetadata?.candidatesTokenCount ?? 0,
      totalTokenCount: data.usageMetadata?.totalTokenCount ?? 0,
    };

    return { tags, usage };
  }
}
