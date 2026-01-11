"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Check } from "lucide-react";
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

interface AiTagsSectionProps {
  aiSuggestedTags: AiSuggestedTags | null;
  aiSelectedTags?: AiSelectedTags | null;
  onSelectTag?: (dimension: string, tag: string, selected: boolean) => void;
  isSelectable?: boolean;
}

const DIMENSION_LABELS: Record<string, string> = {
  content_type: "內容類型",
  tone: "語氣風格",
  intent: "互動意圖",
  emotion: "情緒色彩",
  audience: "目標受眾",
};

const DIMENSION_ORDER = ["content_type", "tone", "intent", "emotion", "audience"];

function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.8) return "bg-green-100 text-green-800 border-green-200";
  if (confidence >= 0.6) return "bg-yellow-100 text-yellow-800 border-yellow-200";
  return "bg-gray-100 text-gray-600 border-gray-200";
}

function getConfidenceLabel(confidence: number): string {
  if (confidence >= 0.8) return "高";
  if (confidence >= 0.6) return "中";
  return "低";
}

export function AiTagsSection({
  aiSuggestedTags,
  aiSelectedTags,
  onSelectTag,
  isSelectable = false,
}: AiTagsSectionProps) {
  if (!aiSuggestedTags || Object.keys(aiSuggestedTags).length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="size-4 text-purple-500" />
            AI 標籤分析
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            AI 分析尚未完成，請稍後再查看。
          </p>
        </CardContent>
      </Card>
    );
  }

  const isTagSelected = (dimension: string, tag: string): boolean => {
    if (!aiSelectedTags) return false;
    const selectedInDimension = aiSelectedTags[dimension as keyof AiSelectedTags];
    return Array.isArray(selectedInDimension) && selectedInDimension.includes(tag);
  };

  const handleTagClick = (dimension: string, tag: string) => {
    if (!isSelectable || !onSelectTag) return;
    const currentlySelected = isTagSelected(dimension, tag);
    onSelectTag(dimension, tag, !currentlySelected);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="size-4 text-purple-500" />
          AI 標籤分析
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {DIMENSION_ORDER.map((dimension) => {
          const tags = aiSuggestedTags[dimension as keyof AiSuggestedTags];
          if (!tags || tags.length === 0) return null;

          return (
            <div key={dimension} className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">
                {DIMENSION_LABELS[dimension]}
              </h4>
              <div className="flex flex-wrap gap-2">
                {tags.map((item, index) => {
                  const selected = isTagSelected(dimension, item.tag);
                  return (
                    <Badge
                      key={`${dimension}-${index}`}
                      variant="outline"
                      className={cn(
                        "cursor-default transition-all",
                        getConfidenceColor(item.confidence),
                        isSelectable && "cursor-pointer hover:opacity-80",
                        selected && "ring-2 ring-purple-500 ring-offset-1"
                      )}
                      onClick={() => handleTagClick(dimension, item.tag)}
                    >
                      {selected && <Check className="mr-1 size-3" />}
                      {item.tag}
                      <span className="ml-1.5 text-xs opacity-60">
                        {Math.round(item.confidence * 100)}%
                      </span>
                    </Badge>
                  );
                })}
              </div>
            </div>
          );
        })}

        {isSelectable && (
          <p className="text-xs text-muted-foreground">
            點擊標籤可選取用於成效分析
          </p>
        )}
      </CardContent>
    </Card>
  );
}
