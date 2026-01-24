/**
 * Claude API Client
 *
 * 用於 AI 週報分析（Claude Opus 4.5）
 */

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

export interface ClaudeUsage {
  input_tokens: number;
  output_tokens: number;
}

export interface ClaudeResponse<T> {
  content: T;
  usage: ClaudeUsage;
}

export class ClaudeClient {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model = 'claude-sonnet-4-20250514') {
    this.apiKey = apiKey;
    this.model = model;
  }

  async generateReport(systemPrompt: string, userPrompt: string): Promise<ClaudeResponse<string>> {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 8192,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userPrompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('Claude API error:', { status: response.status, body: errorBody });
      throw new Error('AI 服務暫時無法使用');
    }

    const data = await response.json();

    // 解析回應
    const textContent = data.content?.find((c: { type: string }) => c.type === 'text');
    if (!textContent?.text) {
      throw new Error('No text content in Claude response');
    }

    return {
      content: textContent.text,
      usage: {
        input_tokens: data.usage?.input_tokens ?? 0,
        output_tokens: data.usage?.output_tokens ?? 0,
      },
    };
  }

  /**
   * 產生週報分析（回傳 JSON 格式）
   */
  async generateWeeklyReport<T>(systemPrompt: string, userPrompt: string): Promise<ClaudeResponse<T>> {
    const result = await this.generateReport(systemPrompt, userPrompt);

    // 嘗試解析 JSON（Claude 可能會包含 markdown code block）
    let jsonStr = result.content;

    // 移除可能的 markdown code block
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    try {
      const parsed = JSON.parse(jsonStr) as T;
      return {
        content: parsed,
        usage: result.usage,
      };
    } catch (parseError) {
      console.error('Failed to parse Claude response as JSON:', { response: jsonStr.slice(0, 500), error: parseError });
      throw new Error('AI 回應格式錯誤');
    }
  }
}
