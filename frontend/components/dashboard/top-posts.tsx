"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Eye, Heart, MessageCircle, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TopPost {
  id: string;
  text: string | null;
  permalink: string | null;
  publishedAt: string;
  views: number;
  likes: number;
  replies: number;
  account: {
    id: string;
    username: string;
    profilePicUrl: string | null;
  };
}

export interface TopPostsProps {
  posts: TopPost[];
  showAccount?: boolean;
  isLoading?: boolean;
}

function formatNumber(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toString();
}

function truncateText(text: string | null, maxLength: number = 60): string {
  if (!text) return "（無內容）";
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

export function TopPosts({
  posts,
  showAccount = true,
  isLoading = false,
}: TopPostsProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-24" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="size-8 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">熱門貼文</CardTitle>
      </CardHeader>
      <CardContent>
        {posts.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            尚無貼文資料
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post, index) => (
              <div
                key={post.id}
                className="flex items-start gap-3 group"
              >
                <div className="flex items-center justify-center size-6 rounded-full bg-muted text-muted-foreground text-sm font-medium shrink-0">
                  {index + 1}
                </div>
                {showAccount && (
                  <Avatar className="size-8 shrink-0">
                    <AvatarImage
                      src={post.account.profilePicUrl || undefined}
                      alt={post.account.username}
                    />
                    <AvatarFallback className="text-xs">
                      {post.account.username.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm line-clamp-2">{truncateText(post.text, 80)}</p>
                    {post.permalink && (
                      <a
                        href={post.permalink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      >
                        <ExternalLink className="size-4 text-muted-foreground hover:text-foreground" />
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                    {showAccount && (
                      <span className="font-medium">@{post.account.username}</span>
                    )}
                    <span className="flex items-center gap-1">
                      <Eye className="size-3" />
                      {formatNumber(post.views)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Heart className="size-3" />
                      {formatNumber(post.likes)}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageCircle className="size-3" />
                      {formatNumber(post.replies)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
