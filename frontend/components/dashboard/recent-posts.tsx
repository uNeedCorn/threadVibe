"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "@/lib/utils";
import { Image, Video, FileText, Layers, ExternalLink } from "lucide-react";

export interface RecentPost {
  id: string;
  text: string | null;
  mediaType: string | null;
  permalink: string | null;
  publishedAt: string;
  account: {
    id: string;
    username: string;
    profilePicUrl: string | null;
  };
}

export interface RecentPostsProps {
  posts: RecentPost[];
  isLoading?: boolean;
}

const MediaTypeIcon: Record<string, React.ReactNode> = {
  TEXT_POST: <FileText className="size-3" />,
  IMAGE: <Image className="size-3" />,
  VIDEO: <Video className="size-3" />,
  CAROUSEL_ALBUM: <Layers className="size-3" />,
};

function truncateText(text: string | null, maxLength: number = 100): string {
  if (!text) return "（無內容）";
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

export function RecentPosts({ posts, isLoading = false }: RecentPostsProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-24" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="size-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-20" />
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
        <CardTitle className="text-lg">最新貼文</CardTitle>
      </CardHeader>
      <CardContent>
        {posts.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            尚無貼文資料
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <div
                key={post.id}
                className="flex items-start gap-3 group"
              >
                <Avatar className="size-10 shrink-0">
                  <AvatarImage
                    src={post.account.profilePicUrl || undefined}
                    alt={post.account.username}
                  />
                  <AvatarFallback>
                    {post.account.username.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">
                      @{post.account.username}
                    </span>
                    {post.mediaType && MediaTypeIcon[post.mediaType] && (
                      <Badge variant="secondary" className="text-xs px-1.5 py-0">
                        {MediaTypeIcon[post.mediaType]}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(post.publishedAt))}
                    </span>
                    {post.permalink && (
                      <a
                        href={post.permalink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <ExternalLink className="size-4 text-muted-foreground hover:text-foreground" />
                      </a>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                    {truncateText(post.text)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
