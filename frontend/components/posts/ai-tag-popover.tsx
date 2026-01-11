"use client";

import { useState } from "react";
import { Sparkles, Check, ChevronDown } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface TagResult {
  tag: string;
  confidence: number;
}

interface AiSuggestedTags {
  content_type?: TagResult[];
  tone?: TagResult[];
  intent?: TagResult[];
  emotion?: TagResult[];
  audience?: TagResult[];
}

interface AiSelectedTags {
  content_type?: string[];
  tone?: string[];
  intent?: string[];
  emotion?: string[];
  audience?: string[];
}

interface AiTagPopoverProps {
  postId: string;
  aiSuggestedTags: AiSuggestedTags | null;
  aiSelectedTags?: AiSelectedTags | null;
  onTagSelect?: (postId: string, dimension: string, tag: string, selected: boolean) => void;
}

const DIMENSION_LABELS: Record<string, string> = {
  content_type: "內容類型",
  tone: "語氣風格",
  intent: "互動意圖",
  emotion: "情緒色彩",
  audience: "目標受眾",
};

const DIMENSION_ORDER = ["content_type", "tone", "intent", "emotion", "audience"];

// 維度顏色映射
const DIMENSION_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  content_type: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  tone: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  intent: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  emotion: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
  audience: { bg: "bg-violet-50", text: "text-violet-700", border: "border-violet-200" },
};

function getConfidenceBadge(confidence: number): string {
  if (confidence >= 0.8) return "bg-green-100 text-green-700 border-green-200";
  if (confidence >= 0.6) return "bg-yellow-100 text-yellow-700 border-yellow-200";
  return "bg-gray-100 text-gray-500 border-gray-200";
}

export function AiTagPopover({
  postId,
  aiSuggestedTags,
  aiSelectedTags,
  onTagSelect,
}: AiTagPopoverProps) {
  const [open, setOpen] = useState(false);

  // 計算已選擇的標籤總數
  const selectedCount = aiSelectedTags
    ? Object.values(aiSelectedTags).reduce((sum, tags) => sum + (tags?.length || 0), 0)
    : 0;

  // 取得所有已選標籤（帶維度資訊）
  const getSelectedTags = (): Array<{ tag: string; dimension: string }> => {
    if (!aiSelectedTags) return [];
    const result: Array<{ tag: string; dimension: string }> = [];
    for (const dim of DIMENSION_ORDER) {
      const tags = aiSelectedTags[dim as keyof AiSelectedTags];
      if (tags) {
        tags.forEach(tag => result.push({ tag, dimension: dim }));
      }
    }
    return result;
  };

  // 取得每個維度最高信心度的標籤作為預設顯示
  const getTopTags = (): Array<{ tag: string; dimension: string; confidence: number }> => {
    if (!aiSuggestedTags) return [];
    const result: Array<{ tag: string; dimension: string; confidence: number }> = [];
    for (const dim of DIMENSION_ORDER) {
      const tags = aiSuggestedTags[dim as keyof AiSuggestedTags];
      if (tags && tags.length > 0) {
        result.push({ tag: tags[0].tag, dimension: dim, confidence: tags[0].confidence });
      }
    }
    return result.slice(0, 3); // 只顯示前 3 個維度的最高標籤
  };

  const isTagSelected = (dimension: string, tag: string): boolean => {
    if (!aiSelectedTags) return false;
    const selected = aiSelectedTags[dimension as keyof AiSelectedTags];
    return Array.isArray(selected) && selected.includes(tag);
  };

  const handleTagClick = (dimension: string, tag: string) => {
    if (!onTagSelect) return;
    const currentlySelected = isTagSelected(dimension, tag);
    onTagSelect(postId, dimension, tag, !currentlySelected);
  };

  // 無 AI 標籤時顯示
  if (!aiSuggestedTags || Object.keys(aiSuggestedTags).length === 0) {
    return (
      <span className="text-xs text-muted-foreground">分析中...</span>
    );
  }

  const selectedTags = getSelectedTags();
  const topTags = getTopTags();
  const displayTags = selectedCount > 0 ? selectedTags.slice(0, 3) : topTags;
  const remainingCount = selectedCount > 0 ? selectedCount - 3 : topTags.length - 3;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="flex flex-wrap items-center gap-1 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-muted/50"
        >
          {displayTags.map((item, i) => {
            const colors = DIMENSION_COLORS[item.dimension];
            return (
              <span
                key={i}
                className={cn(
                  "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
                  colors.bg,
                  colors.text,
                  colors.border
                )}
              >
                {item.tag}
              </span>
            );
          })}
          {remainingCount > 0 && (
            <span className="text-xs text-muted-foreground">
              +{remainingCount}
            </span>
          )}
          <ChevronDown className="size-3 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[420px] p-0" align="start">
        <div className="max-h-[400px] overflow-y-auto p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium">
            <Sparkles className="size-4 text-purple-500" />
            AI 標籤分析
          </div>
          <div className="space-y-3">
            {DIMENSION_ORDER.map((dimension) => {
              const tags = aiSuggestedTags[dimension as keyof AiSuggestedTags];
              if (!tags || tags.length === 0) return null;
              const colors = DIMENSION_COLORS[dimension];

              return (
                <div key={dimension}>
                  <div className="mb-1.5 text-xs font-medium text-muted-foreground">
                    {DIMENSION_LABELS[dimension]}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map((item, index) => {
                      const selected = isTagSelected(dimension, item.tag);
                      return (
                        <button
                          key={`${dimension}-${index}`}
                          onClick={() => handleTagClick(dimension, item.tag)}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-all",
                            selected
                              ? cn(colors.bg, colors.text, colors.border, "ring-2 ring-offset-1", `ring-${colors.text.replace('text-', '')}`)
                              : "bg-gray-50 text-gray-600 border-gray-200 opacity-60 hover:opacity-100",
                            "hover:shadow-sm"
                          )}
                        >
                          {selected && <Check className="size-3" />}
                          <span>{item.tag}</span>
                          <span className="opacity-50 text-[10px]">
                            {Math.round(item.confidence * 100)}%
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 border-t pt-2 text-xs text-muted-foreground">
            點擊標籤選取，用於成效分析
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
