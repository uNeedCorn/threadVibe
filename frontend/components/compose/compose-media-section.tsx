"use client";

import { useState } from "react";
import { Plus, X, Link2, Image, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { MediaType } from "./media-type-selector";

interface ComposeMediaSectionProps {
  mediaType: MediaType;
  mediaUrls: string[];
  onMediaUrlsChange: (urls: string[]) => void;
  disabled?: boolean;
}

const CAROUSEL_MAX = 20;

export function ComposeMediaSection({
  mediaType,
  mediaUrls,
  onMediaUrlsChange,
  disabled,
}: ComposeMediaSectionProps) {
  const [inputUrl, setInputUrl] = useState("");

  // 文字貼文不需要媒體
  if (mediaType === "TEXT") {
    return null;
  }

  const handleAddUrl = () => {
    const url = inputUrl.trim();
    if (!url) return;

    // 簡單的 URL 驗證
    try {
      new URL(url);
    } catch {
      return;
    }

    if (mediaType === "CAROUSEL") {
      if (mediaUrls.length < CAROUSEL_MAX) {
        onMediaUrlsChange([...mediaUrls, url]);
      }
    } else {
      // 單一媒體，取代現有的
      onMediaUrlsChange([url]);
    }
    setInputUrl("");
  };

  const handleRemoveUrl = (index: number) => {
    const newUrls = mediaUrls.filter((_, i) => i !== index);
    onMediaUrlsChange(newUrls);
  };

  const isVideo = (url: string) => {
    const lower = url.toLowerCase();
    return lower.includes(".mp4") || lower.includes(".mov") || lower.includes("video");
  };

  return (
    <div className="space-y-3">
      <Label className="flex items-center gap-1">
        <Link2 className="size-3" />
        媒體 URL
        {mediaType === "CAROUSEL" && (
          <span className="text-xs text-muted-foreground">
            （{mediaUrls.length}/{CAROUSEL_MAX}）
          </span>
        )}
      </Label>

      {/* 已添加的媒體列表 */}
      {mediaUrls.length > 0 && (
        <div className={cn(
          "grid gap-2",
          mediaType === "CAROUSEL" ? "grid-cols-4" : "grid-cols-1"
        )}>
          {mediaUrls.map((url, index) => (
            <div
              key={index}
              className={cn(
                "group relative rounded-lg border bg-muted/30 overflow-hidden",
                mediaType === "CAROUSEL" ? "aspect-square" : "h-32"
              )}
            >
              {/* 預覽 */}
              <div className="flex h-full items-center justify-center p-2">
                {isVideo(url) ? (
                  <Video className="size-8 text-muted-foreground" />
                ) : (
                  <Image className="size-8 text-muted-foreground" />
                )}
              </div>
              {/* URL 提示 */}
              <div className="absolute inset-x-0 bottom-0 bg-black/60 px-2 py-1">
                <p className="truncate text-[10px] text-white">
                  {url.split("/").pop()}
                </p>
              </div>
              {/* 刪除按鈕 */}
              <Button
                variant="destructive"
                size="icon"
                className="absolute right-1 top-1 size-6 opacity-0 transition-opacity group-hover:opacity-100"
                onClick={() => handleRemoveUrl(index)}
                disabled={disabled}
              >
                <X className="size-3" />
              </Button>
            </div>
          ))}

          {/* 輪播添加按鈕 */}
          {mediaType === "CAROUSEL" && mediaUrls.length < CAROUSEL_MAX && (
            <label className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors hover:border-primary hover:bg-primary/5">
              <Plus className="size-6 text-muted-foreground" />
              <span className="mt-1 text-xs text-muted-foreground">添加</span>
            </label>
          )}
        </div>
      )}

      {/* 輸入 URL */}
      {(mediaType !== "CAROUSEL" || mediaUrls.length === 0) && (
        <div className="flex gap-2">
          <Input
            placeholder="貼上公開可存取的媒體 URL"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddUrl()}
            disabled={disabled}
          />
          <Button
            type="button"
            variant="secondary"
            onClick={handleAddUrl}
            disabled={disabled || !inputUrl.trim()}
          >
            <Plus className="size-4" />
          </Button>
        </div>
      )}

      {/* 輪播時的 URL 輸入 */}
      {mediaType === "CAROUSEL" && mediaUrls.length > 0 && mediaUrls.length < CAROUSEL_MAX && (
        <div className="flex gap-2">
          <Input
            placeholder="貼上更多媒體 URL"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddUrl()}
            disabled={disabled}
          />
          <Button
            type="button"
            variant="secondary"
            onClick={handleAddUrl}
            disabled={disabled || !inputUrl.trim()}
          >
            <Plus className="size-4" />
          </Button>
        </div>
      )}

      {/* 提示 */}
      <p className="text-xs text-muted-foreground">
        {mediaType === "IMAGE" && "支援 JPEG、PNG 格式，最大 8MB"}
        {mediaType === "VIDEO" && "支援 MOV、MP4 格式，最大 1GB，最長 5 分鐘"}
        {mediaType === "CAROUSEL" && "至少 2 個、最多 20 個媒體項目"}
      </p>
    </div>
  );
}
