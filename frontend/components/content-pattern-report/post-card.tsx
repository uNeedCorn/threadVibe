"use client";

import { Eye, TrendingUp, Crown, Medal, Award, Image, FileText, Video, Images } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { typography, semanticColors } from "@/components/report-shared";
import type { PostSummary } from "@/hooks/use-content-pattern-report";

interface PostCardProps {
  post: PostSummary;
  rank: number;
  variant: "success" | "failure";
}

const successRankConfig = [
  { icon: Crown, color: "text-amber-500", bg: "bg-amber-50/50", border: "border-amber-200", rankBg: "bg-amber-500" },
  { icon: Medal, color: "text-slate-400", bg: "bg-slate-50/50", border: "border-slate-200", rankBg: "bg-slate-400" },
  { icon: Award, color: "text-amber-700", bg: "bg-amber-100/50", border: "border-amber-300", rankBg: "bg-amber-700" },
];

const failureRankConfig = [
  { icon: Crown, color: "text-rose-500", bg: "bg-rose-50/50", border: "border-rose-200", rankBg: "bg-rose-500" },
  { icon: Medal, color: "text-rose-400", bg: "bg-rose-50/30", border: "border-rose-200", rankBg: "bg-rose-400" },
  { icon: Award, color: "text-rose-300", bg: "bg-rose-50/20", border: "border-rose-100", rankBg: "bg-rose-300" },
];

const MEDIA_TYPE_ICONS: Record<string, React.ElementType> = {
  "純文字": FileText, "圖片": Image, "影片": Video, "輪播": Images,
  TEXT_POST: FileText, IMAGE: Image, VIDEO: Video, CAROUSEL_ALBUM: Images,
};

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
}

function getMediaTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    TEXT_POST: "純文字", IMAGE: "圖片", VIDEO: "影片", CAROUSEL_ALBUM: "輪播", REPOST_FACADE: "轉發",
    "純文字": "純文字", "圖片": "圖片", "影片": "影片", "輪播": "輪播", "轉發": "轉發",
  };
  return labels[type] || type;
}

export function PostCard({ post, rank, variant }: PostCardProps) {
  const rankConfigs = variant === "success" ? successRankConfig : failureRankConfig;
  const config = rankConfigs[Math.min(rank - 1, 2)] || rankConfigs[2];
  const MediaIcon = MEDIA_TYPE_ICONS[post.media_type] || FileText;

  return (
    <div className={cn("relative overflow-hidden p-4 rounded-xl border transition-all hover:shadow-md", config.bg, config.border)}>
      <div className="flex items-start gap-3">
        <div className={cn("shrink-0 flex items-center justify-center size-8 rounded-lg text-white text-sm font-bold", config.rankBg)}>
          #{rank}
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          <div className="group relative">
            <p className={cn(typography.body, "line-clamp-3")}>{post.text || "(無文字內容)"}</p>
            {post.text && post.text.length > 100 && (
              <div className="absolute left-0 top-0 z-50 hidden group-hover:block w-full max-w-md p-3 rounded-lg bg-popover border shadow-lg">
                <p className={cn(typography.body, "whitespace-pre-wrap max-h-60 overflow-y-auto")}>{post.text}</p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1">
              <Eye className="size-3 text-blue-500" />
              <span className={cn("font-medium text-foreground", typography.number)}>{formatNumber(post.views)}</span>
            </span>
            <span className="flex items-center gap-1">
              <TrendingUp className={cn("size-3", variant === "success" ? "text-emerald-500" : "text-rose-500")} />
              <span className={cn("font-medium text-foreground", typography.number)}>{(post.engagement_rate * 100).toFixed(2)}%</span>
            </span>
            <span className="flex items-center gap-1">
              <MediaIcon className="size-3 text-purple-500" />
              {getMediaTypeLabel(post.media_type)}
            </span>
            <span>{post.char_count} 字</span>
          </div>

          {post.features.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {post.features.map((feature, idx) => (
                <Badge key={idx} className={cn("text-xs px-2 py-0.5", variant === "success" ? semanticColors.success.badge : semanticColors.error.badge)}>
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
