"use client";

import { Sparkles, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { AggregatedAiTag } from "@/hooks/use-ai-tags";

interface AiTagsSectionProps {
  selectedTags: AggregatedAiTag[];
  unselectedTags: AggregatedAiTag[];
  isLoading: boolean;
}

const DIMENSION_LABELS: Record<string, string> = {
  content_type: "內容類型",
  tone: "語氣風格",
  intent: "互動意圖",
  emotion: "情緒色彩",
  audience: "目標受眾",
};

const DIMENSION_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  content_type: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  tone: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  intent: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  emotion: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
  audience: { bg: "bg-violet-50", text: "text-violet-700", border: "border-violet-200" },
};

export function AiTagsSection({
  selectedTags,
  unselectedTags,
  isLoading,
}: AiTagsSectionProps) {
  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      </div>
    );
  }

  const hasAnyTags = selectedTags.length > 0 || unselectedTags.length > 0;

  if (!hasAnyTags) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-8">
          <Sparkles className="size-10 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            尚無 AI 分析標籤，貼文同步後將自動分析
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* 已選擇的 AI 標籤 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Check className="size-4 text-green-600" />
            已選擇的 AI 標籤
            <span className="text-sm font-normal text-muted-foreground">
              ({selectedTags.length})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {selectedTags.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              尚未選擇任何 AI 標籤，可在貼文列表點選標籤進行選擇
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {selectedTags.map((tag) => {
                const colors = DIMENSION_COLORS[tag.dimension];
                return (
                  <div
                    key={`${tag.dimension}:${tag.tag}`}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium",
                      colors.bg,
                      colors.text,
                      colors.border
                    )}
                  >
                    <span>{tag.tag}</span>
                    <span className="rounded-full bg-white/60 px-1.5 py-0.5 text-xs">
                      {tag.selectedCount} 篇
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 未選擇的 AI 標籤 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="size-4 text-purple-500" />
            AI 建議標籤（未選擇）
            <span className="text-sm font-normal text-muted-foreground">
              ({unselectedTags.length})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {unselectedTags.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              所有 AI 建議標籤都已選擇
            </p>
          ) : (
            <div className="space-y-4">
              {/* 按維度分組顯示 */}
              {Object.keys(DIMENSION_LABELS).map((dimension) => {
                const dimTags = unselectedTags.filter((t) => t.dimension === dimension);
                if (dimTags.length === 0) return null;

                return (
                  <div key={dimension}>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">
                      {DIMENSION_LABELS[dimension]}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {dimTags.map((tag) => (
                        <div
                          key={`${tag.dimension}:${tag.tag}`}
                          className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-600"
                        >
                          <span>{tag.tag}</span>
                          <span className="text-xs text-gray-400">
                            {Math.round(tag.avgConfidence * 100)}%
                          </span>
                          <span className="text-xs text-gray-400">
                            · {tag.totalCount} 篇
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
