"use client";

import { Check, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { AccountTag } from "@/hooks/use-account-tags";

export interface PostsFiltersValue {
  timeRange: string;
  mediaType: string;
  tagIds: string[];
  aiTags: {
    content_type: string[];
    tone: string[];
    intent: string[];
  };
}

// AI 標籤選項
const AI_TAG_OPTIONS = {
  content_type: [
    { value: "教學", label: "教學" },
    { value: "分享", label: "分享" },
    { value: "問題", label: "問題" },
    { value: "公告", label: "公告" },
    { value: "心得", label: "心得" },
    { value: "推薦", label: "推薦" },
    { value: "日常", label: "日常" },
  ],
  tone: [
    { value: "正式", label: "正式" },
    { value: "輕鬆", label: "輕鬆" },
    { value: "幽默", label: "幽默" },
    { value: "專業", label: "專業" },
    { value: "親切", label: "親切" },
  ],
  intent: [
    { value: "引導互動", label: "引導互動" },
    { value: "資訊傳遞", label: "資訊傳遞" },
    { value: "品牌推廣", label: "品牌推廣" },
    { value: "社群經營", label: "社群經營" },
    { value: "銷售導向", label: "銷售導向" },
  ],
};

interface PostsFiltersProps {
  filters: PostsFiltersValue;
  onFiltersChange: (filters: PostsFiltersValue) => void;
  tags?: AccountTag[];
}

export function PostsFilters({ filters, onFiltersChange, tags = [] }: PostsFiltersProps) {
  const handleChange = (key: keyof PostsFiltersValue, value: string | string[] | PostsFiltersValue["aiTags"]) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const handleTagToggle = (tagId: string) => {
    const newTagIds = filters.tagIds.includes(tagId)
      ? filters.tagIds.filter((id) => id !== tagId)
      : [...filters.tagIds, tagId];
    handleChange("tagIds", newTagIds);
  };

  const clearTags = () => {
    handleChange("tagIds", []);
  };

  const handleAiTagToggle = (dimension: keyof PostsFiltersValue["aiTags"], value: string) => {
    const currentTags = filters.aiTags?.[dimension] || [];
    const newTags = currentTags.includes(value)
      ? currentTags.filter(t => t !== value)
      : [...currentTags, value];
    handleChange("aiTags", {
      ...filters.aiTags,
      [dimension]: newTags,
    });
  };

  const clearAiTags = () => {
    handleChange("aiTags", { content_type: [], tone: [], intent: [] });
  };

  const selectedTags = tags.filter((t) => filters.tagIds.includes(t.id));

  // 計算已選的 AI 標籤數量
  const selectedAiTagsCount =
    (filters.aiTags?.content_type?.length || 0) +
    (filters.aiTags?.tone?.length || 0) +
    (filters.aiTags?.intent?.length || 0);

  return (
    <div className="flex flex-wrap items-center gap-4">
      {/* 時間範圍 */}
      <Select value={filters.timeRange} onValueChange={(v) => handleChange("timeRange", v)}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="時間範圍" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="7d">最近 7 天</SelectItem>
          <SelectItem value="30d">最近 30 天</SelectItem>
          <SelectItem value="90d">最近 90 天</SelectItem>
          <SelectItem value="all">全部時間</SelectItem>
        </SelectContent>
      </Select>

      {/* 媒體類型 */}
      <Select value={filters.mediaType} onValueChange={(v) => handleChange("mediaType", v)}>
        <SelectTrigger className="w-[120px]">
          <SelectValue placeholder="媒體類型" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">全部</SelectItem>
          <SelectItem value="TEXT_POST">文字</SelectItem>
          <SelectItem value="IMAGE">圖片</SelectItem>
          <SelectItem value="VIDEO">影片</SelectItem>
          <SelectItem value="CAROUSEL_ALBUM">輪播</SelectItem>
        </SelectContent>
      </Select>

      {/* 標籤篩選 */}
      {tags.length > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "min-w-[100px] justify-start",
                selectedTags.length > 0 && "border-primary"
              )}
            >
              {selectedTags.length === 0 ? (
                <span className="text-muted-foreground">標籤</span>
              ) : selectedTags.length === 1 ? (
                <div className="flex items-center gap-2">
                  <div
                    className="size-3 rounded-full"
                    style={{ backgroundColor: selectedTags[0].color }}
                  />
                  <span className="truncate">{selectedTags[0].name}</span>
                </div>
              ) : (
                <span>{selectedTags.length} 個標籤</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2" align="start">
            <div className="space-y-1">
              {tags.map((tag) => (
                <button
                  key={tag.id}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent",
                    filters.tagIds.includes(tag.id) && "bg-accent"
                  )}
                  onClick={() => handleTagToggle(tag.id)}
                >
                  <div
                    className="size-3 shrink-0 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="flex-1 truncate text-left">{tag.name}</span>
                  {filters.tagIds.includes(tag.id) && (
                    <Check className="size-4 text-primary" />
                  )}
                </button>
              ))}
            </div>

            {selectedTags.length > 0 && (
              <div className="mt-2 border-t pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-muted-foreground"
                  onClick={clearTags}
                >
                  <X className="mr-1 size-4" />
                  清除篩選
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>
      )}

      {/* AI 標籤篩選 */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "min-w-[100px] justify-start",
              selectedAiTagsCount > 0 && "border-primary"
            )}
          >
            {selectedAiTagsCount === 0 ? (
              <span className="text-muted-foreground">AI 標籤</span>
            ) : (
              <span>{selectedAiTagsCount} 個 AI 標籤</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-3" align="start">
          <div className="space-y-4">
            {/* 內容類型 */}
            <div>
              <div className="text-sm font-medium mb-2">內容類型</div>
              <div className="flex flex-wrap gap-1">
                {AI_TAG_OPTIONS.content_type.map((opt) => (
                  <button
                    key={opt.value}
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs border transition-colors",
                      filters.aiTags?.content_type?.includes(opt.value)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background hover:bg-accent border-border"
                    )}
                    onClick={() => handleAiTagToggle("content_type", opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 語氣 */}
            <div>
              <div className="text-sm font-medium mb-2">語氣</div>
              <div className="flex flex-wrap gap-1">
                {AI_TAG_OPTIONS.tone.map((opt) => (
                  <button
                    key={opt.value}
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs border transition-colors",
                      filters.aiTags?.tone?.includes(opt.value)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background hover:bg-accent border-border"
                    )}
                    onClick={() => handleAiTagToggle("tone", opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 意圖 */}
            <div>
              <div className="text-sm font-medium mb-2">意圖</div>
              <div className="flex flex-wrap gap-1">
                {AI_TAG_OPTIONS.intent.map((opt) => (
                  <button
                    key={opt.value}
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs border transition-colors",
                      filters.aiTags?.intent?.includes(opt.value)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background hover:bg-accent border-border"
                    )}
                    onClick={() => handleAiTagToggle("intent", opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {selectedAiTagsCount > 0 && (
              <div className="border-t pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-muted-foreground"
                  onClick={clearAiTags}
                >
                  <X className="mr-1 size-4" />
                  清除 AI 標籤篩選
                </Button>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* 已選擇標籤的 Badge（可點擊移除） */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedTags.map((tag) => (
            <button
              key={tag.id}
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-white transition-opacity hover:opacity-80"
              style={{ backgroundColor: tag.color }}
              onClick={() => handleTagToggle(tag.id)}
            >
              {tag.name}
              <X className="size-3" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
