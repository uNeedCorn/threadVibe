"use client";

import { Eye, TrendingUp, Crown, Medal, Award, Image, FileText, Video, Images } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PostSummary } from "@/hooks/use-content-pattern-report";

interface PostCardProps {
  post: PostSummary;
  rank: number;
  variant: "success" | "failure";
}

const successRankConfig = [
  {
    icon: Crown,
    color: "text-amber-500",
    bg: "bg-gradient-to-br from-amber-500/20 to-amber-600/10",
    border: "border-amber-500/30",
    rankBg: "bg-amber-500",
  },
  {
    icon: Medal,
    color: "text-slate-400",
    bg: "bg-gradient-to-br from-slate-400/15 to-slate-500/5",
    border: "border-slate-400/30",
    rankBg: "bg-slate-400",
  },
  {
    icon: Award,
    color: "text-amber-700",
    bg: "bg-gradient-to-br from-amber-700/15 to-amber-800/5",
    border: "border-amber-700/30",
    rankBg: "bg-amber-700",
  },
];

const failureRankConfig = [
  {
    icon: Crown,
    color: "text-rose-500",
    bg: "bg-gradient-to-br from-rose-500/15 to-rose-600/5",
    border: "border-rose-500/30",
    rankBg: "bg-rose-500",
  },
  {
    icon: Medal,
    color: "text-rose-400",
    bg: "bg-gradient-to-br from-rose-400/10 to-rose-500/5",
    border: "border-rose-400/20",
    rankBg: "bg-rose-400",
  },
  {
    icon: Award,
    color: "text-rose-300",
    bg: "bg-gradient-to-br from-rose-300/10 to-rose-400/5",
    border: "border-rose-300/20",
    rankBg: "bg-rose-300",
  },
];

const MEDIA_TYPE_ICONS: Record<string, React.ElementType> = {
  "純文字": FileText,
  "圖片": Image,
  "影片": Video,
  "輪播": Images,
  TEXT_POST: FileText,
  IMAGE: Image,
  VIDEO: Video,
  CAROUSEL_ALBUM: Images,
};

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
}

function getMediaTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    // API 原始格式
    TEXT_POST: "純文字",
    IMAGE: "圖片",
    VIDEO: "影片",
    CAROUSEL_ALBUM: "輪播",
    REPOST_FACADE: "轉發",
    // 中文格式（保持原樣）
    "純文字": "純文字",
    "圖片": "圖片",
    "影片": "影片",
    "輪播": "輪播",
    "轉發": "轉發",
  };
  return labels[type] || type;
}

export function PostCard({ post, rank, variant }: PostCardProps) {
  const rankConfigs = variant === "success" ? successRankConfig : failureRankConfig;
  const config = rankConfigs[Math.min(rank - 1, 2)] || rankConfigs[2];
  const MediaIcon = MEDIA_TYPE_ICONS[post.media_type] || FileText;

  return (
    <div
      className={cn(
        "relative overflow-hidden p-4 rounded-xl border transition-all hover:shadow-md",
        config.bg,
        config.border
      )}
    >
      {/* 排名標記 */}
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex-shrink-0 flex items-center justify-center size-8 rounded-lg text-white text-sm font-bold",
            config.rankBg
          )}
        >
          #{rank}
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          {/* 貼文文字 - 前三行，hover 顯示完整 */}
          <div className="group relative">
            <p className="text-[13px] leading-relaxed line-clamp-3">
              {post.text || "(無文字內容)"}
            </p>
            {/* Hover 時顯示完整內容 */}
            {post.text && post.text.length > 100 && (
              <div className="absolute left-0 top-0 z-50 hidden group-hover:block w-full max-w-md p-3 rounded-lg bg-popover border shadow-lg">
                <p className="text-[13px] leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto">
                  {post.text}
                </p>
              </div>
            )}
          </div>

          {/* 統計數據 - 單行 */}
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1">
              <Eye className="size-3 text-blue-500" />
              <span className="font-medium text-foreground tabular-nums">{formatNumber(post.views)}</span>
            </span>
            <span className="flex items-center gap-1">
              <TrendingUp className={cn("size-3", variant === "success" ? "text-emerald-500" : "text-rose-500")} />
              <span className="font-medium text-foreground tabular-nums">{(post.engagement_rate * 100).toFixed(2)}%</span>
            </span>
            <span className="flex items-center gap-1">
              <MediaIcon className="size-3 text-purple-500" />
              {getMediaTypeLabel(post.media_type)}
            </span>
            <span>{post.char_count} 字</span>
          </div>

          {/* 特徵標籤 */}
          {post.features.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {post.features.map((feature, idx) => (
                <Badge
                  key={idx}
                  variant="secondary"
                  className={cn(
                    "text-[11px] px-2 py-0.5",
                    variant === "success"
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                      : "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20"
                  )}
                >
                  {feature}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
