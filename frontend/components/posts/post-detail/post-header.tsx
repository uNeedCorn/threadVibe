"use client";

import { useState } from "react";
import { ExternalLink, Sparkles, ChevronDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { PostTagPopover, type PostTag } from "@/components/posts";
import type { AccountTag } from "@/hooks/use-account-tags";

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

interface PostHeaderProps {
  post: {
    id: string;
    text: string | null;
    permalink: string;
    published_at: string;
    tags?: PostTag[];
    account: {
      username: string;
      profile_pic_url: string | null;
    };
  };
  aiSuggestedTags?: AiSuggestedTags | null;
  aiSelectedTags?: AiSelectedTags | null;
  accountTags?: AccountTag[];
  onTagsChange?: (tags: PostTag[]) => void;
  onCreateTag?: (name: string, color: string) => Promise<AccountTag | null>;
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

export function PostHeader({
  post,
  aiSuggestedTags,
  aiSelectedTags,
  accountTags = [],
  onTagsChange,
  onCreateTag,
}: PostHeaderProps) {
  const [isOtherTagsOpen, setIsOtherTagsOpen] = useState(false);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("zh-TW", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Card className="h-fit">
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* 頂部：發布資訊 + Threads 連結 */}
          <div className="flex items-start justify-between">
            <div className="space-y-1 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Avatar className="size-4">
                  <AvatarImage src={post.account.profile_pic_url || undefined} />
                  <AvatarFallback className="text-[10px]">
                    {post.account.username.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span>@{post.account.username}</span>
              </div>
              <div>{formatDate(post.published_at)}</div>
            </div>
            <a
              href={post.permalink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
              title="在 Threads 開啟"
            >
              <ExternalLink className="size-4" />
            </a>
          </div>

          {/* 貼文文字（限高可捲動） */}
          <div className="max-h-48 overflow-y-auto">
            <p className="whitespace-pre-wrap text-sm leading-relaxed">
              {post.text || "（無文字內容）"}
            </p>
          </div>

          {/* 標籤區塊 */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground">標籤：</span>
            <PostTagPopover
              postId={post.id}
              postTags={post.tags || []}
              accountTags={accountTags}
              onTagsChange={(tags) => onTagsChange?.(tags)}
              onCreateTag={onCreateTag}
            />
          </div>

          {/* AI 標籤 */}
          {aiSuggestedTags && Object.keys(aiSuggestedTags).length > 0 && (() => {
            // 分離已選擇和未選擇的標籤
            const selectedTags: { dimension: string; tag: string; confidence: number }[] = [];
            const otherTags: { dimension: string; tag: string; confidence: number }[] = [];

            DIMENSION_ORDER.forEach((dimension) => {
              const tags = aiSuggestedTags[dimension as keyof AiSuggestedTags];
              const selected = aiSelectedTags?.[dimension as keyof AiSelectedTags] || [];

              if (!tags) return;

              tags.forEach((item) => {
                if (selected.includes(item.tag)) {
                  selectedTags.push({ dimension, tag: item.tag, confidence: item.confidence });
                } else {
                  otherTags.push({ dimension, tag: item.tag, confidence: item.confidence });
                }
              });
            });

            const hasSelectedTags = selectedTags.length > 0;
            const hasOtherTags = otherTags.length > 0;

            if (!hasSelectedTags && !hasOtherTags) return null;

            return (
              <Collapsible open={isOtherTagsOpen} onOpenChange={setIsOtherTagsOpen}>
                <div className="space-y-1.5 rounded-lg border bg-muted/30 p-2">
                  {/* 標題列：AI 標籤 + 展開按鈕 */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Sparkles className="size-3 text-purple-500" />
                      <span>AI 標籤</span>
                      {hasOtherTags && (
                        <span className="text-[10px]">({otherTags.length} 個建議)</span>
                      )}
                    </div>
                    {hasOtherTags && (
                      <CollapsibleTrigger asChild>
                        <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                          <ChevronDown className={`size-3 transition-transform ${isOtherTagsOpen ? "rotate-180" : ""}`} />
                          {isOtherTagsOpen ? "收起" : "展開"}
                        </button>
                      </CollapsibleTrigger>
                    )}
                  </div>

                  {/* 已選擇的標籤 */}
                  {hasSelectedTags && (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedTags.map((item, index) => (
                        <Badge
                          key={`selected-${index}`}
                          variant="outline"
                          className="bg-purple-100 text-purple-800 border-purple-200 text-xs"
                        >
                          <span className="text-[10px] text-purple-500 mr-1">
                            {DIMENSION_LABELS[item.dimension]}
                          </span>
                          {item.tag}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* 其他建議（收折內容） */}
                  {hasOtherTags && (
                    <CollapsibleContent className="pt-1">
                      <div className="space-y-1.5">
                        {DIMENSION_ORDER.map((dimension) => {
                          const dimensionTags = otherTags.filter((t) => t.dimension === dimension);
                          if (dimensionTags.length === 0) return null;
                          return (
                            <div key={dimension} className="flex flex-wrap items-center gap-1.5">
                              <span className="w-16 shrink-0 text-xs text-muted-foreground">
                                {DIMENSION_LABELS[dimension]}
                              </span>
                              {dimensionTags.map((item, index) => (
                                <Badge
                                  key={`${dimension}-${index}`}
                                  variant="outline"
                                  className={`text-xs ${getConfidenceColor(item.confidence)}`}
                                >
                                  {item.tag}
                                  <span className="ml-1 opacity-60">
                                    {Math.round(item.confidence * 100)}%
                                  </span>
                                </Badge>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    </CollapsibleContent>
                  )}

                  {/* 如果沒有已選擇的標籤且未展開 */}
                  {!hasSelectedTags && !isOtherTagsOpen && hasOtherTags && (
                    <p className="text-xs text-muted-foreground">尚未選擇標籤，點擊右上角展開查看建議</p>
                  )}
                </div>
              </Collapsible>
            );
          })()}

        </div>
      </CardContent>
    </Card>
  );
}
